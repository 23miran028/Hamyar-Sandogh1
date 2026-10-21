/* =========================================================
   services/period.service.js — مدیریت دوره‌ها
   ========================================================= */
window.App = window.App || {};

App.PeriodService = (function () {
  const Err   = App.Err;
  const U     = App.Utils;
  const M     = App.Models;
  const Bus   = App.Bus;
  const Repos = App.DataService.Repos;

  /* ---------- خواندن ---------- */
  async function list() {
    const arr = await Repos.periods.all();
    return arr.sort((a, b) => (a.year - b.year) || (a.idx - b.idx));
  }

  async function get(key) {
    return Repos.periods.get(key);
  }

  async function latest() {
    const all = await list();
    return all[all.length - 1] || null;
  }

  /* ---------- افزودن دوره‌ی بعدی ---------- */
  async function addNext(overrides = {}) {
    const periods = await list();
    if (!periods.length) throw Err.Validation('هیچ دوره‌ای موجود نیست. ابتدا فایل داده را بارگذاری کنید');

    const last = periods[periods.length - 1];
    let year = last.year;
    let idx  = last.idx + 1;
    if (idx > 11) { idx = 0; year += 1; }

    const name = U.MONTHS[idx];
    const key  = `${name} ${year}`;

    if (await Repos.periods.get(key)) {
      throw Err.Conflict(`دوره «${key}» قبلاً ساخته شده است`);
    }

    const depositRate = U.num(overrides.depositRate) || last.depositRate || 200000;
    const autoPayInstallments = !!overrides.autoPayInstallments;
    /* D-05: به‌صورت پیش‌فرض قسط‌ها پرداخت‌شده فرض نمی‌شوند */

    /* ۱) ذخیره رکورد Period */
    const period = M.Period.create({
      key, name, year, idx, depositRate,
      totals: { totalCap: 0, remaining: 0, installment: 0, deposit: 0, capInst: 0 }
    });
    await Repos.periods.put(period);

    /* ۲) ساخت Snapshot برای هر عضو فعال */
    const members = (await Repos.members.all()).filter(m => m.status === 'active');
    const loans   = await Repos.loans.all();
    const activeLoansByMember = new Map();
    loans.filter(l => l.status === 'active').forEach(l => activeLoansByMember.set(l.memberCode, l));

    const newSnaps = [];
    let totalCap = 0, totalDeposit = 0, totalInstallment = 0, totalRemaining = 0;

    for (const member of members) {
      const prevSnap = await findLatestSnapshotBefore(member.code, periods);
      const activeLoan = activeLoansByMember.get(member.code);

      let loan = prevSnap?.loan || 0;
      let installment = 0;
      let paidCount = prevSnap?.paidCount || 0;
      let remaining = prevSnap?.remaining || 0;

      /* ═══ D-05: قسط فقط اگر صریحاً خواسته شده، پرداخت‌شده فرض می‌شود ═══ */
      if (autoPayInstallments && loan > 0 && remaining > 0 && activeLoan) {
        installment = U.num(activeLoan.installment);
        paidCount  = paidCount + 1;
        remaining  = Math.max(0, remaining - installment);
      }

      const prevTotalCap = prevSnap?.totalCap || 0;
      const newTotalCap  = prevTotalCap + depositRate;

      newSnaps.push(M.Snapshot.create({
        periodKey: key,
        memberCode: member.code,
        loan, installment, paidCount, remaining,
        deposit: depositRate,
        totalCap: newTotalCap,
        capInst: depositRate + installment,
        rowNo: null
      }));

      totalCap += newTotalCap;
      totalDeposit += depositRate;
      totalInstallment += installment;
      totalRemaining += remaining;
    }

    await Repos.snapshots.putMany(newSnaps);

    /* ۳) به‌روزرسانی totals دوره */
    period.totals = {
      totalCap,
      deposit: totalDeposit,
      installment: totalInstallment,
      remaining: totalRemaining,
      capInst: totalDeposit + totalInstallment
    };
    period.updatedAt = Date.now();
    await Repos.periods.put(period);

    /* ۴) به‌روزرسانی وضعیت وام‌ها فقط در حالت autoPay */
    if (autoPayInstallments) {
      for (const loan of loans.filter(l => l.status === 'active')) {
        const memberSnap = newSnaps.find(s => s.memberCode === loan.memberCode);
        if (!memberSnap) continue;

        const count = loan.count || 20;
        if (memberSnap.remaining === 0 && memberSnap.paidCount >= count) {
          loan.status = 'settled';
          loan.paid = count;
          loan.remaining = 0;
        } else {
          loan.paid = memberSnap.paidCount;
          loan.remaining = memberSnap.remaining;
        }
        loan.updatedAt = Date.now();
        await Repos.loans.put(loan);
      }
    }

    await App.DataService.logAudit({
      action: 'period:add', entity: 'period', entityId: key,
      after: { key, depositRate, membersCount: members.length, autoPay: autoPayInstallments }
    });

    await App.DataService.loadAll(App.State.state);
    Bus.emit('period:added', { key });
    return period;
  }

  /* ---------- ویرایش دوره ---------- */
  async function update(key, patch) {
    const period = await Repos.periods.get(key);
    if (!period) throw Err.NotFound('دوره یافت نشد');

    const before = { depositRate: period.depositRate };

    if (patch.depositRate != null) {
      period.depositRate = U.num(patch.depositRate);
    }
    period.updatedAt = Date.now();
    await Repos.periods.put(period);

    if (patch.applyToSnapshots) {
      const snaps = await Repos.snapshots.byIndex('periodKey', key);
      for (const s of snaps) {
        s.deposit = period.depositRate;
        s.capInst = period.depositRate + (s.installment || 0);
        s.updatedAt = Date.now();
        await Repos.snapshots.put(s);
      }

      const refreshed = await Repos.snapshots.byIndex('periodKey', key);
      period.totals = {
        totalCap: refreshed.reduce((a, x) => a + U.num(x.totalCap), 0),
        deposit:  refreshed.reduce((a, x) => a + U.num(x.deposit), 0),
        installment: refreshed.reduce((a, x) => a + U.num(x.installment), 0),
        remaining: refreshed.reduce((a, x) => a + U.num(x.remaining), 0),
        capInst:  refreshed.reduce((a, x) => a + U.num(x.capInst), 0)
      };
      await Repos.periods.put(period);
    }

    await App.DataService.logAudit({
      action: 'period:update', entity: 'period', entityId: key,
      before, after: patch
    });

    await App.DataService.loadAll(App.State.state);
    return period;
  }

  /* ---------- حذف دوره (با بازگردانی اختیاری) ---------- */
  async function remove(key, options = {}) {
    const periods = await list();
    const periodIdx = periods.findIndex(p => p.key === key);

    if (periodIdx === -1) throw Err.NotFound('دوره یافت نشد');

    if (periodIdx < periods.length - 1) {
      throw Err.Permission('فقط آخرین دوره قابل حذف است. اول دوره‌های بعدی را حذف کن.');
    }

    const period = periods[periodIdx];
    const snaps = await Repos.snapshots.byIndex('periodKey', key);

    const hasData = snaps.some(s =>
      U.num(s.loan) > 0 ||
      U.num(s.installment) > 0 ||
      U.num(s.remaining) > 0
    );

    if (hasData && !options.force) {
      throw Err.Permission(
        'این دوره دارای داده فعال است. برای حذف با بازگردانی، گزینه force را فعال کن.'
      );
    }

    /* بازگردانی اثرات روی وام‌ها + حذف اسنپ‌شات‌ها + حذف دوره در «یک تراکنش»؛
       در صورت خطا هیچ‌کدام اعمال نمی‌شود و داده‌ها ناهماهنگ نمی‌مانند. */
    const ops = options.force ? await _rollbackPeriodEffects(snaps) : [];
    snaps.forEach(s => ops.push({ type: 'del', store: 'snapshots', key: [s.periodKey, s.memberCode] }));
    ops.push({ type: 'del', store: 'periods', key });
    await App.DB.batch(ops);

    await App.DataService.logAudit({
      action: options.force ? 'period:force-delete' : 'period:delete',
      entity: 'period',
      entityId: key,
      meta: { forced: !!options.force, snapshots: snaps.length }
    });

    await App.DataService.loadAll(App.State.state);
    Bus.emit('period:deleted', { key, forced: !!options.force });
    return true;
  }

  /* ---------- بازگردانی اثرات دوره روی وام‌ها (D-10 اصلاح‌شده) ---------- */
  /* فقط فهرست عملیات را می‌سازد (نوشتن توسط فراخواننده و در یک تراکنش انجام می‌شود) */
  async function _rollbackPeriodEffects(snaps) {
    const loans = await Repos.loans.all();
    const ops = [];

    for (const snap of snaps) {
      const installment = U.num(snap.installment);
      if (installment === 0) continue;

      const memberLoans = loans
        .filter(l => l.memberCode === snap.memberCode)
        .sort((a, b) => (a.startYear - b.startYear) || (a.startIdx - b.startIdx));

      const startedLoan = memberLoans.find(l => l.startPeriodKey === snap.periodKey);
      if (startedLoan && U.num(snap.loan) > 0) {
        ops.push({ type: 'del', store: 'loans', key: startedLoan.id });
        continue;
      }

      const activeLoan = memberLoans.find(l => l.status === 'active');
      const target = activeLoan || memberLoans[memberLoans.length - 1];
      if (!target) continue;

      const newPaid = Math.max(0, U.num(target.paid) - 1);
      const newRemaining = Math.min(
        U.num(target.amount),
        U.num(target.remaining) + installment
      );

      target.paid = newPaid;
      target.remaining = newRemaining;
      if (target.status === 'settled' && newRemaining > 0) {
        target.status = 'active';
      }
      target.updatedAt = Date.now();
      ops.push({ type: 'put', store: 'loans', data: target });
    }
    return ops;
  }

  /* ---------- کمکی ---------- */
  async function findLatestSnapshotBefore(memberCode, periods) {
    const snaps = await Repos.snapshots.byIndex('memberCode', memberCode);
    if (!snaps.length) return null;

    const order = new Map(periods.map((p, i) => [p.key, i]));
    snaps.sort((a, b) => (order.get(b.periodKey) ?? -1) - (order.get(a.periodKey) ?? -1));
    return snaps[0];
  }

    /* ---------- D-07: محاسبه‌ی مجدد جمع‌های یک دوره ---------- */
  async function recomputeTotals(key) {
    const snaps = await Repos.snapshots.byIndex('periodKey', key);
    const period = await Repos.periods.get(key);
    if (!period) return null;

    period.totals = {
      totalCap:    snaps.reduce((a, x) => a + U.num(x.totalCap), 0),
      deposit:     snaps.reduce((a, x) => a + U.num(x.deposit), 0),
      installment: snaps.reduce((a, x) => a + U.num(x.installment), 0),
      remaining:   snaps.reduce((a, x) => a + U.num(x.remaining), 0),
      capInst:     snaps.reduce((a, x) => a + U.num(x.capInst), 0)
    };
    period.updatedAt = Date.now();
    await Repos.periods.put(period);
    return period;
  }

  /* ---------- پیشنهاد نرخ بعدی ---------- */
  async function suggestNextRate() {
    const last = await latest();
    if (!last) return 200000;
    return last.depositRate || 200000;
  }

  return { list, get, latest, addNext, update, remove, suggestNextRate, recomputeTotals };
})();