/* =========================================================
   views/settings-global.js — تنظیمات و انعطاف‌پذیری
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

const SETTINGS_KEY = 'fundSettings';
const DEFAULT_FUND_SETTINGS = {
  fundName: 'صندوق قرض‌الحسنه',
  fundSubtitle: 'سامانه مدیریت مالی',
  defaultDepositRate: 200000,
  installmentCount: 20,
  penaltyEnabled: false,
  penaltyRate: 0,
  currencyUnit: 'تومان',
  showRialWarning: false,
  fiscalYearStart: 1
};

App.SettingsService = (function () {
  let cache = { ...DEFAULT_FUND_SETTINGS };

  async function load() {
    try {
      const rec = await App.DataService.Repos.settings.get(SETTINGS_KEY);
      if (rec?.value) cache = { ...DEFAULT_FUND_SETTINGS, ...rec.value };
    } catch (e) { /* ignore */ }
    return cache;
  }

  async function save(patch) {
    cache = { ...cache, ...patch };
    await App.DataService.Repos.settings.put({
      key: SETTINGS_KEY,
      value: cache,
      updatedAt: Date.now()
    });
    return cache;
  }

  const all = () => ({ ...cache });

  return { load, save, all };
})();

App.Views.settingsGlobal = function (root, state) {
  const U = App.Utils;
  const SS = App.SettingsService;

  (async () => {
    const s = await SS.load();

    root.innerHTML = `
      <div class="card">
        <h3><span class="dot"></span> 🏦 تنظیمات صندوق</h3>
        <p style="color:var(--muted);font-size:13px;margin:-4px 0 16px">
          این تنظیمات روی کل صندوق اعمال می‌شود. با تغییر هر کدام، بلافاصله ذخیره می‌شود.
        </p>

        <div class="grid" style="grid-template-columns:1fr 1fr;gap:14px;max-width:800px">
          <div class="field">
            <label for="st-name">نام صندوق</label>
            <input type="text" id="st-name" value="${U.esc(s.fundName)}">
          </div>
          <div class="field">
            <label for="st-sub">زیرعنوان</label>
            <input type="text" id="st-sub" value="${U.esc(s.fundSubtitle)}">
          </div>
        </div>

        <div class="grid" style="grid-template-columns:1fr 1fr;gap:14px;max-width:800px;margin-top:12px">
          <div class="field">
            <label for="st-rate">نرخ واریز پیش‌فرض (تومان)</label>
            <input type="number" id="st-rate" value="${U.num(s.defaultDepositRate)}" step="50000">
            <div class="field-hint">برای دوره‌های جدید استفاده می‌شود</div>
          </div>
          <div class="field">
            <label for="st-count">تعداد اقساط هر وام</label>
            <input type="number" id="st-count" value="${U.num(s.installmentCount)}" min="1" max="60">
            <div class="field-hint">فعلاً ۲۰ قسط ثابت است</div>
          </div>
        </div>

        <div class="section-title">جریمه دیرکرد</div>
        <div style="max-width:800px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 0">
            <input type="checkbox" id="st-pen-enabled" ${s.penaltyEnabled ? 'checked' : ''}>
            <span>فعال بودن محاسبه جریمه دیرکرد</span>
          </label>
          <div class="field" style="max-width:300px">
            <label for="st-pen-rate">نرخ جریمه روزانه (تومان)</label>
            <input type="number" id="st-pen-rate" value="${U.num(s.penaltyRate)}" min="0" step="1000">
          </div>
        </div>

        <div class="section-title">واحد پول</div>
        <div class="field" style="max-width:300px">
          <label for="st-currency">واحد نمایش</label>
          <select id="st-currency">
            <option value="تومان" ${s.currencyUnit === 'تومان' ? 'selected' : ''}>تومان</option>
            <option value="ریال" ${s.currencyUnit === 'ریال' ? 'selected' : ''}>ریال</option>
          </select>
        </div>

        <div id="stAlert"></div>

        <div style="margin-top:20px">
          <button class="btn solid" id="stSave">💾 ذخیره تنظیمات</button>
          <button class="btn plain" id="stReset">↺ بازگردانی پیش‌فرض</button>
        </div>
      </div>

      <div class="card">
        <h3><span class="dot" style="background:var(--kpi-danger)"></span> ⚠️ عملیات خطرناک</h3>
        <p style="color:var(--muted);font-size:13px;margin:-4px 0 16px">
          این عملیات‌ها فقط برای مدیر و در مواقع خاص استفاده می‌شود.
        </p>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn plain" id="stClearHistory" style="color:var(--danger)">
            🗑️ پاک‌کردن تاریخچه Undo
          </button>
          <button class="btn plain" id="stClearAudit" style="color:var(--danger)">
            🗑️ پاک‌کردن لاگ حسابرسی
          </button>
        </div>
      </div>`;

    const saveBtn = root.querySelector('#stSave');
    const alertBox = root.querySelector('#stAlert');

    saveBtn.onclick = async () => {
      try {
        await SS.save({
          fundName: root.querySelector('#st-name').value.trim(),
          fundSubtitle: root.querySelector('#st-sub').value.trim(),
          defaultDepositRate: U.num(root.querySelector('#st-rate').value),
          installmentCount: U.num(root.querySelector('#st-count').value) || 20,
          penaltyEnabled: root.querySelector('#st-pen-enabled').checked,
          penaltyRate: U.num(root.querySelector('#st-pen-rate').value),
          currencyUnit: root.querySelector('#st-currency').value
        });
        App.UI.toast.success('تنظیمات ذخیره شد');
      } catch (e) {
        alertBox.innerHTML = `<div class="form-alert danger">${U.esc(e.message)}</div>`;
      }
    };

    root.querySelector('#stReset').onclick = async () => {
      const ok = await App.UI.confirm.ask({
        title: 'بازگردانی پیش‌فرض',
        message: 'همه تنظیمات به حالت پیش‌فرض برگردد؟'
      });
      if (!ok) return;
      await SS.save(DEFAULT_FUND_SETTINGS);
      App.Views.settingsGlobal(root, state);
      App.UI.toast.success('بازگردانی شد');
    };

    root.querySelector('#stClearHistory').onclick = () => {
      App.EditService.clearHistory();
      App.UI.toast.success('تاریخچه پاک شد');
    };

    root.querySelector('#stClearAudit').onclick = async () => {
      const ok = await App.UI.confirm.danger('تمام لاگ حسابرسی پاک شود؟', {
        title: 'پاک‌کردن لاگ',
        details: 'این عمل بازگشت‌پذیر نیست.'
      });
      if (!ok) return;
      await App.DataService.Repos.audit.clear();
      App.UI.toast.success('لاگ پاک شد');
    };
  })();
};