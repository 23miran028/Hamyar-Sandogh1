/* =========================================================
   services/txn.service.js — ثبت/ویرایش معاملات دوره
   ========================================================= */
window.App = window.App || {};

App.TxnService = (function () {
  const Err = App.Err;
  const M   = App.Models;
  const Bus = App.Bus;
  const V   = App.Validators;
  const Repos = App.DataService.Repos;
  const U   = App.Utils;

  /* ---------- خواندن ---------- */
  async function getSnapshot(periodKey, memberCode) {
    return Repos.snapshots.get([periodKey, memberCode]);
  }

  async function listByPeriod(periodKey) {
    return Repos.snapshots.byIndex('periodKey', periodKey);
  }

  async function listByMember(memberCode) {
    const arr = await Repos.snapshots.byIndex('memberCode', memberCode);
    return arr.sort((a, b) => U.comparePeriodKeys(a.periodKey, b.periodKey));
  }

  /* ---------- ایجاد یا به‌روزرسانی اسنپ‌شات ---------- */
  async function upsert(periodKey, memberCode, patch) {
    const input = {
      periodKey,
      memberCode,
      ...patch
    };
    const v = V.txn(input);
    if (!v.ok) throw Err.Validation('اطلاعات نامعتبر', v.errors);

    const existing = await getSnapshot(periodKey, memberCode);
    const snapshot = M.Snapshot.create({
      ...(existing || {}),
      ...input,
      periodKey,
      memberCode
    });

    /* محاسبه capInst = deposit + installment */
    snapshot.capInst = (snapshot.deposit || 0) + (snapshot.installment || 0);

    await Repos.snapshots.put(snapshot);
        /* ═══ بررسی خودکار: اگر paidCount = 20 → remaining باید صفر باشد ═══ */
    if (U.num(snapshot.paidCount) >= 20 && snapshot.loan > 0) {
      snapshot.remaining = 0;
      await Repos.snapshots.put(snapshot);
    }

    /* اگر وام جدیدی ثبت شده، رکورد Loan بساز */
    if (!existing || snapshot.loan !== existing.loan) {
      await syncLoan(snapshot);
    }

    /* اگر وام جاری تغییر کرده (پرداخت قسط)، رکورد وام را به‌روز کن */
    await updateLoanProgress(memberCode, snapshot);
        /* D-07: به‌روزرسانی جمع‌های دوره */
    if (App.PeriodService?.recomputeTotals) {
      await App.PeriodService.recomputeTotals(periodKey);
    }

    await App.DataService.logAudit({
      action: existing ? 'txn:update' : 'txn:create',
      entity: 'snapshot', entityId: `${periodKey}::${memberCode}`,
      before: existing ? summarize(existing) : null,
      after: summarize(snapshot)
    });

    Bus.emit(Bus.EVENTS.PERIOD_UPDATED, { periodKey, memberCode });

    /* بازخوانی state */
    await App.DataService.loadAll(App.State.state);
    return snapshot;
  }

  async function remove(periodKey, memberCode) {
    const existing = await getSnapshot(periodKey, memberCode);
    if (!existing) throw Err.NotFound('رکورد یافت نشد');
    await Repos.snapshots.del([periodKey, memberCode]);
        /* D-07: به‌روزرسانی جمع‌های دوره */
    if (App.PeriodService?.recomputeTotals) {
      await App.PeriodService.recomputeTotals(periodKey);
    }
    await App.DataService.logAudit({
      action: 'txn:delete', entity: 'snapshot',
      entityId: `${periodKey}::${memberCode}`,
      before: summarize(existing)
    });
    Bus.emit(Bus.EVENTS.PERIOD_UPDATED, { periodKey, memberCode });
    await App.DataService.loadAll(App.State.state);
  }

  /* ---------- ساخت/به‌روزرسانی رکورد وام ---------- */
  async function syncLoan(snapshot) {
    const memberCode = snapshot.memberCode;
    const loans = await Repos.loans.byIndex('memberCode', memberCode);
    const existing = loans.find(l => l.startPeriodKey === snapshot.periodKey);

    if (snapshot.loan > 0 && !existing) {
      const period = await Repos.periods.get(snapshot.periodKey);
      if (!period) return;
      const loan = M.Loan.create({
        id: `${memberCode}__${snapshot.periodKey.replace(/\s+/g, '_')}`,
        memberCode,
        name: (await Repos.members.get(memberCode))?.name || snapshot.name || '',
        amount: snapshot.loan,
        installment: snapshot.installment,
        count: 20,
        startPeriodKey: snapshot.periodKey,
        startYear: period.year,
        startIdx: period.idx,
        paid: snapshot.paidCount || 0,
        remaining: snapshot.remaining,
        status: 'active'
      });
      await Repos.loans.put(loan);
    } else if (existing) {
      existing.amount = snapshot.loan;
      existing.installment = snapshot.installment;
      existing.paid = snapshot.paidCount || 0;
      existing.remaining = snapshot.remaining;
      existing.updatedAt = Date.now();
      await Repos.loans.put(existing);
    }
  }

  /* ---------- به‌روزرسانی وضعیت وام جاری ---------- */
  /* ---------- به‌روزرسانی وضعیت وام جاری ---------- */
async function updateLoanProgress(memberCode, snapshot) {
  const loans = await Repos.loans.byIndex('memberCode', memberCode);
  if (!loans.length) return;

  loans.sort((a, b) =>
    (a.startYear - b.startYear) || (a.startIdx - b.startIdx));

  const current = loans.find(l => l.status === 'active');
  if (!current) return;

  /* آیا این اسنپ‌شات مربوط به این وام است؟ */
  const inLoanRange = U.comparePeriodKeys(snapshot.periodKey, current.startPeriodKey) >= 0;
  if (!inLoanRange) return;

  const paidCount = U.num(snapshot.paidCount);
  const count = current.count || 20;

  /* اگر paidCount به سقف رسید → تسویه */
  if (paidCount >= count) {
    current.status = 'settled';
    current.paid = count;
    current.remaining = 0;
    current.updatedAt = Date.now();
    await Repos.loans.put(current);

    /* اسنپ‌شات را هم settle کن */
    if (snapshot.remaining !== 0) {
      snapshot.remaining = 0;
      await Repos.snapshots.put(snapshot);
    }
    return;
  }

  /* در غیر این صورت → به‌روزرسانی عادی */
  const installment = U.num(current.installment);
  const remaining = Math.max(0, U.num(current.amount) - paidCount * installment);

  current.paid = paidCount;
  current.remaining = remaining;
  current.updatedAt = Date.now();
  await Repos.loans.put(current);

  /* اگر snapshot.remaining متفاوت است، همگامش کن */
  if (U.num(snapshot.remaining) !== remaining) {
    snapshot.remaining = remaining;
    await Repos.snapshots.put(snapshot);
  }
}

  function summarize(s) {
    return {
      deposit: s.deposit, installment: s.installment, loan: s.loan,
      paidCount: s.paidCount, remaining: s.remaining, totalCap: s.totalCap
    };
  }

  /* ---------- عملیات سریع ---------- */
  async function recordDeposit(periodKey, memberCode, amount) {
    const snap = await getSnapshot(periodKey, memberCode) || { deposit: 0 };
    return upsert(periodKey, memberCode, {
      deposit: (snap.deposit || 0) + Number(amount)
    });
  }

  async function recordInstallment(periodKey, memberCode, amount, paidCount, remaining) {
    return upsert(periodKey, memberCode, {
      installment: Number(amount),
      paidCount: Number(paidCount),
      remaining: Number(remaining)
    });
  }

  /* خلاصه دوره */
  async function periodSummary(periodKey) {
    const snaps = await listByPeriod(periodKey);
    return {
      count: snaps.length,
      deposit:   snaps.reduce((s,x) => s + (x.deposit||0), 0),
      installment: snaps.reduce((s,x) => s + (x.installment||0), 0),
      loan:      snaps.reduce((s,x) => s + (x.loan||0), 0),
      remaining: snaps.reduce((s,x) => s + (x.remaining||0), 0),
      totalCap:  snaps[0]?.totalCap || 0
    };
  }

  return {
    getSnapshot, listByPeriod, listByMember,
    upsert, remove,
    recordDeposit, recordInstallment,
    periodSummary
  };
})();