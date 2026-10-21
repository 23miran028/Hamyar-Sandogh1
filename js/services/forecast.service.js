/* =========================================================
   services/forecast.service.js — پیش‌بینی صندوق
   ========================================================= */
window.App = window.App || {};

App.ForecastService = (function () {
  const U = App.Utils;
  const Repos = App.DataService.Repos;

  const COUNT = 20;   // تعداد اقساط ثابت

  /* ---------- قدرت فعلی صندوق ---------- */
  async function getFundPower() {
    const [periods, members] = await Promise.all([
      App.PeriodService.list(),
      Repos.members.all()
    ]);

    if (!periods.length) {
      return {
        totalCapital: 0, availableCash: 0, activeLoansOutstanding: 0,
        activeMembersCount: 0, depositRate: 0, lastPeriod: null, monthlyInflow: 0
      };
    }

    const last = periods[periods.length - 1];
    const [snaps, loans] = await Promise.all([
      Repos.snapshots.byIndex('periodKey', last.key),
      Repos.loans.all()
    ]);

    const totalCapital = snaps.reduce((s, x) => s + U.num(x.totalCap), 0);
    const activeLoans = loans.filter(l => l.status === 'active');
    const activeLoansOutstanding = activeLoans.reduce((s, l) => s + U.num(l.remaining), 0);
    const activeMembers = members.filter(m => m.status === 'active');

    const monthlyDeposits = activeMembers.length * U.num(last.depositRate);
    const monthlyInstallments = activeLoans.reduce((s, l) => s + U.num(l.installment), 0);

    return {
      totalCapital,
      availableCash: Math.max(0, totalCapital - activeLoansOutstanding),
      activeLoansOutstanding,
      activeMembersCount: activeMembers.length,
      depositRate: U.num(last.depositRate),
      lastPeriod: last,
      monthlyInflow: monthlyDeposits + monthlyInstallments,
      monthlyDeposits,
      monthlyInstallments
    };
  }

  /* ---------- پیش‌بینی صندوق برای N ماه آینده ---------- */
  async function projectFund(monthsAhead = 18) {
    const periods = await App.PeriodService.list();
    if (!periods.length) return [];

    const last = periods[periods.length - 1];
    const [snaps, members, loans] = await Promise.all([
      Repos.snapshots.byIndex('periodKey', last.key),
      Repos.members.all(),
      Repos.loans.all()
    ]);

    const activeMembers = members.filter(m => m.status === 'active');
    const activeLoans = loans.filter(l => l.status === 'active');

    let capital = snaps.reduce((s, x) => s + U.num(x.totalCap), 0);
    const depositRate = U.num(last.depositRate) || 200000;

    const forecast = [];
    let year = last.year, idx = last.idx;

    for (let i = 1; i <= monthsAhead; i++) {
      idx += 1;
      if (idx > 11) { idx = 0; year += 1; }

      const deposits = activeMembers.length * depositRate;
      const installments = activeLoans.reduce((s, l) => {
        // فقط اگر وام هنوز اقساط پرداخت‌نشده دارد
        const remainingCount = COUNT - U.num(l.paid);
        return remainingCount > 0 ? s + U.num(l.installment) : s;
      }, 0);

      capital = capital + deposits + installments;

      forecast.push({
        key: `${U.MONTHS[idx]} ${year}`,
        name: U.MONTHS[idx],
        year, idx,
        monthNumber: i,
        monthlyDeposits: deposits,
        monthlyInstallments: installments,
        monthlyInflow: deposits + installments,
        projectedCapital: capital
      });
    }

    return forecast;
  }

  /* ---------- موقعیت مالی یک عضو ---------- */
  /* ---------- موقعیت مالی یک عضو ---------- */
async function getMemberPosition(memberCode) {
  const member = await Repos.members.get(memberCode);
  if (!member) return null;

  const [snaps, loans, periods] = await Promise.all([
    Repos.snapshots.byIndex('memberCode', memberCode),
    Repos.loans.byIndex('memberCode', memberCode),
    App.PeriodService.list()
  ]);

  const order = new Map(periods.map((p, i) => [p.key, i]));
  snaps.sort((a, b) => (order.get(a.periodKey) ?? 0) - (order.get(b.periodKey) ?? 0));

  const lastSnap   = snaps[snaps.length - 1] || null;
  const lastPeriod = periods[periods.length - 1] || null;
  const activeLoan = loans.find(l => l.status === 'active') || null;
  const settledLoans = loans.filter(l => l.status === 'settled');

  const totalDeposits     = snaps.reduce((s, x) => s + U.num(x.deposit), 0);
  const totalInstallments = snaps.reduce((s, x) => s + U.num(x.installment), 0);

  /* ماه‌های گذشته از آخرین وام تسویه‌شده */
  let monthsSinceLastLoan = 999;
  if (settledLoans.length) {
    const lastSettled = settledLoans[settledLoans.length - 1];
    const startIdx = order.get(lastSettled.startPeriodKey) ?? 0;
    monthsSinceLastLoan = Math.max(0, periods.length - 1 - startIdx - COUNT);
  }

  /* تاریخ تسویه‌ی وام جاری */
  let currentLoanPayoff = null;
  let currentLoanInstallments = [];

  if (activeLoan && lastPeriod) {
    const paid = U.num(activeLoan.paid);
    const remainCount = Math.max(0, COUNT - paid);
    const installment = U.num(activeLoan.installment);

    let y = lastPeriod.year;
    let m = lastPeriod.idx;
    let remaining = U.num(activeLoan.remaining);

    for (let i = 0; i < remainCount; i++) {
      m += 1;
      if (m > 11) { m = 0; y += 1; }
      remaining = Math.max(0, remaining - installment);

      currentLoanInstallments.push({
        number: paid + i + 1,
        dueName: U.MONTHS[m],
        dueYear: y,
        dueKey: `${U.MONTHS[m]} ${y}`,
        amount: installment,
        remainingAfter: remaining
      });
    }

    if (currentLoanInstallments.length) {
      const lastIns = currentLoanInstallments[currentLoanInstallments.length - 1];
      currentLoanPayoff = lastIns.dueKey;
    }
  }

  return {
    member,
    lastSnap,
    activeLoan,
    totalLoans: loans.length,
    settledLoans: settledLoans.length,
    totalDeposits,
    totalInstallments,
    monthsSinceLastLoan,
    currentLoanPayoff,
    currentLoanInstallments,
    hasActiveLoan: !!activeLoan
  };
}

  /* ---------- امتیاز اولویت ---------- */
  function computePriority(pos, globalMax) {
    /* ۴۰٪ سهم از کل واریزی‌ها */
    const depositScore = globalMax.totalDeposits > 0
      ? (pos.totalDeposits / globalMax.totalDeposits) * 40
      : 0;

    /* ۳۰٪ ماه‌های سپری‌شده از آخرین وام */
    const monthsScore = Math.min(pos.monthsSinceLastLoan / 12, 1) * 30;

    /* ۲۰٪ نداشتن وام جاری */
    const noLoanScore = pos.hasActiveLoan ? 0 : 20;

    /* ۱۰٪ اعتبار (نسبت وام‌های تسویه‌شده) */
    const reliabilityScore = pos.totalLoans > 0
      ? (pos.settledLoans / pos.totalLoans) * 10
      : 10;

    return Math.round(depositScore + monthsScore + noLoanScore + reliabilityScore);
  }

  /* ---------- همه‌ی اعضا + امتیاز ---------- */
  async function getAllMemberForecasts() {
    const members = (await Repos.members.all()).filter(m => m.status === 'active');
    const positions = (await Promise.all(members.map(m => getMemberPosition(m.code)))).filter(Boolean);

    const maxDeposits = Math.max(...positions.map(p => p.totalDeposits), 1);

    return positions.map(p => ({
      ...p,
      priority: computePriority(p, { totalDeposits: maxDeposits })
    })).sort((a, b) => b.priority - a.priority);
  }

  /* ---------- پیش‌بینی وام آینده برای یک عضو ---------- */
  function predictNextLoan(pos, fundPower, eligibleCount) {
    if (pos.hasActiveLoan) return null;

    /* مقدار قابل تخصیص: ۷۰٪ موجودی نقدی، تقسیم بین واجدین شرایط */
    const pool = fundPower.availableCash * 0.7;
    const share = eligibleCount > 0 ? pool / eligibleCount : 0;

    /* محدودیت‌ها */
    const minLoan = 10_000_000;                                    // حداقل ۱۰ میلیون
    const maxByFund = Math.round(share / 1_000_000) * 1_000_000;   // مضرب میلیون
    const maxBySavings = Math.round(pos.totalDeposits * 10 / 1_000_000) * 1_000_000;
    const cap = 500_000_000;                                       // سقف ثابت

    let predicted = Math.min(maxByFund, maxBySavings, cap);
    if (predicted < minLoan) predicted = minLoan;

    const installment = Math.round(predicted / COUNT);

    /* زمان‌بندی: از ماه بعد */
    const periods = App.State.state.months;
    const lastPeriod = periods[periods.length - 1];
    let y = lastPeriod.year, m = lastPeriod.idx;

    const schedule = [];
    let remaining = predicted;
    for (let i = 1; i <= COUNT; i++) {
      m += 1;
      if (m > 11) { m = 0; y += 1; }
      remaining = Math.max(0, remaining - installment);
      schedule.push({
        number: i,
        dueName: U.MONTHS[m],
        dueYear: y,
        dueKey: `${U.MONTHS[m]} ${y}`,
        amount: installment,
        remainingAfter: remaining
      });
    }

    return {
      amount: predicted,
      installment,
      startKey: schedule[0].dueKey,
      payoffKey: schedule[schedule.length - 1].dueKey,
      schedule
    };
  }

  return {
    getFundPower,
    projectFund,
    getMemberPosition,
    getAllMemberForecasts,
    computePriority,
    predictNextLoan
  };
})();