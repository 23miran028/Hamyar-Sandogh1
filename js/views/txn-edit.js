/* =========================================================
   views/txn-edit.js — ثبت/ویرایش معامله دوره (نسخه تومان)
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.txnEdit = function (root, state, opts = {}) {
  const U = App.Utils;
  const TS = App.TxnService;
  const MS = App.MemberService;
  const periodKey = opts.periodKey;
  const memberCode = opts.memberCode;

  if (!periodKey || !memberCode) {
    App.UI.toast?.error('اطلاعات ناقص');
    App.Views.monthly(root, state);
    return;
  }

  (async () => {
    const [member, snap] = await Promise.all([
      MS.get(memberCode),
      TS.getSnapshot(periodKey, memberCode)
    ]);
    if (!member) {
      App.UI.toast?.error('عضو یافت نشد');
      App.Views.monthly(root, state);
      return;
    }

    const isEdit = !!snap;

    /* تبدیل ریال → تومان برای نمایش در فرم */
    const toToman = (rial) => Math.round((Number(rial) || 0) / 10);

    /* فیلد عددی — مقدار نمایش به تومان */
    const numField = (id, label, valueToman = 0, hint = '') => `
      <div class="field">
        <label for="f-${id}">${U.esc(label)}</label>
        <input id="f-${id}" type="number" value="${valueToman}" min="0" step="1000">
        ${hint ? `<div class="field-hint">${U.esc(hint)}</div>` : ''}
        <div class="field-error" data-error="${id}"></div>
      </div>`;

    root.innerHTML = `
      <div class="card">
        <div class="controls">
          <button class="btn plain" id="backBtn">← بازگشت به گزارش ماهانه</button>
          <span class="spacer"></span>
          <h3 style="margin:0">${isEdit ? 'ویرایش' : 'ثبت'} معامله</h3>
        </div>

        <div class="member-chip">
          <span class="badge b">${U.esc(member.code)}</span>
          <span>${U.esc(member.name)}</span>
          <span class="sep">•</span>
          <span class="muted">${U.esc(periodKey)}</span>
        </div>

        <div class="form-alert" style="background:rgba(20,184,166,.08);color:var(--brand);margin-bottom:12px">
          💡 مقادیر به <b>تومان</b> وارد می‌شوند.
        </div>

        <div id="formAlert"></div>

        <form id="txnForm" autocomplete="off" style="max-width:760px">
          <div class="section-title">💰 واریز و قسط</div>
          <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:12px">
            ${numField('deposit', 'واریز سرمایه (تومان)', toToman(snap?.deposit || 0))}
            ${numField('installment', 'قسط ماهانه (تومان)', toToman(snap?.installment || 0))}
            ${numField('paidCount', 'تعداد قسط پرداخت‌شده', snap?.paidCount == null ? 0 : snap.paidCount, 'حداکثر ۲۰ — با تغییر، باقیمانده خودکار حساب می‌شود')}
          </div>

          <div class="section-title">🏦 وام</div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
            ${numField('loan', 'مبلغ وام دریافتی (تومان)', toToman(snap?.loan || 0), 'در ماه پرداخت وام')}
            ${numField('remaining', 'باقیمانده وام (تومان)', toToman(snap?.remaining || 0))}
          </div>

          <div class="section-title">📊 جمع</div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
            ${numField('totalCap', 'سرمایه کل (تومان)', toToman(snap?.totalCap || 0))}
            ${numField('rowNo', 'ردیف', snap?.rowNo || 0)}
          </div>

          <div class="calc-preview" id="preview"></div>

          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
            ${isEdit ? '<button type="button" class="btn plain danger" id="delBtn">🗑️ حذف</button>' : ''}
            <button type="button" class="btn plain" id="cancelBtn">انصراف</button>
            <button type="submit" class="btn solid">${isEdit ? '💾 ذخیره' : '➕ ثبت'}</button>
          </div>
        </form>
      </div>`;

    const form = root.querySelector('#txnForm');
    const alertBox = root.querySelector('#formAlert');
    const preview = root.querySelector('#preview');

    const updatePreview = () => {
      /* d و i هر دو تومان هستند */
      const d = Number(form.querySelector('#f-deposit').value) || 0;
      const i = Number(form.querySelector('#f-installment').value) || 0;
      preview.innerHTML = `<div><span>سرمایه + قسط:</span> <b>${U.NF.format(d + i)}</b> تومان</div>`;
    };
    form.addEventListener('input', updatePreview);
    /* ═══ محاسبه خودکار remaining از paidCount ═══ */
const paidCountInput = form.querySelector('#f-paidCount');
const remainingInput = form.querySelector('#f-remaining');
const installmentInput = form.querySelector('#f-installment');
const loanInput = form.querySelector('#f-loan');

function autoCalcRemaining() {
  const pc = Number(paidCountInput.value) || 0;
  const inst = Number(installmentInput.value) || 0;
  const loan = Number(loanInput.value) || 0;

  /* محدودسازی paidCount */
  if (pc > 20) {
    paidCountInput.value = 20;
    return autoCalcRemaining();
  }
  if (pc < 0) {
    paidCountInput.value = 0;
    return autoCalcRemaining();
  }

  /* اگر وام وجود دارد، remaining را خودکار حساب کن */
  if (loan > 0 && inst > 0) {
    const newRemaining = Math.max(0, loan - pc * inst);
    remainingInput.value = newRemaining;
    updatePreview();
  }

  /* اگر paidCount = 20 → remaining = 0 */
  if (pc >= 20 && loan > 0) {
    remainingInput.value = 0;
    updatePreview();
  }
}

paidCountInput.addEventListener('input', autoCalcRemaining);
paidCountInput.addEventListener('change', autoCalcRemaining);
    updatePreview();

    root.querySelector('#backBtn').onclick   = () => App.Views.monthly(root, state);
    root.querySelector('#cancelBtn').onclick = () => App.Views.monthly(root, state);

    root.querySelector('#delBtn')?.addEventListener('click', async () => {
      const ok = await App.UI.confirm.danger(
        `رکورد معامله دوره «${periodKey}» برای «${member.name}» حذف شود؟`,
        { title: 'حذف معامله' }
      );
      if (!ok) return;
      try {
        await TS.remove(periodKey, memberCode);
        App.UI.toast.success('رکورد حذف شد');
        App.Views.monthly(root, state);
      } catch (e) { App.UI.toast.error(e.message); }
    });

    form.onsubmit = async (e) => {
      e.preventDefault();
      alertBox.innerHTML = '';

      /* تبدیل تومان → ریال برای ذخیره در DB */
      const toRial = (toman) => (Number(toman) || 0) * 10;

      const data = {
        periodKey, memberCode,
        deposit:     toRial(form.querySelector('#f-deposit').value),
        installment: toRial(form.querySelector('#f-installment').value),
        paidCount:   Number(form.querySelector('#f-paidCount').value) || 0,
        loan:        toRial(form.querySelector('#f-loan').value),
        remaining:   toRial(form.querySelector('#f-remaining').value),
        totalCap:    toRial(form.querySelector('#f-totalCap').value),
        rowNo:       Number(form.querySelector('#f-rowNo').value) || 0
      };

      try {
        await TS.upsert(periodKey, memberCode, data);
        App.UI.toast.success('معامله ذخیره شد');
        App.Views.monthly(root, state);
      } catch (err) {
        alertBox.innerHTML = `<div class="form-alert danger">${U.esc(err.message)}</div>`;
      }
    };
  })();
};