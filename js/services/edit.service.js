/* =========================================================
   services/edit.service.js — ویرایش با Undo/Redo
   ========================================================= */
window.App = window.App || {};

App.EditService = (function () {
  const Err   = App.Err;
  const U     = App.Utils;
  const M     = App.Models;
  const Bus   = App.Bus;
  const Repos = App.DataService.Repos;

  /* ─── تاریخچه برای Undo/Redo ─── */
  const HISTORY = {
    past: [],
    future: [],
    MAX: 50
  };

  /* ─── ثبت تغییر در تاریخچه ─── */
  function pushHistory(entry) {
    HISTORY.past.push(entry);
    HISTORY.future = [];
    if (HISTORY.past.length > HISTORY.MAX) HISTORY.past.shift();
    Bus.emit('edit:changed', { canUndo: canUndo(), canRedo: canRedo() });
  }

  const canUndo = () => HISTORY.past.length > 0;
  const canRedo = () => HISTORY.future.length > 0;

  /* ─── ویرایش یک عضو ─── */
  async function updateMember(code, patch) {
    const before = await Repos.members.get(code);
    if (!before) throw Err.NotFound('عضو یافت نشد');

    const after = M.Member.create({ ...before, ...patch, code });
    after.updatedAt = Date.now();
    await Repos.members.put(after);

    pushHistory({ entity: 'member', key: code, before, after });

    await App.DataService.logAudit({
      action: 'edit:member',
      entity: 'member',
      entityId: code,
      before,
      after
    });

    Bus.emit(Bus.EVENTS.MEMBER_UPDATED, { code, action: 'edit' });
    await App.DataService.loadAll(App.State.state);
    return after;
  }

  /* ─── ویرایش یک دوره ─── */
  async function updatePeriod(key, patch) {
    const before = await Repos.periods.get(key);
    if (!before) throw Err.NotFound('دوره یافت نشد');

    const after = { ...before, ...patch, key, updatedAt: Date.now() };
    await Repos.periods.put(after);

    pushHistory({ entity: 'period', key, before, after });

    await App.DataService.logAudit({
      action: 'edit:period',
      entity: 'period',
      entityId: key,
      before,
      after
    });

    await App.DataService.loadAll(App.State.state);
    return after;
  }

  /* ─── ویرایش یک اسنپ‌شات (معامله ماهانه) ─── */
  async function updateSnapshot(periodKey, memberCode, patch) {
    const key = [periodKey, memberCode];
    const before = await Repos.snapshots.get(key);
    if (!before) throw Err.NotFound('رکورد یافت نشد');

    const after = M.Snapshot.create({
      ...before,
      ...patch,
      periodKey,
      memberCode
    });
    after.capInst = (after.deposit || 0) + (after.installment || 0);
    after.updatedAt = Date.now();

    await Repos.snapshots.put(after);

    pushHistory({ entity: 'snapshot', key: key.join('::'), before, after });

    /* اگر مبلغ وام تغییر کرده، رکورد Loan را همگام کن */
    if (before.loan !== after.loan && after.loan > 0) {
      await syncLoanForSnapshot(after);
    }

    /* اگر paidCount تغییر کرده، وام را به‌روز کن */
    if (before.paidCount !== after.paidCount) {
      await syncLoanProgress(memberCode, after);
    }

    await App.DataService.logAudit({
      action: 'edit:snapshot',
      entity: 'snapshot',
      entityId: key.join('::'),
      before: summarize(before),
      after: summarize(after)
    });

    await App.DataService.loadAll(App.State.state);
    return after;
  }

  /* ─── ویرایش یک وام ─── */
  async function updateLoan(loanId, patch) {
    const before = await Repos.loans.get(loanId);
    if (!before) throw Err.NotFound('وام یافت نشد');

    const after = { ...before, ...patch, id: loanId, updatedAt: Date.now() };

    /* محافظت: مقدار paid نمی‌تواند بیشتر از count باشد */
    if (after.paid > after.count) after.paid = after.count;

    /* محاسبه باقیمانده خودکار */
    if (patch.recalculateRemaining !== false) {
      after.remaining = Math.max(0, U.num(after.amount) - U.num(after.paid) * U.num(after.installment));
    }

    /* اگر تسویه شد */
    if (after.paid >= after.count || after.remaining <= 0) {
      after.status = 'settled';
      after.paid = after.count;
      after.remaining = 0;
    }

    delete after.recalculateRemaining;

    await Repos.loans.put(after);

    pushHistory({ entity: 'loan', key: loanId, before, after });

    await App.DataService.logAudit({
      action: 'edit:loan',
      entity: 'loan',
      entityId: loanId,
      before,
      after
    });

    Bus.emit('loan:updated', { id: loanId });
    await App.DataService.loadAll(App.State.state);
    return after;
  }

  /* ─── حذف وام (با اجازه‌ی مدیر، هر وضعیتی) ─── */
  async function deleteLoan(loanId, options = {}) {
    const before = await Repos.loans.get(loanId);
    if (!before) throw Err.NotFound('وام یافت نشد');

    if (!options.force && U.num(before.paid) > 0) {
      throw Err.Permission('این وام قسط پرداخت‌شده دارد. برای حذف اجباری، گزینه force را بده.');
    }

    /* برگرداندن وام از snapshot دوره شروع */
    const snap = await Repos.snapshots.get([before.startPeriodKey, before.memberCode]);
    if (snap) {
      snap.loan = 0;
      snap.installment = 0;
      snap.paidCount = 0;
      snap.remaining = 0;
      snap.capInst = snap.deposit || 0;
      await Repos.snapshots.put(snap);
    }

    await Repos.loans.del(loanId);

    pushHistory({ entity: 'loan', key: loanId, before, after: null });

    await App.DataService.logAudit({
      action: 'edit:loan-delete',
      entity: 'loan',
      entityId: loanId,
      before
    });

    await App.DataService.loadAll(App.State.state);
    return true;
  }

  /* ─── Undo ─── */
  async function undo() {
    if (!canUndo()) return false;

    const entry = HISTORY.past.pop();

    try {
      await applyReverse(entry);
      HISTORY.future.push(entry);
      Bus.emit('edit:changed', { canUndo: canUndo(), canRedo: canRedo() });
      Bus.emit('edit:undone', entry);
      return true;
    } catch (e) {
      console.error('[EditService] undo failed:', e);
      /* برگردان به past اگر خطا داد */
      HISTORY.past.push(entry);
      throw e;
    }
  }

  /* ─── Redo ─── */
  async function redo() {
    if (!canRedo()) return false;

    const entry = HISTORY.future.pop();

    try {
      await applyForward(entry);
      HISTORY.past.push(entry);
      Bus.emit('edit:changed', { canUndo: canUndo(), canRedo: canRedo() });
      Bus.emit('edit:redone', entry);
      return true;
    } catch (e) {
      console.error('[EditService] redo failed:', e);
      HISTORY.future.push(entry);
      throw e;
    }
  }

  /* ─── اعمال معکوس ─── */
  async function applyReverse(entry) {
    switch (entry.entity) {
      case 'member':
        await Repos.members.put(entry.before);
        break;
      case 'period':
        await Repos.periods.put(entry.before);
        break;
      case 'snapshot':
        await Repos.snapshots.put(entry.before);
        break;
      case 'loan':
        if (entry.after === null) {
          /* حذف شده بود → برگردان */
          await Repos.loans.put(entry.before);
        } else {
          await Repos.loans.put(entry.before);
        }
        break;
    }
    await App.DataService.loadAll(App.State.state);
  }

  /* ─── اعمال مجدد ─── */
  async function applyForward(entry) {
    switch (entry.entity) {
      case 'member':
        await Repos.members.put(entry.after);
        break;
      case 'period':
        await Repos.periods.put(entry.after);
        break;
      case 'snapshot':
        await Repos.snapshots.put(entry.after);
        break;
      case 'loan':
        if (entry.after === null) {
          await Repos.loans.del(entry.key);
        } else {
          await Repos.loans.put(entry.after);
        }
        break;
    }
    await App.DataService.loadAll(App.State.state);
  }

  /* ─── کمکی ─── */
  function summarize(s) {
    return {
      deposit: U.num(s.deposit),
      installment: U.num(s.installment),
      loan: U.num(s.loan),
      paidCount: s.paidCount,
      remaining: U.num(s.remaining),
      totalCap: U.num(s.totalCap)
    };
  }

  async function syncLoanForSnapshot(snap) {
    const loans = await Repos.loans.byIndex('memberCode', snap.memberCode);
    const existing = loans.find(l => l.startPeriodKey === snap.periodKey);

    if (snap.loan > 0 && !existing) {
      const period = await Repos.periods.get(snap.periodKey);
      if (!period) return;
      const member = await Repos.members.get(snap.memberCode);
      const newLoan = M.Loan.create({
        id: `${snap.memberCode}__${snap.periodKey.replace(/\s+/g, '_')}`,
        memberCode: snap.memberCode,
        name: member?.name || snap.name || '',
        amount: snap.loan,
        installment: Math.round(snap.loan / 20),
        startPeriodKey: snap.periodKey,
        startYear: period.year,
        startIdx: period.idx,
        paid: snap.paidCount || 0,
        remaining: snap.remaining,
        status: 'active'
      });
      await Repos.loans.put(newLoan);
    }
  }

  async function syncLoanProgress(memberCode, snap) {
    const loans = await Repos.loans.byIndex('memberCode', memberCode);
    const current = loans.find(l => l.status === 'active');
    if (!current) return;

    const paidCount = U.num(snap.paidCount);
    if (paidCount >= current.count) {
      current.status = 'settled';
      current.paid = current.count;
      current.remaining = 0;
    } else {
      current.paid = paidCount;
      current.remaining = Math.max(0, current.amount - paidCount * current.installment);
    }
    current.updatedAt = Date.now();
    await Repos.loans.put(current);
  }

  return {
    canUndo, canRedo, undo, redo,
    updateMember,
    updatePeriod,
    updateSnapshot,
    updateLoan,
    deleteLoan,
    clearHistory: () => { HISTORY.past = []; HISTORY.future = []; }
  };
})();