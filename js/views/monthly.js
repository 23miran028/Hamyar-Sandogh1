/* =========================================================
   views/monthly.js — گزارش ماهانه (نسخه ۳)
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.monthly = function (root, state) {
  const U = App.Utils;
  const canWrite = App.AuthService.hasRole('admin', 'treasurer');

  const ms = state.months;
  if (!ms.length) {
    root.innerHTML = '<div class="card"><div class="empty">داده‌ای موجود نیست.</div></div>';
    return;
  }

  const idx = Math.min(Math.max(state.monthIdx ?? ms.length - 1, 0), ms.length - 1);
  const m = ms[idx];

  const ky = state.years.find(y => Number(y.year) === m.year);
  const km = ky ? ky.rows.find(r => r.month === m.name) : null;

  const rows = m.data;
  const totals = m.totals;

  root.innerHTML = `
    <div class="card">
      <div class="controls">
        <label style="font-weight:700">انتخاب دوره:</label>
        <select id="mSel">
          ${ms.map((x, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${U.monthLabel(x)}</option>`).join('')}
        </select>
        <span class="spacer"></span>
        <button class="btn plain sm" id="expBtn">⬇️ خروجی CSV</button>
      </div>

      <div class="grid kpis" style="margin-bottom:16px">
        <div class="kpi"><div class="lbl">سرمایه کل</div>
          <div class="val">${U.fmt(totals.totalCap)}</div><div class="sub">تومان</div></div>
        <div class="kpi g"><div class="lbl">واریز سرمایه</div>
          <div class="val">${U.fmt(totals.deposit)}</div><div class="sub">تومان</div></div>
        <div class="kpi o"><div class="lbl">اقساط دریافتی</div>
          <div class="val">${U.fmt(totals.installment)}</div><div class="sub">تومان</div></div>
        <div class="kpi r"><div class="lbl">باقیمانده وام‌ها</div>
          <div class="val">${U.fmt(totals.remaining)}</div><div class="sub">تومان</div></div>
        </div>

      ${km ? `<div style="background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:14px">
        <b>اطلاعات تکمیلی:</b>
        ${km.loansPaid ? ` وام به <b>${U.esc(km.name || '—')}</b> به مبلغ <b>${U.fmt(km.loansPaid)}</b> تومان.` : ' وام جدیدی پرداخت نشده.'}
        ${km.available ? ` موجودی: <b>${U.fmt(km.available)}</b> تومان.` : ''}
      </div>` : ''}

      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr>
            <th>ردیف</th><th>کد</th><th>نام</th><th>سرمایه کل</th><th>واریز</th>
            <th>وام</th><th>قسط</th><th>قسط‌ها</th>
            <th>باقیمانده</th><th>سرمایه+قسط</th>
            ${canWrite ? '<th>عملیات</th>' : ''}
          </tr></thead>
          <tbody id="mTbody">
            ${rows.map(r => `
              <tr>
                <td class="num">${U.toFa(r.rowNo || '')}</td>
                <td><span class="badge b">${U.esc(r.code)}</span></td>
                <td>${U.esc(r.name)}</td>
                <td class="num">${U.fmt(r.totalCap)}</td>
                <td class="num">${U.fmt(r.deposit)}</td>
                <td class="num">${r.loan ? U.fmt(r.loan) : '—'}</td>
                <td class="num">${r.installment ? U.fmt(r.installment) : '—'}</td>
                <td class="num">${r.paidCount != null ? U.toFa(r.paidCount) : '—'}</td>
                <td class="num">${U.fmt(r.remaining)}</td>
                <td class="num">${U.fmt(r.capInst)}</td>
                ${canWrite ? `<td class="actions">
                  <button class="btn plain sm" data-txn="${U.esc(r.code)}" title="ثبت/ویرایش">✏️</button>
                </td>` : ''}
              </tr>`).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="3">جمع کل</td>
            <td class="num">${U.fmt(totals.totalCap)}</td>
            <td class="num">${U.fmt(totals.deposit)}</td>
            <td class="num">${U.fmt(rows.reduce((s, r) => s + r.loan, 0))}</td>
            <td class="num">${U.fmt(totals.installment)}</td>
            <td class="num">—</td>
            <td class="num">${U.fmt(totals.remaining)}</td>
            <td class="num">${U.fmt(totals.capInst)}</td>
            ${canWrite ? '<td></td>' : ''}
          </tr></tfoot>
        </table>
      </div>
    </div>`;

  root.querySelector('#mSel').onchange = e => {
    state.monthIdx = +e.target.value;
    App.Views.monthly(root, state);
  };

  root.querySelector('#expBtn').onclick = () => {
    U.exportCSV(`gozaresh-${m.year}-${m.name}.csv`,
      ['ردیف', 'کد', 'نام', 'سرمایه کل', 'واریز', 'وام', 'قسط', 'قسط‌ها', 'باقیمانده', 'سرمایه+قسط'],
      rows.map(r => [r.rowNo, r.code, r.name, r.totalCap, r.deposit, r.loan, r.installment, r.paidCount, r.remaining, r.capInst]));
  };

  /* فقط یک event listener روی tbody */
  if (canWrite) {
    root.querySelector('#mTbody').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-txn]');
      if (!btn) return;
      e.stopPropagation();
      App.Views.txnEdit(root, state, {
        periodKey: m.key,
        memberCode: btn.dataset.txn
      });
    });
  }
};