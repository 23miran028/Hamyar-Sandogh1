/* =========================================================
   services/report.service.js — موتور گزارش‌ها
   ========================================================= */
window.App = window.App || {};

App.ReportService = (function () {
  const U = App.Utils;
  const J = App.Jalali;
  const Repos = App.DataService.Repos;

  /* ---------- تاریخ امروز شمسی ---------- */
  function todayJalali() {
    const j = J.toJalali(new Date());
    return `${j.jd} ${J.monthNames[j.jm - 1]} ${j.jy}`;
  }

  /* ---------- هدر گزارش ---------- */
  function buildHeader(title, subtitle) {
    return `
      <div class="report-header">
        <div class="brand-block">
          <div class="brand-logo">ق</div>
          <div>
            <h1>صندوق قرض‌الحسنه</h1>
            <p class="subtitle">${U.esc(subtitle || 'سامانه مدیریت مالی')}</p>
          </div>
        </div>
        <div class="report-meta">
          <div>تاریخ گزارش: <b>${todayJalali()}</b></div>
          <div>ساعت: <b>${new Date().toLocaleTimeString('fa-IR')}</b></div>
          <div>تهیه‌کننده: <b>${U.esc(App.AuthService.getCurrentUser()?.displayName || '—')}</b></div>
        </div>
      </div>
      <div class="report-title">
        <h2>${U.esc(title)}</h2>
        ${subtitle ? `<div class="period">${U.esc(subtitle)}</div>` : ''}
      </div>
    `;
  }

  /* ---------- پاورقی ---------- */
  function buildFooter() {
    return `
      <div class="report-footer">
        <span>صندوق قرض‌الحسنه — سامانه مدیریت مالی</span>
        <span>این گزارش به‌صورت خودکار تولید شده است.</span>
      </div>
    `;
  }

  /* ---------- امضاها ---------- */
  function buildSignatures() {
    return `
      <div class="report-signatures">
        <div class="report-signature">
          <b>امضای مدیر</b>
        </div>
        <div class="report-signature">
          <b>امضای خزانه‌دار</b>
        </div>
      </div>
    `;
  }

  /* =========================================================
     گزارش ۱: کارنامه کامل عضو
     ========================================================= */
  async function buildMemberStatement(memberCode) {
    const member = await Repos.members.get(memberCode);
    if (!member) throw App.Err.NotFound('عضو یافت نشد');

    const [snaps, loans, periods] = await Promise.all([
      Repos.snapshots.byIndex('memberCode', memberCode),
      Repos.loans.byIndex('memberCode', memberCode),
      App.PeriodService.list()
    ]);

    const order = new Map(periods.map((p, i) => [p.key, i]));
    snaps.sort((a, b) => (order.get(a.periodKey) ?? 0) - (order.get(b.periodKey) ?? 0));
    loans.sort((a, b) => (a.startYear - b.startYear) || (a.startIdx - b.startIdx));

    const lastSnap = snaps[snaps.length - 1] || {};
    const totalDeposits = snaps.reduce((s, x) => s + U.num(x.deposit), 0);
    const totalInstallments = snaps.reduce((s, x) => s + U.num(x.installment), 0);
    const activeLoan = loans.find(l => l.status === 'active') || null;

    const loansRows = loans.map(l => {
      const status = l.status === 'active'
        ? '<span style="color:#d97706">جاری</span>'
        : '<span style="color:#15803d">تسویه‌شده</span>';
      return `<tr>
        <td>${U.esc(l.startPeriodKey || '—')}</td>
        <td class="num">${U.fmt(l.amount)}</td>
        <td class="num">${U.fmt(l.installment)}</td>
        <td class="num">${U.toFa(l.paid || 0)} از ۲۰</td>
        <td class="num">${U.fmt(l.remaining)}</td>
        <td>${status}</td>
      </tr>`;
    }).join('');

    const historyRows = snaps.map(s => `<tr>
      <td>${U.esc(s.periodKey)}</td>
      <td class="num">${U.fmt(s.deposit)}</td>
      <td class="num">${s.installment ? U.fmt(s.installment) : '—'}</td>
      <td class="num">${s.paidCount != null ? U.toFa(s.paidCount) : '—'}</td>
      <td class="num">${s.loan ? U.fmt(s.loan) : '—'}</td>
      <td class="num">${U.fmt(s.remaining)}</td>
      <td class="num">${U.fmt(s.totalCap)}</td>
    </tr>`).join('');

    const html = `
      ${buildHeader('کارنامه مالی عضو', `${member.name} (${member.code})`)}

      <div class="report-kpis">
        <div class="report-kpi ok">
          <div class="lbl">سرمایه کل</div>
          <div class="val">${U.fmt(lastSnap.totalCap)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi">
          <div class="lbl">جمع واریزها</div>
          <div class="val">${U.fmt(totalDeposits)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi">
          <div class="lbl">جمع اقساط پرداخت‌شده</div>
          <div class="val">${U.fmt(totalInstallments)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi ${activeLoan ? 'warn' : ''}">
          <div class="lbl">باقیمانده وام جاری</div>
          <div class="val">${U.fmt(lastSnap.remaining)}</div>
          <div class="sub">${activeLoan ? `${U.toFa(activeLoan.paid || 0)} از ۲۰ قسط` : 'بدون وام جاری'}</div>
        </div>
      </div>

      <div class="report-section">
        <h3>اطلاعات عضو</h3>
        <table class="report-table">
          <tbody>
            <tr><td style="width:30%">کد عضویت</td><td><b>${U.esc(member.code)}</b></td></tr>
            <tr><td>نام کامل</td><td><b>${U.esc(member.name)}</b></td></tr>
            <tr><td>وضعیت</td><td>${member.status === 'active' ? 'فعال' : 'غیرفعال'}</td></tr>
            <tr><td>شماره تماس</td><td>${U.esc(member.phone || '—')}</td></tr>
            <tr><td>تاریخ عضویت</td><td>${U.esc(member.joinedAt || '—')}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="report-section">
        <h3>سابقه وام‌ها (${U.toFa(loans.length)} فقره)</h3>
        ${loans.length ? `
        <table class="report-table">
          <thead>
            <tr>
              <th>دوره شروع</th>
              <th>مبلغ وام</th>
              <th>قسط ماهانه</th>
              <th>اقساط پرداخت‌شده</th>
              <th>باقیمانده</th>
              <th>وضعیت</th>
            </tr>
          </thead>
          <tbody>${loansRows}</tbody>
        </table>` : '<p style="color:#64748b">هیچ وامی ثبت نشده است.</p>'}
      </div>

      <div class="report-section">
        <h3>کارنامه ماه‌به‌ماه</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>دوره</th>
              <th>واریز</th>
              <th>قسط</th>
              <th>قسط‌ها</th>
              <th>وام</th>
              <th>باقیمانده</th>
              <th>سرمایه کل</th>
            </tr>
          </thead>
          <tbody>${historyRows}</tbody>
        </table>
      </div>

      ${buildSignatures()}
      ${buildFooter()}
    `;

    return {
      html,
      filename: `karname-${member.code}`,
      data: {
        headers: ['دوره', 'واریز', 'قسط', 'قسط‌ها', 'وام', 'باقیمانده', 'سرمایه کل'],
        rows: snaps.map(s => [
          s.periodKey,
          Math.round(U.num(s.deposit) / 10),
          Math.round(U.num(s.installment) / 10),
          s.paidCount != null ? s.paidCount : '',
          Math.round(U.num(s.loan) / 10),
          Math.round(U.num(s.remaining) / 10),
          Math.round(U.num(s.totalCap) / 10)
        ]),
        meta: {
          'نام': member.name,
          'کد': member.code,
          'جمع واریز': Math.round(totalDeposits / 10),
          'جمع اقساط': Math.round(totalInstallments / 10),
          'باقیمانده': Math.round(U.num(lastSnap.remaining) / 10)
        }
      }
    };
  }

  /* =========================================================
     گزارش ۲: صورت‌جلسه ماهانه
     ========================================================= */
  async function buildMeetingMinutes(periodKey) {
    const period = await Repos.periods.get(periodKey);
    if (!period) throw App.Err.NotFound('دوره یافت نشد');

    const snaps = await Repos.snapshots.byIndex('periodKey', periodKey);

    const byMember = new Map();
    const members = await Repos.members.all();
    members.forEach(m => byMember.set(m.code, m));

    snaps.sort((a, b) => (a.rowNo || 0) - (b.rowNo || 0));

    const totalDeposit = snaps.reduce((s, x) => s + U.num(x.deposit), 0);
    const totalInstallment = snaps.reduce((s, x) => s + U.num(x.installment), 0);
    const totalLoan = snaps.reduce((s, x) => s + U.num(x.loan), 0);
    const totalRemaining = snaps.reduce((s, x) => s + U.num(x.remaining), 0);
    const totalCap = snaps[0] ? U.num(snaps[0].totalCap) : 0;

    const rows = snaps.map(s => {
      const m = byMember.get(s.memberCode);
      return `<tr>
        <td class="num">${U.toFa(s.rowNo || '')}</td>
        <td class="num">${U.esc(s.memberCode)}</td>
        <td>${U.esc(m?.name || '—')}</td>
        <td class="num">${U.fmt(s.deposit)}</td>
        <td class="num">${s.installment ? U.fmt(s.installment) : '—'}</td>
        <td class="num">${s.paidCount != null ? U.toFa(s.paidCount) : '—'}</td>
        <td class="num">${s.loan ? U.fmt(s.loan) : '—'}</td>
        <td class="num">${U.fmt(s.remaining)}</td>
      </tr>`;
    }).join('');

    /* وام پرداخت‌شده این ماه */
    const newLoans = snaps.filter(s => U.num(s.loan) > 0);
    const newLoanNames = newLoans.map(s => byMember.get(s.memberCode)?.name).filter(Boolean).join('، ');

    const html = `
      ${buildHeader('صورت‌جلسه ماهانه صندوق', `${period.name} ${U.toFa(period.year)}`)}

      <div class="report-note">
        📌 در جلسه این ماه، صندوق دارای <b>${U.toFa(snaps.length)}</b> عضو فعال است.
        جمع سرمایه کل صندوق به <b>${U.fmt(totalCap)}</b> تومان رسید.
        ${newLoans.length
          ? `در این ماه به <b>${U.esc(newLoanNames)}</b> وام پرداخت شد.`
          : 'در این ماه وام جدیدی پرداخت نشد.'}
      </div>

      <div class="report-kpis">
        <div class="report-kpi ok">
          <div class="lbl">سرمایه کل صندوق</div>
          <div class="val">${U.fmt(totalCap)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi">
          <div class="lbl">جمع واریز این ماه</div>
          <div class="val">${U.fmt(totalDeposit)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi">
          <div class="lbl">جمع اقساط دریافتی</div>
          <div class="val">${U.fmt(totalInstallment)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi ${newLoans.length ? 'warn' : ''}">
          <div class="lbl">وام پرداخت‌شده</div>
          <div class="val">${totalLoan ? U.fmt(totalLoan) : '—'}</div>
          <div class="sub">${newLoans.length ? `${U.toFa(newLoans.length)} فقره` : 'بدون وام'}</div>
        </div>
        <div class="report-kpi">
          <div class="lbl">باقیمانده وام‌ها</div>
          <div class="val">${U.fmt(totalRemaining)}</div>
          <div class="sub">تومان</div>
        </div>
      </div>

      <div class="report-section">
        <h3>ریز حساب اعضا</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>ردیف</th>
              <th>کد</th>
              <th>نام</th>
              <th>واریز</th>
              <th>قسط</th>
              <th>قسط‌ها</th>
              <th>وام</th>
              <th>باقیمانده</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="3">جمع کل</td>
              <td class="num">${U.fmt(totalDeposit)}</td>
              <td class="num">${U.fmt(totalInstallment)}</td>
              <td class="num">—</td>
              <td class="num">${U.fmt(totalLoan)}</td>
              <td class="num">${U.fmt(totalRemaining)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${buildSignatures()}
      ${buildFooter()}
    `;

    return {
      html,
      filename: `soorat-jalase-${period.year}-${period.idx + 1}`,
      data: {
        headers: ['ردیف', 'کد', 'نام', 'واریز', 'قسط', 'قسط‌ها', 'وام', 'باقیمانده'],
        rows: snaps.map(s => [
          s.rowNo || '',
          s.memberCode,
          byMember.get(s.memberCode)?.name || '',
          Math.round(U.num(s.deposit) / 10),
          Math.round(U.num(s.installment) / 10),
          s.paidCount != null ? s.paidCount : '',
          Math.round(U.num(s.loan) / 10),
          Math.round(U.num(s.remaining) / 10)
        ]),
        meta: {
          'دوره': `${period.name} ${period.year}`,
          'سرمایه کل': Math.round(totalCap / 10),
          'جمع واریز': Math.round(totalDeposit / 10),
          'جمع اقساط': Math.round(totalInstallment / 10),
          'باقیمانده': Math.round(totalRemaining / 10)
        }
      }
    };
  }

  /* =========================================================
     گزارش ۳: وام‌های جاری
     ========================================================= */
  async function buildActiveLoans() {
    const loans = await App.LoanService.listActive();
    const periods = await App.PeriodService.list();
    const members = await Repos.members.all();
    const byCode = new Map(members.map(m => [m.code, m]));

    loans.sort((a, b) => (a.startYear - b.startYear) || (a.startIdx - b.startIdx));

    const totalAmount = loans.reduce((s, l) => s + U.num(l.amount), 0);
    const totalRemaining = loans.reduce((s, l) => s + U.num(l.remaining), 0);
    const totalInstallment = loans.reduce((s, l) => s + U.num(l.installment), 0);

    const rows = loans.map((l, i) => {
      const paid = U.num(l.paid);
      const remainCount = Math.max(0, 20 - paid);
      const member = byCode.get(l.memberCode);
      return `<tr>
        <td class="num">${U.toFa(i + 1)}</td>
        <td class="num">${U.esc(l.memberCode)}</td>
        <td>${U.esc(member?.name || l.name || '—')}</td>
        <td>${U.esc(l.startPeriodKey || '—')}</td>
        <td class="num">${U.fmt(l.amount)}</td>
        <td class="num">${U.fmt(l.installment)}</td>
        <td class="num">${U.toFa(paid)} از ۲۰</td>
        <td class="num">${U.fmt(l.remaining)}</td>
        <td class="num">${U.toFa(remainCount)} ماه</td>
      </tr>`;
    }).join('');

    const html = `
      ${buildHeader('گزارش وام‌های جاری', `تعداد: ${U.toFa(loans.length)} فقره`)}

      <div class="report-kpis">
        <div class="report-kpi">
          <div class="lbl">تعداد وام‌های فعال</div>
          <div class="val">${U.toFa(loans.length)}</div>
          <div class="sub">فقره</div>
        </div>
        <div class="report-kpi ok">
          <div class="lbl">جمع اصل وام‌ها</div>
          <div class="val">${U.fmt(totalAmount)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi warn">
          <div class="lbl">جمع باقیمانده</div>
          <div class="val">${U.fmt(totalRemaining)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi">
          <div class="lbl">قسط ماهانه کل</div>
          <div class="val">${U.fmt(totalInstallment)}</div>
          <div class="sub">تومان</div>
        </div>
      </div>

      <div class="report-section">
        <h3>فهرست تفصیلی</h3>
        ${loans.length ? `
        <table class="report-table">
          <thead>
            <tr>
              <th>#</th>
              <th>کد</th>
              <th>نام وام‌گیرنده</th>
              <th>شروع</th>
              <th>مبلغ</th>
              <th>قسط</th>
              <th>پرداخت‌شده</th>
              <th>باقیمانده</th>
              <th>مانده (ماه)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="4">جمع کل</td>
              <td class="num">${U.fmt(totalAmount)}</td>
              <td class="num">${U.fmt(totalInstallment)}</td>
              <td class="num">—</td>
              <td class="num">${U.fmt(totalRemaining)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>` : '<p style="color:#64748b">هیچ وام جاری‌ای وجود ندارد.</p>'}
      </div>

      ${buildFooter()}
    `;

    return {
      html,
      filename: 'active-loans',
      data: {
        headers: ['#', 'کد', 'نام', 'شروع', 'مبلغ', 'قسط', 'پرداخت‌شده', 'باقیمانده', 'مانده (ماه)'],
        rows: loans.map((l, i) => [
          i + 1,
          l.memberCode,
          byCode.get(l.memberCode)?.name || l.name || '',
          l.startPeriodKey || '',
          Math.round(U.num(l.amount) / 10),
          Math.round(U.num(l.installment) / 10),
          `${l.paid || 0} از 20`,
          Math.round(U.num(l.remaining) / 10),
          Math.max(0, 20 - U.num(l.paid))
        ]),
        meta: {
          'تعداد': loans.length,
          'جمع اصل': Math.round(totalAmount / 10),
          'جمع باقیمانده': Math.round(totalRemaining / 10)
        }
      }
    };
  }

  /* =========================================================
     گزارش ۴: اقساط معوق
     ========================================================= */
  async function buildOverdue() {
    const loans = await App.LoanService.listActive();
    const periods = await App.PeriodService.list();
    const members = await Repos.members.all();
    const byCode = new Map(members.map(m => [m.code, m]));
    const order = new Map(periods.map((p, i) => [p.key, i]));
    const currentIdx = periods.length - 1;

    const overdueItems = [];

    for (const loan of loans) {
      const startIdx = order.get(loan.startPeriodKey);
      if (startIdx == null) continue;

      const paid = U.num(loan.paid);
      const installment = U.num(loan.installment);
      const member = byCode.get(loan.memberCode);

      for (let k = 1; k <= 20; k++) {
        const dueIdx = startIdx + k;
        if (dueIdx > currentIdx) break;   // سررسید نشده
        if (k <= paid) continue;           // پرداخت شده
        const period = periods[dueIdx];
        overdueItems.push({
          memberCode: loan.memberCode,
          memberName: member?.name || loan.name,
          loanId: loan.id,
          loanAmount: loan.amount,
          installmentNumber: k,
          duePeriod: period.key,
          dueYear: period.year,
          dueIdx: period.idx,
          amount: installment,
          monthsLate: currentIdx - dueIdx
        });
      }
    }

    overdueItems.sort((a, b) => b.monthsLate - a.monthsLate);

    const totalOverdue = overdueItems.reduce((s, x) => s + x.amount, 0);
    const uniqueMembers = new Set(overdueItems.map(x => x.memberCode)).size;

    const rows = overdueItems.map((x, i) => `<tr>
      <td class="num">${U.toFa(i + 1)}</td>
      <td class="num">${U.esc(x.memberCode)}</td>
      <td>${U.esc(x.memberName)}</td>
      <td class="num">${U.toFa(x.installmentNumber)}</td>
      <td>${U.esc(x.duePeriod)}</td>
      <td class="num" style="color:#dc2626"><b>${U.toFa(x.monthsLate)} ماه</b></td>
      <td class="num">${U.fmt(x.amount)}</td>
    </tr>`).join('');

    const html = `
      ${buildHeader('گزارش اقساط معوق', `تعداد: ${U.toFa(overdueItems.length)} قسط معوق`)}

      <div class="report-kpis">
        <div class="report-kpi danger">
          <div class="lbl">اقساط معوق</div>
          <div class="val">${U.toFa(overdueItems.length)}</div>
          <div class="sub">قسط</div>
        </div>
        <div class="report-kpi warn">
          <div class="lbl">اعضای بدهکار</div>
          <div class="val">${U.toFa(uniqueMembers)}</div>
          <div class="sub">نفر</div>
        </div>
        <div class="report-kpi danger">
          <div class="lbl">جمع مبلغ معوق</div>
          <div class="val">${U.fmt(totalOverdue)}</div>
          <div class="sub">تومان</div>
        </div>
      </div>

      ${overdueItems.length ? `
      <div class="report-section">
        <h3>فهرست اقساط معوق</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>#</th>
              <th>کد</th>
              <th>نام</th>
              <th>شماره قسط</th>
              <th>دوره سررسید</th>
              <th>تأخیر</th>
              <th>مبلغ</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="6">جمع کل</td>
              <td class="num">${U.fmt(totalOverdue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>` : `
        <div class="report-note" style="background:#f0fdf4;border-color:#86efac;color:#15803d">
          ✅ هیچ قسط معوقی وجود ندارد. همه اعضا به‌موقع پرداخت کرده‌اند.
        </div>
      `}

      ${buildFooter()}
    `;

    return {
      html,
      filename: 'overdue-installments',
      data: {
        headers: ['#', 'کد', 'نام', 'شماره قسط', 'دوره سررسید', 'تأخیر (ماه)', 'مبلغ'],
        rows: overdueItems.map((x, i) => [
          i + 1, x.memberCode, x.memberName,
          x.installmentNumber, x.duePeriod, x.monthsLate,
          Math.round(x.amount / 10)
        ]),
        meta: {
          'تعداد': overdueItems.length,
          'اعضای بدهکار': uniqueMembers,
          'جمع معوق': Math.round(totalOverdue / 10)
        }
      }
    };
  }

  /* =========================================================
     گزارش ۵: ترازنامه صندوق
     ========================================================= */
  async function buildBalanceSheet() {
    const periods = await App.PeriodService.list();
    if (!periods.length) throw App.Err.NotFound('دوره‌ای وجود ندارد');

    const last = periods[periods.length - 1];
    const snaps = await Repos.snapshots.byIndex('periodKey', last.key);
    const loans = await Repos.loans.all();
    const members = await Repos.members.all();

    const activeMembers = members.filter(m => m.status === 'active');
    const activeLoans = loans.filter(l => l.status === 'active');

    const totalCapital = snaps.reduce((s, x) => s + U.num(x.totalCap), 0);
    const totalDeposits = snaps.reduce((s, x) => s + U.num(x.deposit), 0);
    const outstandingLoans = activeLoans.reduce((s, l) => s + U.num(l.remaining), 0);
    const availableCash = Math.max(0, totalCapital - outstandingLoans);

    /* جمع واریزی‌های کل (تمام تاریخچه) */
    const allSnaps = await Repos.snapshots.all();
    const totalEverDeposited = allSnaps.reduce((s, x) => s + U.num(x.deposit), 0);
    const totalEverLoaned = loans.reduce((s, l) => s + U.num(l.amount), 0);
    const totalRepaid = loans.reduce((s, l) =>
      s + U.num(l.paid) * U.num(l.installment), 0);

    const html = `
      ${buildHeader('ترازنامه صندوق', `تا پایان ${last.name} ${U.toFa(last.year)}`)}

      <div class="report-kpis">
        <div class="report-kpi ok">
          <div class="lbl">سرمایه کل صندوق</div>
          <div class="val">${U.fmt(totalCapital)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi warn">
          <div class="lbl">مطالبات (وام‌ها)</div>
          <div class="val">${U.fmt(outstandingLoans)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi">
          <div class="lbl">موجودی نقدی</div>
          <div class="val">${U.fmt(availableCash)}</div>
          <div class="sub">تومان</div>
        </div>
      </div>

      <div class="report-section">
        <h3>دارایی‌ها</h3>
        <table class="report-table">
          <thead>
            <tr><th>شرح</th><th>مبلغ (تومان)</th></tr>
          </thead>
          <tbody>
            <tr><td>موجودی نقدی</td><td class="num">${U.fmt(availableCash)}</td></tr>
            <tr><td>مطالبات از اعضا (وام‌های جاری)</td><td class="num">${U.fmt(outstandingLoans)}</td></tr>
          </tbody>
          <tfoot>
            <tr><td><b>جمع دارایی‌ها</b></td><td class="num"><b>${U.fmt(totalCapital)}</b></td></tr>
          </tfoot>
        </table>
      </div>

      <div class="report-section">
        <h3>حقوق اعضا</h3>
        <table class="report-table">
          <thead>
            <tr><th>شرح</th><th>مبلغ (تومان)</th></tr>
          </thead>
          <tbody>
            <tr><td>سرمایه اعضا (واریزی‌ها)</td><td class="num">${U.fmt(totalCapital)}</td></tr>
          </tbody>
          <tfoot>
            <tr><td><b>جمع حقوق اعضا</b></td><td class="num"><b>${U.fmt(totalCapital)}</b></td></tr>
          </tfoot>
        </table>
      </div>

      <div class="report-section">
        <h3>آمار کل (از ابتدا تا کنون)</h3>
        <table class="report-table">
          <tbody>
            <tr><td>تعداد اعضای فعال</td><td class="num">${U.toFa(activeMembers.length)} نفر</td></tr>
            <tr><td>تعداد وام‌های پرداخت‌شده</td><td class="num">${U.toFa(loans.length)} فقره</td></tr>
            <tr><td>تعداد وام‌های جاری</td><td class="num">${U.toFa(activeLoans.length)} فقره</td></tr>
            <tr><td>جمع کل واریزی‌های اعضا (تاریخی)</td><td class="num">${U.fmt(totalEverDeposited)}</td></tr>
            <tr><td>جمع کل وام‌های پرداخت‌شده (تاریخی)</td><td class="num">${U.fmt(totalEverLoaned)}</td></tr>
            <tr><td>جمع کل اقساط دریافت‌شده (تاریخی)</td><td class="num">${U.fmt(totalRepaid)}</td></tr>
          </tbody>
        </table>
      </div>

      ${buildSignatures()}
      ${buildFooter()}
    `;

    return {
      html,
      filename: 'balance-sheet',
      data: {
        headers: ['شرح', 'مبلغ (تومان)'],
        rows: [
          ['موجودی نقدی', Math.round(availableCash / 10)],
          ['مطالبات', Math.round(outstandingLoans / 10)],
          ['جمع دارایی‌ها', Math.round(totalCapital / 10)],
          ['حقوق اعضا', Math.round(totalCapital / 10)],
          ['جمع کل واریزی‌ها', Math.round(totalEverDeposited / 10)],
          ['جمع کل وام‌ها', Math.round(totalEverLoaned / 10)],
          ['جمع اقساط دریافتی', Math.round(totalRepaid / 10)]
        ],
        meta: {
          'دوره': `${last.name} ${last.year}`,
          'سرمایه کل': Math.round(totalCapital / 10),
          'مطالبات': Math.round(outstandingLoans / 10),
          'موجودی نقدی': Math.round(availableCash / 10)
        }
      }
    };
  }

  /* =========================================================
     گزارش ۶: فهرست اعضا
     ========================================================= */
  async function buildMembersList() {
    const members = await App.MemberService.listWithStats();

    const active = members.filter(m => m.status === 'active');
    const inactive = members.filter(m => m.status === 'inactive');

    const rows = members.map((m, i) => `<tr>
      <td class="num">${U.toFa(i + 1)}</td>
      <td class="num">${U.esc(m.code)}</td>
      <td>${U.esc(m.name)}</td>
      <td>${m.status === 'active' ? 'فعال' : 'غیرفعال'}</td>
      <td class="num">${U.fmt(m.totalCap)}</td>
      <td class="num">${m.activeLoan ? U.fmt(m.activeLoan.amount) : '—'}</td>
      <td class="num">${U.fmt(m.remaining)}</td>
      <td class="num">${U.toFa(m.loansCount)}</td>
    </tr>`).join('');

    const html = `
      ${buildHeader('فهرست اعضای صندوق', `جمع: ${U.toFa(members.length)} نفر`)}

      <div class="report-kpis">
        <div class="report-kpi ok">
          <div class="lbl">اعضای فعال</div>
          <div class="val">${U.toFa(active.length)}</div>
          <div class="sub">نفر</div>
        </div>
        <div class="report-kpi">
          <div class="lbl">اعضای غیرفعال</div>
          <div class="val">${U.toFa(inactive.length)}</div>
          <div class="sub">نفر</div>
        </div>
        <div class="report-kpi">
          <div class="lbl">جمع سرمایه</div>
          <div class="val">${U.fmt(members.reduce((s, m) => s + U.num(m.totalCap), 0))}</div>
          <div class="sub">تومان</div>
        </div>
      </div>

      <div class="report-section">
        <h3>فهرست کامل اعضا</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>#</th>
              <th>کد</th>
              <th>نام</th>
              <th>وضعیت</th>
              <th>سرمایه</th>
              <th>وام جاری</th>
              <th>باقیمانده</th>
              <th># وام</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      ${buildSignatures()}
      ${buildFooter()}
    `;

    return {
      html,
      filename: 'members-list',
      data: {
        headers: ['#', 'کد', 'نام', 'وضعیت', 'سرمایه', 'وام جاری', 'باقیمانده', '# وام'],
        rows: members.map((m, i) => [
          i + 1, m.code, m.name,
          m.status === 'active' ? 'فعال' : 'غیرفعال',
          Math.round(U.num(m.totalCap) / 10),
          m.activeLoan ? Math.round(U.num(m.activeLoan.amount) / 10) : '',
          Math.round(U.num(m.remaining) / 10),
          m.loansCount
        ]),
        meta: {
          'جمع اعضا': members.length,
          'فعال': active.length,
          'غیرفعال': inactive.length
        }
      }
    };
  }

  /* =========================================================
     گزارش ۷: خلاصه سالانه
     ========================================================= */
  async function buildYearlySummary(year) {
    const allPeriods = await App.PeriodService.list();
    const yearPeriods = allPeriods.filter(p => p.year === Number(year));
    if (!yearPeriods.length) throw App.Err.NotFound('داده‌ای برای این سال موجود نیست');

    const allSnaps = [];
    for (const p of yearPeriods) {
      const snaps = await Repos.snapshots.byIndex('periodKey', p.key);
      snaps.forEach(s => allSnaps.push({ ...s, periodKey: p.key }));
    }

    const totalDeposits = allSnaps.reduce((s, x) => s + U.num(x.deposit), 0);
    const totalInstallments = allSnaps.reduce((s, x) => s + U.num(x.installment), 0);
    const totalLoans = allSnaps.reduce((s, x) => s + U.num(x.loan), 0);

    const lastPeriod = yearPeriods[yearPeriods.length - 1];
    const lastSnaps = await Repos.snapshots.byIndex('periodKey', lastPeriod.key);
    const finalCapital = lastSnaps[0] ? U.num(lastSnaps[0].totalCap) : 0;

    /* گروه‌بندی وام‌ها بر اساس دوره */
    const loansByPeriod = new Map();
    allSnaps.forEach(s => {
      if (U.num(s.loan) > 0) {
        if (!loansByPeriod.has(s.periodKey)) loansByPeriod.set(s.periodKey, []);
        loansByPeriod.get(s.periodKey).push(s);
      }
    });

    const periodRows = yearPeriods.map(p => {
      const snaps = allSnaps.filter(x => x.periodKey === p.key);
      const deposit = snaps.reduce((s, x) => s + U.num(x.deposit), 0);
      const inst = snaps.reduce((s, x) => s + U.num(x.installment), 0);
      const loan = snaps.reduce((s, x) => s + U.num(x.loan), 0);
      return `<tr>
        <td>${U.esc(p.name)}</td>
        <td class="num">${U.fmt(deposit)}</td>
        <td class="num">${U.fmt(inst)}</td>
        <td class="num">${loan ? U.fmt(loan) : '—'}</td>
        <td class="num">${U.fmt(snaps[0]?.totalCap)}</td>
      </tr>`;
    }).join('');

    const html = `
      ${buildHeader('خلاصه عملکرد سالانه', `سال ${U.toFa(year)}`)}

      <div class="report-kpis">
        <div class="report-kpi">
          <div class="lbl">جمع واریزهای سال</div>
          <div class="val">${U.fmt(totalDeposits)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi">
          <div class="lbl">جمع اقساط دریافتی</div>
          <div class="val">${U.fmt(totalInstallments)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi warn">
          <div class="lbl">وام‌های پرداخت‌شده</div>
          <div class="val">${totalLoans ? U.fmt(totalLoans) : '—'}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="report-kpi ok">
          <div class="lbl">سرمایه پایان سال</div>
          <div class="val">${U.fmt(finalCapital)}</div>
          <div class="sub">تومان</div>
        </div>
      </div>

      <div class="report-section">
        <h3>عملکرد ماه‌به‌ماه سال ${U.toFa(year)}</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>ماه</th>
              <th>واریزها</th>
              <th>اقساط</th>
              <th>وام</th>
              <th>سرمایه کل</th>
            </tr>
          </thead>
          <tbody>${periodRows}</tbody>
          <tfoot>
            <tr>
              <td>جمع سال</td>
              <td class="num">${U.fmt(totalDeposits)}</td>
              <td class="num">${U.fmt(totalInstallments)}</td>
              <td class="num">${U.fmt(totalLoans)}</td>
              <td class="num">${U.fmt(finalCapital)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${loansByPeriod.size ? `
      <div class="report-section">
        <h3>وام‌های پرداخت‌شده در سال ${U.toFa(year)}</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>دوره</th>
              <th>کد</th>
              <th>نام وام‌گیرنده</th>
              <th>مبلغ وام</th>
            </tr>
          </thead>
          <tbody>
            ${[...loansByPeriod.entries()].map(([pKey, items]) =>
              items.map((s, i) => `<tr>
                <td>${U.esc(pKey)}</td>
                <td class="num">${U.esc(s.memberCode)}</td>
                <td>${U.esc(s.name || '—')}</td>
                <td class="num">${U.fmt(s.loan)}</td>
              </tr>`).join('')
            ).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${buildSignatures()}
      ${buildFooter()}
    `;

    return {
      html,
      filename: `yearly-summary-${year}`,
      data: {
        headers: ['ماه', 'واریزها', 'اقساط', 'وام', 'سرمایه کل'],
        rows: yearPeriods.map(p => {
          const snaps = allSnaps.filter(x => x.periodKey === p.key);
          return [
            p.name,
            Math.round(snaps.reduce((s, x) => s + U.num(x.deposit), 0) / 10),
            Math.round(snaps.reduce((s, x) => s + U.num(x.installment), 0) / 10),
            Math.round(snaps.reduce((s, x) => s + U.num(x.loan), 0) / 10),
            Math.round(U.num(snaps[0]?.totalCap) / 10)
          ];
        }),
        meta: {
          'سال': year,
          'جمع واریز': Math.round(totalDeposits / 10),
          'جمع اقساط': Math.round(totalInstallments / 10),
          'جمع وام': Math.round(totalLoans / 10),
          'سرمایه پایان سال': Math.round(finalCapital / 10)
        }
      }
    };
  }

  /* =========================================================
     ساخت گزارش بر اساس نوع
     ========================================================= */
  async function build(type, params = {}) {
    switch (type) {
      case 'member-statement': return buildMemberStatement(params.memberCode);
      case 'meeting-minutes':  return buildMeetingMinutes(params.periodKey);
      case 'active-loans':     return buildActiveLoans();
      case 'overdue':          return buildOverdue();
      case 'balance-sheet':    return buildBalanceSheet();
      case 'members-list':     return buildMembersList();
      case 'yearly-summary':   return buildYearlySummary(params.year);
      default: throw App.Err.Validation('نوع گزارش ناشناخته: ' + type);
    }
  }

  /* =========================================================
     خروجی Excel (.xls)
     ========================================================= */
  function exportExcel(report) {
    if (!report?.data) throw App.Err.Validation('گزارش معتبر نیست');

    const { headers, rows, meta } = report.data;

    const escape = (v) => String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    let html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel">';
    html += '<head><meta charset="UTF-8"><style>';
    html += 'table{border-collapse:collapse}';
    html += 'th,td{border:1px solid #999;padding:6px 10px;font-family:Tahoma;font-size:12px;text-align:right}';
    html += 'th{background:#e2e8f0;font-weight:bold}';
    html += 'td.num{text-align:center}';
    html += 'h1{font-family:Tahoma;font-size:16px;color:#0e7490}';
    html += 'h2{font-family:Tahoma;font-size:13px;color:#0f172a}';
    html += '</style></head><body>';

    html += `<h1>صندوق قرض‌الحسنه</h1>`;
    html += `<h2>تاریخ: ${todayJalali()} — تهیه‌کننده: ${escape(App.AuthService.getCurrentUser()?.displayName || '—')}</h2>`;

    if (meta) {
      html += '<table style="margin-bottom:12px">';
      Object.entries(meta).forEach(([k, v]) => {
        html += `<tr><th>${escape(k)}</th><td>${escape(v)}</td></tr>`;
      });
      html += '</table>';
    }

    html += '<table>';
    html += '<thead><tr>';
    headers.forEach(h => html += `<th>${escape(h)}</th>`);
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        const isNum = typeof cell === 'number';
        html += `<td class="${isNum ? 'num' : ''}">${escape(cell)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></body></html>';

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    U.download(blob, `${report.filename}.xls`);
  }

  /* =========================================================
     خروجی CSV
     ========================================================= */
  function exportCSV(report) {
    if (!report?.data) throw App.Err.Validation('گزارش معتبر نیست');
    const { headers, rows } = report.data;
    U.exportCSV(`${report.filename}.csv`, headers, rows);
  }

  /* =========================================================
     چاپ
     ========================================================= */
  function print() {
    window.print();
  }

  return { build, exportExcel, exportCSV, print };
})();