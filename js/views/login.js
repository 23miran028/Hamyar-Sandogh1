/* =========================================================
   views/login.js — صفحه ورود + راه‌اندازی اولیه
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.login = function (root, opts) {
  const Auth = App.AuthService;
  const U = App.Utils;
  const mode = opts?.mode || 'login';   // 'login' | 'setup'

  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="logo-big">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48">
    <defs>
      <linearGradient id="lgWood" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ca8a04"/>
        <stop offset="100%" stop-color="#854d0e"/>
      </linearGradient>
      <linearGradient id="lgGold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fde68a"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>
    </defs>

    <!-- درپوش -->
    <path d="M 12 26 Q 12 20 20 19 L 44 19 Q 52 20 52 26 L 52 28 L 12 28 Z"
          fill="url(#lgWood)"/>
    <!-- خط بالای درپوش -->
    <path d="M 20 19 L 44 19 Q 48 19 50 21 L 50 22 Q 48 20 44 20 L 20 20 Q 16 20 14 22 L 14 21 Q 16 19 20 19 Z"
          fill="#eab308" opacity="0.7"/>

    <!-- بند فلزی بالای درپوش -->
    <rect x="11" y="26" width="42" height="2.5" rx="1" fill="#fbbf24"/>

    <!-- بدنه -->
    <rect x="13" y="29" width="38" height="24" rx="2" fill="url(#lgWood)"/>

    <!-- بافت چوب -->
    <g opacity="0.2" stroke="#3f2410" stroke-width="0.6" fill="none">
      <line x1="20" y1="31" x2="20" y2="51"/>
      <line x1="27" y1="30" x2="27" y2="52"/>
      <line x1="34" y1="30" x2="34" y2="52"/>
      <line x1="41" y1="30" x2="41" y2="52"/>
    </g>

    <!-- بند فلزی افقی -->
    <rect x="13" y="42" width="38" height="2.5" fill="#fbbf24"/>
    <!-- بند فلزی عمودی -->
    <rect x="30" y="28" width="4" height="26" fill="#fbbf24" opacity="0.9"/>

    <!-- میخ‌ها -->
    <g fill="#78350f" opacity="0.55">
      <circle cx="16" cy="32" r="0.8"/>
      <circle cx="16" cy="38" r="0.8"/>
      <circle cx="48" cy="32" r="0.8"/>
      <circle cx="48" cy="38" r="0.8"/>
    </g>

    <!-- قفل طلایی -->
    <rect x="27" y="24" width="10" height="11" rx="2"
          fill="url(#lgGold)" stroke="#78350f" stroke-width="0.7"/>
    <rect x="28" y="25.5" width="8" height="3" rx="1" fill="#fef3c7" opacity="0.5"/>
    <circle cx="32" cy="29" r="1.3" fill="#78350f"/>
    <path d="M 31 31 L 31 33.5 L 33 33.5 L 33 31 Z" fill="#78350f"/>
    <!-- قوس قفل -->
    <path d="M 29 24 L 29 22 Q 29 19 32 19 Q 35 19 35 22 L 35 24"
          fill="none" stroke="#fbbf24" stroke-width="1.6" stroke-linecap="round"/>
  </svg>
</div>
        <h2>${mode === 'setup' ? 'راه‌اندازی اولیه' : 'ورود به سامانه'}</h2>
        <p class="sub">${mode === 'setup'
          ? 'برای شروع کار، حساب مدیر را ایجاد کنید'
          : 'برای ادامه، نام کاربری و رمز عبور خود را وارد کنید'}</p>

        <div id="loginAlert"></div>

        <form id="loginForm" autocomplete="on">
          <div class="field">
            <label>نام کاربری</label>
            <input type="text" id="f-username" autocomplete="username" required
                   value="${mode === 'setup' ? 'admin' : ''}" ${mode === 'setup' ? 'readonly' : ''}>
          </div>
          ${mode === 'setup' ? `
          <div class="field">
            <label>نام نمایشی</label>
            <input type="text" id="f-displayname" value="مدیر سیستم" required>
          </div>` : ''}
          <div class="field">
            <label>رمز عبور</label>
            <input type="password" id="f-password" autocomplete="${mode === 'setup' ? 'new-password' : 'current-password'}"
                   required minlength="6">
          </div>
          ${mode === 'setup' ? `
          <div class="field">
            <label>تکرار رمز عبور</label>
            <input type="password" id="f-password2" required minlength="6">
          </div>` : ''}
          <button type="submit" class="btn solid btn-full" id="loginBtn">
            ${mode === 'setup' ? 'ایجاد حساب مدیر' : 'ورود'}
          </button>
        </form>

        <p class="hint" style="text-align:center;margin-top:16px">
          ${mode === 'setup'
            ? 'این حساب دسترسی کامل به تمام بخش‌ها خواهد داشت.'
            : 'پس از ۵ تلاش ناموفق، حساب ۵ دقیقه قفل می‌شود.'}
        </p>
      </div>
    </div>`;

  const alertBox = root.querySelector('#loginAlert');
  const showAlert = (msg, kind) => {
    alertBox.innerHTML = `<div class="${kind === 'success' ? 'login-success' : 'login-error'}">${U.esc(msg)}</div>`;
  };
  const clearAlert = () => { alertBox.innerHTML = ''; };
  const btn = root.querySelector('#loginBtn');

  root.querySelector('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    clearAlert();
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = '⏳ لطفاً صبر کنید…';

    try {
      const username = root.querySelector('#f-username').value.trim().toLowerCase();
      const password = root.querySelector('#f-password').value;

      if (mode === 'setup') {
        const displayName = root.querySelector('#f-displayname').value.trim() || 'مدیر سیستم';
        const password2   = root.querySelector('#f-password2').value;
        if (password !== password2) throw App.Err.Validation('رمزهای عبور یکسان نیستند');
        if (password.length < 6)    throw App.Err.Validation('رمز عبور باید حداقل ۶ کاراکتر باشد');
        await Auth.createUser({ username, password, displayName, role: 'admin' });
        await Auth.login(username, password);
      } else {
        await Auth.login(username, password);
      }

      await App.Boot.enterApp();
    } catch (err) {
      showAlert(err.message || 'خطای ناشناخته');
      btn.disabled = false;
      btn.textContent = origText;
      root.querySelector('#f-password').value = '';
      root.querySelector('#f-password').focus();
    }
  };

  setTimeout(() => root.querySelector('#f-password')?.focus(), 100);
};