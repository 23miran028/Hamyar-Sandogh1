/* =========================================================
   views/loan-new.js — پرداخت وام جدید (نسخه تومان)
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.loanNew = function (root, state) {
  const U = App.Utils;
  const canWrite = App.AuthService.hasRole('admin', 'treasurer');

  if (!canWrite) {
    root.innerHTML = '<div class="card"><div class="empty">⛔ شما دسترسی ثبت وام ندارید.</div></div>';
    return;
  }

  const members = [...state.members.values()]
    .filter(m => m.status === 'active' && !m.activeLoan)
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));

  const periods = state.months || [];
  const lastPeriod = periods[periods.length - 1];

  root.innerHTML = `
    <div class="card">
      <div class="controls">
        <button class="btn plain" id="backBtn">← بازگشت به فهرست وام‌ها</button>
        <span class="spacer"></span>
        <h3 style="margin:0">💳 پرداخت وام جدید</h3>
      </div>

      <div id="formAlert"></div>

      ${members.length === 0 ? `
        <div class="form-alert danger" style="margin-bottom:16px">
          هیچ عضوی برای پرداخت وام واجد شرایط نیست.
        </div>` : ''}

      <form id="loanForm" autocomplete="off" style="max-width:720px">
        <div class="field">
          <label for="f-member">عضو وام‌گیرنده <span class="req">*</span></label>
          <select id="f-member" required>
            <option value="">— انتخاب کنید —</option>
            ${members.map(m => `<option value="${U.esc(m.code)}">${U.esc(m.code)} — ${U.esc(m.name)}</option>`).join('')}
          </select>
        </div>

        <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
          <div class="field">
            <label for="f-amount">مبلغ وام (تومان) <span class="req">*</span></label>
            <input id="f-amount" type="number" min="100000" step="100000" placeholder="مثلاً 50000000" required>
            <div class="field-hint">مبلغ به تومان وارد می‌شود</div>
          </div>
          <div class="field">
            <label for="f-start">دوره پرداخت وام <span class="req">*</span></label>
            <select id="f-start" required>
              ${periods.slice().reverse().map(p => `<option value="${U.esc(p.key)}" ${p.key === lastPeriod?.key ? 'selected' : ''}>${U.monthLabel(p)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="loan-preview">
          <div class="lp-row"><span>مبلغ وام</span><b id="pv-amount">—</b></div>
          <div class="lp-row"><span>تعداد اقساط</span><b>${U.toFa(20)} قسط</b></div>
          <div class="lp-row hl"><span>قسط ماهانه</span><b id="pv-installment">—</b></div>
          <div class="lp-row"><span>اولین قسط</span><b id="pv-first">—</b></div>
          <div class="lp-row"><span>آخرین قسط</span><b id="pv-last">—</b></div>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
          <button type="button" class="btn plain" id="cancelBtn">انصراف</button>
          <button type="submit" class="btn solid" ${members.length === 0 ? 'disabled' : ''}>
            ✅ ثبت پرداخت وام
          </button>
        </div>
      </form>
    </div>`;

  const form = root.querySelector('#loanForm');
  const alertBox = root.querySelector('#formAlert');

  root.querySelector('#backBtn').onclick   = () => App.Views.loans(root, state);
  root.querySelector('#cancelBtn').onclick = () => App.Views.loans(root, state);

  const updatePreview = () => {
    /* مقدار ورودی کاربر به تومان است */
    const amountToman = Number(form.querySelector('#f-amount').value) || 0;
    const periodKey = form.querySelector('#f-start').value;

    /* قسط تومان = مبلغ تومان ÷ ۲۰ */
    const installmentToman = Math.round(amountToman / 20);

    const pvAmount = root.querySelector('#pv-amount');
    const pvInst   = root.querySelector('#pv-installment');
    const pvFirst  = root.querySelector('#pv-first');
    const pvLast   = root.querySelector('#pv-last');

    pvAmount.textContent = amountToman ? U.NF.format(amountToman) + ' تومان' : '—';
    pvInst.textContent   = amountToman ? U.NF.format(installmentToman) + ' تومان' : '—';

    if (periodKey) {
      const pIdx = periods.findIndex(p => p.key === periodKey);
      const first = periods[pIdx + 1];
      const last  = periods[pIdx + 20];
      pvFirst.textContent = first ? U.monthLabel(first) : '—';
      pvLast.textContent  = last ? U.monthLabel(last) : 'خارج از بازه موجود';
    } else {
      pvFirst.textContent = '—';
      pvLast.textContent = '—';
    }
  };
  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);
  updatePreview();

  form.onsubmit = async (e) => {
    e.preventDefault();
    alertBox.innerHTML = '';

    const amountToman = Number(form.querySelector('#f-amount').value) || 0;
    const memberCode = form.querySelector('#f-member').value;
    const startPeriodKey = form.querySelector('#f-start').value;

    /* تبدیل به ریال برای ذخیره در DB */
    const amountRial = amountToman * 10;

    const data = {
      memberCode,
      amount: amountRial,
      startPeriodKey
    };

    const member = state.members.get(memberCode);
    if (!member) {
      alertBox.innerHTML = '<div class="form-alert danger">عضو انتخاب نشده</div>';
      return;
    }

    const installmentToman = Math.round(amountToman / 20);

    const ok = await App.UI.confirm.ask({
      title: 'تأیید پرداخت وام',
      message: `وام ${U.NF.format(amountToman)} تومانی به «${member.name}» پرداخت شود؟`,
      details: `قسط ماهانه: ${U.NF.format(installmentToman)} تومان × ۲۰ قسط`,
      confirmText: 'بله، پرداخت کن'
    });
    if (!ok) return;

    try {
      await App.LoanService.disburse(data);
      App.UI.toast.success(`وام برای «${member.name}» پرداخت شد`);
      App.Views.loans(root, state);
    } catch (err) {
      alertBox.innerHTML = `<div class="form-alert danger">${U.esc(err.message)}</div>`;
    }
  };
};