/* =========================================================
   views/loans.js — فهرست وام‌ها (فاز ۴)
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.loans = function (root, state) {
  const U = App.Utils;
  const Auth = App.AuthService;
  const canWrite = Auth.hasRole('admin', 'treasurer');

  const loans = Array.isArray(state.loans) ? state.loans : [];
  const reversed = loans.slice().reverse();
  const total = loans.reduce((s, l) => s + (l.amount || 0), 0);
  const active = loans.filter(l => l.status === 'active');
  const activeTotal = active.reduce((s, l) => s + (l.amount || 0), 0);
  const activeRemaining = active.reduce((s, l) => s + (l.remaining || 0), 0);
  const settledCount = loans.filter(l => l.status === 'settled').length;

  root.innerHTML = `
    <div class="grid kpis" style="margin-bottom:16px">
      <div class="kpi">
        <div class="lbl">تعداد کل وام‌ها</div>
        <div class="val">${U.toFa(loans.length)}</div>
        <div class="sub">فقره • هر وام ۲۰ قسط</div>
      </div>
      <div class="kpi g">
        <div class="lbl">مجموع مبالغ پرداخت‌شده</div>
        <div class="val">${U.fmt(total)}</div>
        <div class="sub">تومان</div>
      </div>
      <div class="kpi o">
        <div class="lbl">وام‌های جاری</div>
        <div class="val">${U.toFa(active.length)}</div>
        <div class="sub">اصل: ${U.fmt(activeTotal)} تومان</div>
      </div>
      <div class="kpi r">
        <div class="lbl">باقیمانده وام‌های جاری</div>
        <div class="val">${U.fmt(activeRemaining)}</div>
        <div class="sub">تومان • ${U.toFa(settledCount)} وام تسویه‌شده</div>
      </div>
    </div>

    <div class="card">
      <div class="controls">
        <h3 style="margin:0"><span class="dot"></span> فهرست وام‌ها</h3>
        <span class="spacer"></span>
        ${canWrite ? '<button class="btn solid" id="newLoanBtn">➕ پرداخت وام جدید</button>' : ''}
      </div>

      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr>
            <th>#</th>
            <th>دوره شروع</th>
            <th>نام وام‌گیرنده</th>
            <th>کد</th>
            <th>مبلغ وام</th>
            <th>قسط ماهانه</th>
            <th>پرداخت‌شده</th>
            <th>باقیمانده</th>
            <th>پیشرفت</th>
            <th>وضعیت</th>
            ${canWrite ? '<th>عملیات</th>' : ''}
          </tr></thead>
          <tbody>
            ${reversed.length ? reversed.map((l, i) => {
              const count = l.count || 20;
              const paid  = l.paid || 0;
              const pct   = Math.min(100, Math.round((paid / count) * 100));
              const isActive = l.status === 'active';
              return `<tr data-id="${U.esc(l.id)}">
                <td class="num">${U.toFa(i + 1)}</td>
                <td>${U.esc(l.startPeriodKey || '—')}</td>
                <td>${U.esc(l.name || (state.members.get(l.memberCode)?.name) || '—')}</td>
                <td><span class="badge b">${U.esc(l.memberCode)}</span></td>
                <td class="num">${U.fmt(l.amount)}</td>
                <td class="num">${U.fmt(l.installment)}</td>
                <td class="num">${U.toFa(paid)} از ${U.toFa(count)}</td>
                <td class="num">${U.fmt(l.remaining)}</td>
                <td><div class="bar"><i style="width:${pct}%"></i></div></td>
                <td>${isActive
                  ? '<span class="badge warn">جاری</span>'
                  : '<span class="badge ok">تسویه‌شده</span>'}</td>
                ${canWrite ? `<td class="actions">
  <button class="btn plain sm" data-act="edit" data-id="${U.esc(l.id)}" title="ویرایش کامل" style="color:var(--brand-500)">✏️</button>
  <button class="btn plain sm" data-act="detail" data-id="${U.esc(l.id)}" title="جزئیات">👁️</button>
  ${(l.paid || 0) === 0
    ? `<button class="btn plain sm" data-act="del" data-id="${U.esc(l.id)}" title="حذف" style="color:var(--danger)">🗑️</button>`
    : ''}
</td>` : ''}
              </tr>`;
            }).join('')
            : '<tr><td colspan="' + (canWrite ? 11 : 10) + '"><div class="empty">هیچ وامی ثبت نشده است.</div></td></tr>'}
          </tbody>
          ${loans.length ? `
          <tfoot><tr>
            <td colspan="4">جمع کل</td>
            <td class="num">${U.fmt(total)}</td>
            <td colspan="2"></td>
            <td class="num">${U.fmt(activeRemaining)}</td>
            <td colspan="${canWrite ? 3 : 2}"></td>
          </tr></tfoot>` : ''}
        </table>
      </div>
    </div>`;

  const newBtn = root.querySelector('#newLoanBtn');
  if (newBtn) newBtn.onclick = () => App.Boot.switchTab('loan-new');

  if (canWrite) {
    root.querySelectorAll('button[data-act]').forEach(b => {
      b.onclick = async (e) => {
        e.stopPropagation();
        const id = b.dataset.id, act = b.dataset.act;
if (act === 'edit') {
  App.Boot.switchTab('loan-edit', { id });
  return;
}
        if (act === 'detail') {
          App.Boot.switchTab('loan-detail', { id });
          return;
        }
        if (act === 'del') {
          const loan = await App.LoanService.get(id);
          const ok = await App.UI.confirm.danger(
            `وام ${U.fmt(loan.amount)} تومانی «${loan.name}» حذف شود؟`,
            { title: 'حذف وام', details: 'این عمل بازگشت‌پذیر نیست.' }
          );
          if (!ok) return;
          try {
            await App.LoanService.remove(id);
            App.UI.toast.success('وام حذف شد');
            App.Boot.render();
          } catch (err) { App.UI.toast.error(err.message); }
        }
      };
    });
  }

  /* کلیک روی ردیف → جزئیات */
  root.querySelectorAll('tr[data-id]').forEach(tr => {
    tr.style.cursor = 'pointer';
    tr.onclick = () => App.Boot.switchTab('loan-detail', { id: tr.dataset.id });
  });
};