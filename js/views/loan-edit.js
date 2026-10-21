/* =========================================================
   views/loan-edit.js — ویرایش کامل وام
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.loanEdit = function (root, state, opts = {}) {
  const U = App.Utils;
  const ES = App.EditService;
  const loanId = opts.id;

  (async () => {
    const loan = await App.LoanService.get(loanId);
    if (!loan) {
      App.UI.toast.error('وام یافت نشد');
      App.Boot.switchTab('loans');
      return;
    }

    root.innerHTML = `
      <div class="card">
        <div class="controls">
          <button class="btn plain" id="backBtn" type="button">← بازگشت</button>
          <span class="spacer"></span>
          <h3 style="margin:0">✏️ ویرایش وام</h3>
        </div>

        <div class="member-chip">
          <span class="badge b">${U.esc(loan.memberCode)}</span>
          <span><b>${U.esc(loan.name || '—')}</b></span>
          <span class="sep">•</span>
          <span class="muted">شروع: ${U.esc(loan.startPeriodKey)}</span>
        </div>

        <div id="formAlert"></div>

        <form id="loanEditForm" autocomplete="off" style="max-width:720px">
          <div class="section-title">💰 اطلاعات وام</div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
            <div class="field">
              <label for="le-amount">مبلغ وام (تومان)</label>
              <input type="number" id="le-amount" value="${U.num(loan.amount)}" min="0" step="100000">
            </div>
            <div class="field">
              <label for="le-installment">قسط ماهانه (تومان)</label>
              <input type="number" id="le-installment" value="${U.num(loan.installment)}" min="0" step="10000">
            </div>
          </div>

          <div class="section-title">📊 وضعیت پرداخت</div>
          <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:12px">
            <div class="field">
              <label for="le-paid">اقساط پرداخت‌شده</label>
              <input type="number" id="le-paid" value="${U.num(loan.paid)}" min="0" max="20">
            </div>
            <div class="field">
              <label for="le-remaining">باقیمانده</label>
              <input type="number" id="le-remaining" value="${U.num(loan.remaining)}" min="0" step="100000">
            </div>
            <div class="field">
              <label for="le-status">وضعیت</label>
              <select id="le-status">
                <option value="active" ${loan.status === 'active' ? 'selected' : ''}>جاری</option>
                <option value="settled" ${loan.status === 'settled' ? 'selected' : ''}>تسویه‌شده</option>
              </select>
            </div>
          </div>

          <div class="section-title">📅 دوره شروع</div>
          <div class="field">
            <label for="le-period">دوره شروع</label>
            <select id="le-period">
              ${state.months.map(m => `
                <option value="${U.esc(m.key)}" ${m.key === loan.startPeriodKey ? 'selected' : ''}>
                  ${U.monthLabel(m)}
                </option>`).join('')}
            </select>
          </div>

          <div class="section-title">🏷 نام وام‌گیرنده</div>
          <div class="field">
            <label for="le-name">نام (نمایشی)</label>
            <input type="text" id="le-name" value="${U.esc(loan.name || '')}">
          </div>

          <div id="previewBox" class="calc-preview" style="margin-top:16px"></div>

          <div style="display:flex;gap:8px;justify-content:space-between;margin-top:20px;flex-wrap:wrap">
            <button type="button" class="btn plain" id="delBtn" style="color:var(--danger)">
              🗑️ حذف اجباری
            </button>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn plain" id="cancelBtn">انصراف</button>
              <button type="submit" class="btn solid">💾 ذخیره تغییرات</button>
            </div>
          </div>
        </form>
      </div>`;

    const form = root.querySelector('#loanEditForm');
    const alertBox = root.querySelector('#formAlert');

    /* محاسبه خودکار باقیمانده */
    const amountInput = form.querySelector('#le-amount');
    const instInput = form.querySelector('#le-installment');
    const paidInput = form.querySelector('#le-paid');
    const remInput = form.querySelector('#le-remaining');

    function recalc() {
      const amount = U.num(amountInput.value);
      const inst = U.num(instInput.value);
      const paid = U.num(paidInput.value);
      const expected = Math.max(0, amount - paid * inst);

      /* اگر remaining دست‌کاری نشده، خودکار پر کن */
      if (!remInput.dataset.manual) {
        remInput.value = expected;
      }

      /* پیش‌نمایش */
      const preview = root.querySelector('#previewBox');
      preview.innerHTML = `
        <div><span>مبلغ وام:</span> <b>${U.fmt(amount)}</b> تومان</div>
        <div><span>تعداد اقساط:</span> <b>۲۰</b></div>
        <div><span>قسط:</span> <b>${U.fmt(inst)}</b> تومان</div>
        <div><span>پرداخت‌شده:</span> <b>${U.toFa(paid)} از ۲۰</b></div>
        <div><span>باقیمانده محاسبه‌شده:</span> <b>${U.fmt(expected)}</b> تومان</div>
      `;
    }

    [amountInput, instInput, paidInput].forEach(i => i.addEventListener('input', recalc));
    remInput.addEventListener('input', () => { remInput.dataset.manual = '1'; });
    recalc();

    root.querySelector('#backBtn').onclick   = () => App.Boot.switchTab('loans');
    root.querySelector('#cancelBtn').onclick = () => App.Boot.switchTab('loans');

    root.querySelector('#delBtn').onclick = async () => {
      const ok = await App.UI.confirm.danger(
        `وام «${loan.name}» به‌طور کامل حذف شود؟`,
        {
          title: '⚠️ حذف اجباری وام',
          details: 'این وام حتی اگر قسط پرداخت‌شده داشته باشد حذف می‌شود و رکورد معامله شروع هم پاک می‌شود.'
        }
      );
      if (!ok) return;
      try {
        await ES.deleteLoan(loanId, { force: true });
        App.UI.toast.success('وام حذف شد');
        App.Boot.switchTab('loans');
      } catch (e) {
        alertBox.innerHTML = `<div class="form-alert danger">${U.esc(e.message)}</div>`;
      }
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      alertBox.innerHTML = '';

      const data = {
        amount: U.num(amountInput.value),
        installment: U.num(instInput.value),
        paid: U.num(paidInput.value),
        remaining: U.num(remInput.value),
        status: root.querySelector('#le-status').value,
        startPeriodKey: root.querySelector('#le-period').value,
        name: root.querySelector('#le-name').value.trim()
      };

      /* به‌روزرسانی تاریخ شروع */
      const period = state.months.find(m => m.key === data.startPeriodKey);
      if (period) {
        data.startYear = period.year;
        data.startIdx = period.idx;
      }

      try {
        await ES.updateLoan(loanId, data);
        App.UI.toast.success('تغییرات ذخیره شد');
        App.Boot.switchTab('loans');
      } catch (err) {
        alertBox.innerHTML = `<div class="form-alert danger">${U.esc(err.message)}</div>`;
      }
    };
  })();
};