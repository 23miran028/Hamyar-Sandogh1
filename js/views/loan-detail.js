/* =========================================================
   views/loan-detail.js — جزئیات وام + جدول اقساط
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.loanDetail = function (root, state, opts = {}) {
  const U = App.Utils;
  const Engine = App.LoanEngine;
  const canWrite = App.AuthService.hasRole('admin', 'treasurer');
  const loanId = opts.id;

  (async () => {
    const loan = await App.LoanService.get(loanId);
    if (!loan) {
      App.UI.toast.error('وام یافت نشد');
      App.Boot.switchTab('loans');
      return;
    }

    const periods = state.months.map(m => ({ key: m.key, year: m.year, idx: m.idx }));
    const sum = Engine.summary(loan, periods);
    const lastPeriod = periods[periods.length - 1];

    root.innerHTML = `
      <div class="card">
        <div class="controls">
          <button class="btn plain" id="backBtn">← بازگشت به فهرست وام‌ها</button>
          <span class="spacer"></span>
          <button class="btn plain" id="memberBtn">👤 پروفایل عضو</button>
        </div>
        <div class="member-chip" style="font-size:14px">
          <span class="badge b">${U.esc(loan.memberCode)}</span>
          <span><b>${U.esc(loan.name)}</b></span>
          <span class="sep">•</span>
          <span class="muted">دوره شروع: ${U.esc(loan.startPeriodKey)}</span>
          <span class="sep">•</span>
          ${loan.status === 'active'
            ? '<span class="badge warn">جاری</span>'
            : '<span class="badge ok">تسویه‌شده</span>'}
        </div>
      </div>

      <div class="grid kpis" style="margin-bottom:16px">
        <div class="kpi g">
          <div class="lbl">مبلغ وام</div>
          <div class="val">${U.fmt(loan.amount)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="kpi o">
          <div class="lbl">قسط ماهانه</div>
          <div class="val">${U.fmt(loan.installment)}</div>
          <div class="sub">${U.toFa(Engine.COUNT)} قسط</div>
        </div>
        <div class="kpi r">
          <div class="lbl">باقیمانده</div>
          <div class="val">${U.fmt(loan.remaining)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="kpi">
          <div class="lbl">اقساط پرداخت‌شده</div>
          <div class="val">${U.toFa(sum.paid)} از ${U.toFa(Engine.COUNT)}</div>
          <div class="sub">جمع: ${U.fmt(sum.paidAmount)} تومان</div>
        </div>
        ${sum.overdue > 0 ? `
        <div class="kpi r">
          <div class="lbl">اقساط معوق</div>
          <div class="val">${U.toFa(sum.overdue)}</div>
          <div class="sub">جمع: ${U.fmt(sum.overdueAmount)} تومان</div>
        </div>` : ''}
        <div class="kpi">
          <div class="lbl">سررسید بعدی</div>
          <div class="val" style="font-size:15px">
            ${Engine.nextDuePeriod(loan, periods) || '—'}
          </div>
          <div class="sub">قسط بعدی</div>
        </div>
      </div>

      <div class="card">
        <h3><span class="dot"></span> جدول اقساط</h3>
        <div class="tbl-wrap" style="max-height:60vh">
          <table class="tbl">
            <thead><tr>
              <th>قسط</th>
              <th>دوره سررسید</th>
              <th>مبلغ</th>
              <th>وضعیت</th>
              ${canWrite && loan.status === 'active' ? '<th>عملیات</th>' : ''}
            </tr></thead>
            <tbody>
              ${sum.installments.map(ins => {
                const isPaid    = ins.status === 'paid';
                const isOverdue = ins.status === 'overdue';
                const isNext    = !isPaid && ins.status !== 'paid' &&
                  sum.installments.find(i => i.status !== 'paid')?.number === ins.number;

                const badge = isPaid
                  ? '<span class="badge ok">پرداخت‌شده</span>'
                  : isOverdue
                    ? '<span class="badge danger">معوق</span>'
                    : '<span class="badge mut">در انتظار</span>';

                const isCurrentPeriod = ins.duePeriodKey === lastPeriod?.key;

                return `<tr>
                  <td class="num">${U.toFa(ins.number)}</td>
                  <td>${U.esc(ins.duePeriodKey)}</td>
                  <td class="num">${U.fmt(ins.amount)}</td>
                  <td>${badge}</td>
                  ${canWrite && loan.status === 'active' ? `
                    <td class="actions">
                      ${!isPaid && (isOverdue || isNext)
                        ? `<button class="btn plain sm" data-pay="${ins.number}"
                                   data-period="${U.esc(ins.duePeriodKey)}"
                                   title="ثبت پرداخت این قسط">💵 پرداخت</button>`
                        : ''}
                    </td>` : ''}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3><span class="dot"></span> خلاصه مالی</h3>
        <table class="tbl">
          <tbody>
            <tr><td>مبلغ کل وام</td><td class="num">${U.fmt(loan.amount)} تومان</td></tr>
            <tr><td>جمع اقساط پرداخت‌شده</td><td class="num">${U.fmt(sum.paidAmount)} تومان</td></tr>
            <tr><td>جمع اقساط معوق</td><td class="num">${U.fmt(sum.overdueAmount)} تومان</td></tr>
            <tr><td>جمع اقساط در انتظار</td><td class="num">${U.fmt(sum.pendingAmount)} تومان</td></tr>
            <tr style="font-weight:800"><td>مانده قابل دریافت</td><td class="num">${U.fmt(loan.remaining)} تومان</td></tr>
          </tbody>
        </table>
      </div>`;

    root.querySelector('#backBtn').onclick = () => App.Boot.switchTab('loans');
    root.querySelector('#memberBtn').onclick = () =>
      App.Views.openMember(loan.memberCode, state);

    /* دکمه‌های پرداخت قسط */
    if (canWrite && loan.status === 'active') {
      root.querySelectorAll('button[data-pay]').forEach(b => {
        b.onclick = async (e) => {
          e.stopPropagation();
          const num = b.dataset.pay;
          const period = b.dataset.period;
          const ok = await App.UI.confirm.ask({
            title: 'ثبت پرداخت قسط',
            message: `قسط شماره ${U.toFa(num)} به مبلغ ${U.fmt(loan.installment)} تومان پرداخت شد؟`,
            details: `دوره: ${period}`,
            confirmText: 'ثبت پرداخت'
          });
          if (!ok) return;
          try {
            await App.LoanService.payInstallment(loan.id, period);
            App.UI.toast.success('قسط با موفقیت ثبت شد');
            App.Views.loanDetail(root, state, { id: loan.id });
          } catch (err) {
            App.UI.toast.error(err.message);
          }
        };
      });
    }
  })();
};