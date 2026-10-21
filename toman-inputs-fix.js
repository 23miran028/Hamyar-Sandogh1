/* =========================================================
   toman-inputs-fix.js — تبدیل تمام ورودی‌های مالی به تومان
   ========================================================= */
(function() {
  if (window._tomanInputsApplied) return;
  window._tomanInputsApplied = true;

  const U = App.Utils;
  const toToman = (rial) => Math.round((Number(rial) || 0) / 10);
  const toRial = (toman) => Math.round((Number(toman) || 0) * 10);
  
  // افزودن یک استایل کوچک برای فرم‌های مالی
  const style = document.createElement('style');
  style.innerHTML = `.field-money-hint { font-size: 11px; color: var(--brand-500); margin-top: 4px; font-weight: bold; display: block; }`;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════════════════
  // ۱. اصلاح صفحه ویرایش وام (loan-edit)
  // ═══════════════════════════════════════════════════════════
  const origLoanEdit = App.Views.loanEdit;
  if (origLoanEdit) {
    App.Views.loanEdit = function(root, state, opts) {
      origLoanEdit.call(this, root, state, opts);
      setTimeout(() => {
        const form = root.querySelector('#loanEditForm');
        if (!form) return;

        const amountInp = form.querySelector('#le-amount');
        const instInp = form.querySelector('#le-installment');
        const remInp = form.querySelector('#le-remaining');
        if (!amountInp || !instInp || !remInp) return;

        // 1. تبدیل مقادیر ریال دیتابیس به تومان برای نمایش
        amountInp.value = toToman(amountInp.value);
        instInp.value = toToman(instInp.value);
        remInp.value = toToman(remInp.value);

        // 2. بازسازی فرم با کدهای اصلاح‌شده تا محاسبات و پیش‌نمایش درست شود
        const origSubmit = form.onsubmit;
        form.onsubmit = async (e) => {
          e.preventDefault();
          const data = {
            amount: toRial(amountInp.value),
            installment: toRial(instInp.value),
            paid: U.num(form.querySelector('#le-paid').value),
            remaining: toRial(remInp.value),
            status: form.querySelector('#le-status').value,
            startPeriodKey: form.querySelector('#le-period').value,
            name: form.querySelector('#le-name').value.trim()
          };
          const period = state.months.find(m => m.key === data.startPeriodKey);
          if (period) { data.startYear = period.year; data.startIdx = period.idx; }
          try {
            await App.EditService.updateLoan(opts.id, data);
            App.UI.toast.success('تغییرات ذخیره شد');
            App.Boot.switchTab('loans');
          } catch (err) {
            document.getElementById('formAlert').innerHTML = `<div class="form-alert danger">${U.esc(err.message)}</div>`;
          }
        };

        // اصلاح پیش‌نمایش
        const fixPreview = () => {
          const a = U.num(amountInp.value);
          const i = U.num(instInp.value);
          const p = Math.min(20, Math.max(0, U.num(form.querySelector('#le-paid').value)));
          const exp = Math.max(0, a - p * i);
          form.querySelector('#previewBox').innerHTML = `
            <div><span>مبلغ وام:</span> <b>${U.NF.format(a)}</b> تومان</div>
            <div><span>قسط:</span> <b>${U.NF.format(i)}</b> تومان</div>
            <div><span>باقیمانده محاسبه‌شده:</span> <b>${U.NF.format(exp)}</b> تومان</div>`;
        };
        [amountInp, instInp].forEach(x => x.addEventListener('input', fixPreview));
        setTimeout(fixPreview, 20);
      }, 100);
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ۲. اصلاح صفحه مدیریت دوره‌ها (period-manage)
  // ═══════════════════════════════════════════════════════════
  const origPeriodManage = App.Views.periodManage;
  if (origPeriodManage) {
    App.Views.periodManage = function(root, state) {
      origPeriodManage.call(this, root, state);
      const patchPeriod = () => {
        const rateInp = root.querySelector('#af-rate');
        if (!rateInp) { setTimeout(patchPeriod, 100); return; }
        if (rateInp.dataset._toman) return;
        rateInp.dataset._toman = '1';

        // تبدیل نمایش به تومان
        rateInp.value = toToman(rateInp.value);
        
        // تبدیل دکمه‌های inline به تومان
        root.querySelectorAll('.js-rate-input').forEach(inp => {
          inp.value = toToman(inp.value);
          const origChange = inp.onchange;
          inp.onchange = () => {}; // جلوگیری از تداخل
        });

        // رهگیری دکمه ساخت دوره
        const createBtn = root.querySelector('#btnCreatePeriod');
        if (createBtn) {
          createBtn.addEventListener('click', () => {
            rateInp.value = toRial(rateInp.value);
          }, true);
        }

        // رهگیری دکمه‌های ذخیره نرخ
        root.querySelectorAll('.js-save').forEach(btn => {
          const key = btn.dataset.period;
          const origClick = btn.onclick;
          btn.onclick = async (e) => {
            const inp = root.querySelector(`input[data-period="${CSS.escape(key)}"]`);
            if (inp) inp.value = toRial(inp.value);
            try {
              await origClick.call(btn, e);
            } finally {
              if (inp && document.body.contains(inp)) inp.value = toToman(inp.value);
            }
          };
        });
      };
      setTimeout(patchPeriod, 100);
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ۳. اصلاح تنظیمات صندوق (settings-global)
  // ═══════════════════════════════════════════════════════════
  const origSettingsGlobal = App.Views.settingsGlobal;
  if (origSettingsGlobal) {
    App.Views.settingsGlobal = function(root, state) {
      origSettingsGlobal.call(this, root, state);
      setTimeout(() => {
        const rateInp = root.querySelector('#st-rate');
        const penInp = root.querySelector('#st-pen-rate');
        const saveBtn = root.querySelector('#stSave');
        if (!rateInp || !penInp || !saveBtn) return;

        // تبدیل به تومان برای نمایش
        rateInp.value = toToman(rateInp.value);
        penInp.value = toToman(penInp.value);

        // تبدیل به ریال برای ذخیره
        const origClick = saveBtn.onclick;
        saveBtn.onclick = async (e) => {
          rateInp.value = toRial(rateInp.value);
          penInp.value = toRial(penInp.value);
          try {
            return await origClick.call(saveBtn, e);
          } finally {
            if (document.body.contains(rateInp)) {
              rateInp.value = toToman(rateInp.value);
              penInp.value = toToman(penInp.value);
            }
          }
        };
      }, 100);
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ۴. اصلاح گزارش سالانه (yearly) - ویرایش درون‌خطی
  // ═══════════════════════════════════════════════════════════
  const origYearly = App.Views.yearly;
  if (origYearly) {
    App.Views.yearly = function(el, state) {
      origYearly.call(this, el, state);
      setTimeout(() => {
        el.querySelectorAll('.js-member-input').forEach(inp => {
          if (inp.dataset._toman) return;
          inp.dataset._toman = '1';
          
          // تبدیل نمایش به تومان
          inp.value = toToman(inp.value);
          
          // جایگزینی المان برای پاک کردن شنونده‌های قدیمی
          const clone = inp.cloneNode(true);
          inp.parentNode.replaceChild(clone, inp);
          
          // افزودن شنونده جدید با تبدیل به ریال
          clone.addEventListener('change', async () => {
            const year = clone.dataset.year;
            const month = clone.dataset.month;
            const mi = +clone.dataset.mi;
            const rialValue = toRial(clone.value);
            try {
              await App.YearlyService.updateMemberValue(year, month, mi, rialValue);
              App.UI.toast.success('ذخیره شد');
              App.Views.yearly(el, state); // به‌روزرسانی نمای کلی
            } catch (e) {
              App.UI.toast.error(e.message);
            }
          });
        });
      }, 100);
    };
  }

  console.log('✅ [TomanFix] تمام ورودی‌های مالی با تومان کار می‌کنند.');
})();