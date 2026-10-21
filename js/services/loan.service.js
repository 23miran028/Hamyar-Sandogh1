/* =========================================================
   services/loan.service.js — منطق کسب‌وکار وام
   ========================================================= */
window.App = window.App || {};

App.LoanService = (function () {
  const Err    = App.Err;
  const U      = App.Utils;
  const M      = App.Models;
  const Bus    = App.Bus;
  const Repos  = App.DataService.Repos;
  const Engine = App.LoanEngine;

  const listAll = () => Repos.loans.all();
  const get = (id) => Repos.loans.get(id);
  const listByMember = (code) => Repos.loans.byIndex('memberCode', code);

  async function listActive() {
    const all = await Repos.loans.all();
    return all.filter(l => l.status === 'active');
  }

  async function disburse({ memberCode, amount, startPeriodKey }) {
    memberCode = String(memberCode || '').trim();
    amount = Number(amount);
    if (!memberCode)  throw Err.Validation('انتخاب عضو الزامی است');
    if (!amount || amount <= 0) throw Err.Validation('مبلغ وام نامعتبر است');
    if (!startPeriodKey) throw Err.Validation('انتخاب دوره شروع الزامی است');

    const member = await Repos.members.get(memberCode);
    if (!member) throw Err.NotFound('عضو یافت نشد');
    if (member.status !== 'active') throw Err.Validation('عضو غیرفعال است');

    const period = await Repos.periods.get(startPeriodKey);
    if (!period) throw Err.Validation('دوره شروع یافت نشد');

    const existing = await listByMember(memberCode);
    const active = existing.find(l => l.status === 'active');
    if (active) throw Err.Conflict(`این عضو وام فعال دارد (باقیمانده: ${U.fmt(active.remaining)} تومان)`);

    const installment = Engine.calcInstallment(amount);

    const snap = await Repos.snapshots.get([startPeriodKey, memberCode]);
    const snapUpdated = M.Snapshot.create({
      ...(snap || {}),
      periodKey: startPeriodKey, memberCode, loan: amount, installment: 0,
      paidCount: 0, remaining: amount, capInst: (snap?.deposit || 0) + 0
    });

    const loan = M.Loan.create({
      id: `${memberCode}__${startPeriodKey.replace(/\s+/g, '_')}`,
      memberCode, name: member.name, amount, installment,
      startPeriodKey, startYear: period.year, startIdx: period.idx,
      paid: 0, remaining: amount, status: 'active'
    });

    await App.DB.batch([
      { type: 'put', store: 'snapshots', data: snapUpdated },
      { type: 'put', store: 'loans',     data: loan }
    ]);

    await App.DataService.logAudit({ action: 'loan:disburse', entity: 'loan', entityId: loan.id, after: { memberCode, amount, installment, startPeriodKey } });
    Bus.emit('loan:created', { id: loan.id });
    await App.DataService.loadAll(App.State.state);
    return loan;
  }

  async function propagateForward(loan, fromPeriodKey, paidCount, remaining) {
    const periods = await Repos.periods.all();
    periods.sort((a, b) => (a.year - b.year) || (a.idx - b.idx));
    const fromIdx = periods.findIndex(p => p.key === fromPeriodKey);
    if (fromIdx < 0) return;

    const later = periods.slice(fromIdx + 1);
    if (!later.length) return;

    const snaps = await Repos.snapshots.byIndex('memberCode', loan.memberCode);
    const map = new Map(snaps.map(s => [s.periodKey, s]));

    for (const p of later) {
      const s = map.get(p.key);
      if (!s) continue;
      if (U.num(s.loan) !== U.num(loan.amount)) continue;
      
      // ← اصلاح حیاتی: پیشرفت نباید کاهش یابد
      const newPaid = Math.max(U.num(s.paidCount), paidCount);
      s.paidCount = newPaid;
      s.remaining = Math.max(0, U.num(s.loan) - newPaid * U.num(loan.installment));
      s.installment = loan.installment;
      s.capInst = (s.deposit || 0) + loan.installment;
      s.updatedAt = Date.now();
      await Repos.snapshots.put(s);
    }
  }

  async function payInstallment(loanId, periodKey) {
    const loan = await Repos.loans.get(loanId);
    if (!loan) throw Err.NotFound('وام یافت نشد');
    if (loan.status !== 'active') throw Err.Conflict('این وام تسویه شده است');

    const period = await Repos.periods.get(periodKey);
    if (!period) throw Err.NotFound('دوره یافت نشد'); // ← اعتبارسنجی دوره

    const snap = await Repos.snapshots.get([periodKey, loan.memberCode]);
    const currentPaid = snap?.paidCount || 0;
    const newPaidCount = Math.min(Engine.COUNT, currentPaid + 1);
    const newRemaining = Math.max(0, loan.amount - newPaidCount * loan.installment);

    const updated = M.Snapshot.create({
      ...(snap || {}), periodKey, memberCode: loan.memberCode,
      loan: loan.amount, installment: loan.installment,
      paidCount: newPaidCount, remaining: newRemaining,
      capInst: (snap?.deposit || 0) + loan.installment
    });

    loan.paid = newPaidCount;
    loan.remaining = newRemaining;
    if (newPaidCount >= Engine.COUNT || newRemaining <= 0) {
      loan.status = 'settled'; loan.paid = Engine.COUNT; loan.remaining = 0;
    }
    loan.updatedAt = Date.now();

    await App.DB.batch([
      { type: 'put', store: 'snapshots', data: updated },
      { type: 'put', store: 'loans',     data: loan }
    ]);

    await propagateForward(loan, periodKey, newPaidCount, newRemaining);

    await App.DataService.logAudit({ action: 'loan:pay', entity: 'loan', entityId: loan.id, after: { periodKey, newPaidCount, newRemaining } });
    Bus.emit('loan:updated', { id: loan.id });
    await App.DataService.loadAll(App.State.state);
    return loan;
  }

  async function remove(id) {
    const loan = await Repos.loans.get(id);
    if (!loan) throw Err.NotFound('وام یافت نشد');
    if ((loan.paid || 0) > 0) throw Err.Permission('این وام حداقل یک قسط پرداخت‌شده دارد و قابل حذف نیست');

    const snap = await Repos.snapshots.get([loan.startPeriodKey, loan.memberCode]);
    const ops = [];
    if (snap) {
      snap.loan = 0; snap.installment = 0; snap.paidCount = 0; snap.remaining = 0;
      snap.capInst = snap.deposit || 0;
      ops.push({ type: 'put', store: 'snapshots', data: snap });
    }
    ops.push({ type: 'del', store: 'loans', key: id });
    await App.DB.batch(ops);

    await App.DataService.logAudit({ action: 'loan:delete', entity: 'loan', entityId: id, before: { memberCode: loan.memberCode, amount: loan.amount } });
    Bus.emit('loan:deleted', { id });
    await App.DataService.loadAll(App.State.state);
  }

  async function summaryOf(loan) {
    const periods = App.State.state.months.map(m => ({ key: m.key, year: m.year, idx: m.idx }));
    return Engine.summary(loan, periods);
  }

  return { listAll, listActive, listByMember, get, disburse, payInstallment, remove, summaryOf };
})();