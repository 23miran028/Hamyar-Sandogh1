/* =========================================================
   domain/loan.engine.js — محاسبات وام
   ========================================================= */
window.App = window.App || {};

App.LoanEngine = (function () {
  const COUNT = 20;

  /* ترتیب زمانی دوره‌ها */
  function sortPeriods(periods) {
    return periods.slice().sort((a, b) => (a.year - b.year) || (a.idx - b.idx));
  }

  /* پیدا کردن دوره شروع */
  function findStartIndex(loan, sortedPeriods) {
    return sortedPeriods.findIndex(p => p.key === loan.startPeriodKey);
  }

  /* محاسبه‌ی ۲۰ قسط و وضعیت هرکدام
     قاعده: وام در دوره P پرداخت می‌شود → قسط k در دوره P+k سررسید می‌شود
  */
  function computeInstallments(loan, periods) {
    const sorted = sortPeriods(periods);
    const startIdx = findStartIndex(loan, sorted);
    if (startIdx === -1) return [];

    const paidCount = loan.paid || 0;
    const lastPeriodIdx = sorted.length - 1;
    const result = [];

    for (let k = 1; k <= COUNT; k++) {
      const periodIdx = startIdx + k;
      const period = sorted[periodIdx];
      if (!period) break;

      let status;
      if (k <= paidCount) status = 'paid';
      else if (periodIdx <= lastPeriodIdx) status = 'overdue';
      else status = 'pending';

      result.push({
        number: k,
        duePeriodKey: period.key,
        dueYear: period.year,
        dueIdx: period.idx,
        amount: loan.installment,
        status
      });
    }

    return result;
  }

  /* خلاصه وضعیت وام */
  function summary(loan, periods) {
    const ins = computeInstallments(loan, periods);
    const paid     = ins.filter(i => i.status === 'paid').length;
    const overdue  = ins.filter(i => i.status === 'overdue').length;
    const pending  = ins.filter(i => i.status === 'pending').length;

    return {
      installments: ins,
      paid,
      overdue,
      pending,
      total: ins.length,
      paidAmount:      paid    * loan.installment,
      overdueAmount:   overdue * loan.installment,
      pendingAmount:   pending * loan.installment,
      remainingAmount: (COUNT - paid) * loan.installment
    };
  }

  /* دوره‌ی بعدی سررسید */
  function nextDuePeriod(loan, periods) {
    const s = summary(loan, periods);
    const next = s.installments.find(i => i.status !== 'paid');
    return next ? next.duePeriodKey : null;
  }

  /* محاسبه قسط خودکار */
  const calcInstallment = (amount) => Math.round(Number(amount) / COUNT);

  return { COUNT, sortPeriods, computeInstallments, summary, nextDuePeriod, calcInstallment };
})();