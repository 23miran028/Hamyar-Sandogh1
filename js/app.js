/* =========================================================
   app.js — راه‌انداز و نگهبان احراز هویت (اصلاح‌شده)
   ========================================================= */
window.App = window.App || {};

const ROUTE_MAP = {
  'dashboard': 'dashboard', 'members': 'members', 'loans': 'loans',
  'monthly': 'monthly', 'yearly': 'yearly', 'forecast': 'forecast',
  'reports': 'reports', 'data': 'data', 'settings': 'settings',
  'settingsGlobal': 'settingsGlobal', 'auditLog': 'auditLog',
  'member-edit': 'memberEdit', 'txn-edit': 'txnEdit', 'loan-new': 'loanNew',
  'loan-detail': 'loanDetail', 'loan-edit': 'loanEdit',
  'period-manage': 'periodManage', 'reminders': 'reminders',
  'backup': 'backup', 'report-viewer': 'reportViewer'
};

const PARAM_ROUTES = ['member-edit','txn-edit','loan-new','loan-detail','loan-edit','period-manage','report-viewer'];

App.Boot = (function () {
  const U = App.Utils;
  const S = App.State;
  const DS = App.DataService;
  const Auth = App.AuthService;
  const state = S.state;

  const INACTIVITY_MS = 30 * 60 * 1000;
  const CHECK_MS      = 60 * 1000;
  let inactivityTimer = null;

  function render() {
    if (!Auth.isLoggedIn()) { showAuth(); return; }
    const view = document.getElementById('view');
    const shell = document.getElementById('appShell');

    if (S.isEmpty()) {
      if (shell) shell.classList.remove('auth-mode');
      updateBrandSub();
      App.UI.welcome(view, onPickFile);
      return;
    }

    updateBrandSub();
    view.innerHTML = '';

    const fnName = ROUTE_MAP[state.tab] || 'dashboard';
    const fn = App.Views[fnName];

    if (typeof fn !== 'function') {
      console.warn(`[render] view "${state.tab}" not found — falling back`);
      App.Views.dashboard(view, state);
      return;
    }

    const opts = state._tabOpts || {};
    if (PARAM_ROUTES.includes(state.tab)) fn(view, state, opts);
    else fn(view, state);

    setTimeout(() => App.UI.updateSidebarBadge?.(), 100);
  }

  function switchTab(id, opts = null) {
    state.tab = id;
    state._tabOpts = opts;
    App.UI.renderTabs(state, switchTab);
    render();
  }

  function showAuth() {
    const shell = document.getElementById('appShell');
    const menu = document.getElementById('userMenu');
    if (shell) shell.classList.add('auth-mode');
    if (menu) menu.style.display = 'none';

    try { App.NotifyService?.unmountBellIcon?.(); } catch (e) {}
    try { App.NotifyService?.stopScheduler?.(); } catch (e) {}
    stopInactivityWatch();

    const sub = document.getElementById('brandSub');
    if (sub) sub.textContent = 'ورود به سامانه';

    const view = document.getElementById('view');
    App.Views.login(view, { mode: state._authMode || 'login' });
  }

  async function enterApp() {
    try {
      const st = await DS.status();
      state.dbStatus = st;
      if (!st.isEmpty) await DS.loadAll(state);
    } catch (e) { console.warn('loadAll failed:', e); }

    const user = Auth.getCurrentUser();
    const shell = document.getElementById('appShell');
    if (shell) shell.classList.remove('auth-mode');

    const userMenu = document.getElementById('userMenu');
    if (userMenu) userMenu.style.display = '';

    const userLabel  = document.getElementById('userLabel');
    const userAvatar = document.getElementById('userAvatar');
    if (userLabel)  userLabel.textContent  = user.displayName || user.username;
    if (userAvatar) userAvatar.textContent = (user.displayName || user.username || '?').trim().charAt(0);

    const sidebarUser = document.getElementById('sidebarUser');
    if (sidebarUser) sidebarUser.textContent = user.displayName || user.username;

    updateBrandSub();
    startInactivityWatch();
    App.NotifyService?.mountBellIcon?.(); // ← اضافه شد
    App.UI.renderTabs(state, switchTab);
    render();
  }

  function updateBrandSub() {
    const sub = document.getElementById('brandSub');
    if (!sub) return;
    const u = Auth.getCurrentUser();
    if (!u) { sub.textContent = '—'; return; }
    sub.textContent = `${state.months.length} ماه • ${state.members.size} عضو`;
  }

  function onPickFile(f) {
    if (f instanceof File) return loadFile(f);
    document.getElementById('fileInput').click();
  }

  async function loadFile(file) {
    if (!Auth.isLoggedIn()) return;
    const view = document.getElementById('view');
    view.innerHTML = '<div class="card"><div class="empty">⏳ در حال پردازش و ذخیره داده‌ها…</div></div>';
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await DS.importRaw(json, { sourceFile: file.name });
      await DS.loadAll(state);
      state.tab = 'dashboard';
      App.UI.renderTabs(state, switchTab);
      render();
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="card"><div class="empty" style="color:var(--danger-500)">
        ❌ خطا در بارگذاری: ${U.esc(e.message || e)}</div></div>`;
    }
  }

  /* ---------- نگهبان بی‌کاری ---------- */
  let _inactivityHandlers = null;

  function startInactivityWatch() {
    stopInactivityWatch();
    const reset = () => { if (Auth.isLoggedIn()) Auth.touchSession(); };
    _inactivityHandlers = { reset, events: ['mousedown', 'keydown', 'touchstart', 'click', 'scroll'] };
    _inactivityHandlers.events.forEach(ev => document.addEventListener(ev, reset, { passive: true }));

    inactivityTimer = setInterval(() => {
      if (!Auth.isLoggedIn()) return;
      const u = Auth.getCurrentUser();
      if (!u) return;
      if (Date.now() - u.lastActivity > INACTIVITY_MS) {
        Auth.logout();
        App.UI.toast.warn('به‌دلیل عدم فعالیت از سیستم خارج شدید.'); // ← جایگزین alert
        start();
      }
    }, CHECK_MS);
  }

  function stopInactivityWatch() {
    if (_inactivityHandlers) {
      _inactivityHandlers.events.forEach(ev => document.removeEventListener(ev, _inactivityHandlers.reset));
      _inactivityHandlers = null;
    }
    if (inactivityTimer) { clearInterval(inactivityTimer); inactivityTimer = null; }
  }

  /* ---------- هم‌گام‌سازی بین تب‌ها ---------- */
  let _syncChannel = null;
  let _suppressSync = false;

  function initCrossTabSync() {
    if (typeof BroadcastChannel === 'undefined') return;
    if (_syncChannel) return;
    _syncChannel = new BroadcastChannel('qarz_fund_sync');

    _syncChannel.onmessage = async (e) => {
      if (e.data?.type !== 'data-changed') return;
      if (!Auth.isLoggedIn()) return;
      try {
        _suppressSync = true;
        await DS.loadAll(state);
        App.UI.renderTabs(state, switchTab);
        render();
      } catch (err) { console.warn('[sync] reload failed:', err); } 
      finally { _suppressSync = false; }
    };

    App.Bus.on(App.Bus.EVENTS.DATA_LOADED, () => {
      if (_suppressSync) return;
      try { _syncChannel.postMessage({ type: 'data-changed', at: Date.now() }); } catch (e) {}
    });
  }

  async function start() {
    try { if (App.PWAService) await App.PWAService.init(); } catch (e) { console.warn('[PWA] راه‌اندازی ناموفق:', e); }
    initCrossTabSync();
    App.UI.applyTheme(S.getTheme());

    if (Auth.isLoggedIn()) {
      const ok = await Auth.validateSession();
      if (ok) { await enterApp(); return; }
    }

    const hasUsers = await Auth.hasAnyUser();
    state._authMode = hasUsers ? 'login' : 'setup';
    showAuth();
  }

  return { start, enterApp, render, switchTab, loadFile, onPickFile };
})();

function bindGlobal() {
  const $ = (id) => document.getElementById(id);

  $('btnLoad').onclick = () => $('fileInput').click();
  $('fileInput').onchange = (e) => {
    if (e.target.files[0]) App.Boot.loadFile(e.target.files[0]);
    e.target.value = '';
  };
  $('btnPrint').onclick = () => window.print();
  $('btnTheme').onclick = () => {
    App.UI.toggleTheme();
    if (App.AuthService.isLoggedIn()) App.Boot.render();
  };

  $('modalClose').onclick = App.UI.closeModal;
  $('modal').onclick = (e) => { if (e.target.id === 'modal') App.UI.closeModal(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') App.UI.closeModal(); });

  const dropdown = $('userDropdown');
  const btnUser = $('btnUser');
  if (btnUser && dropdown) {
    btnUser.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('open'); };
    document.addEventListener('click', () => dropdown.classList.remove('open'));
    dropdown.querySelectorAll('a[data-action]').forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        dropdown.classList.remove('open');
        const act = a.dataset.action;
        if (act === 'logout') {
          if (!confirm('از سامانه خارج می‌شوید؟')) return;
          App.AuthService.logout();
          App.NotifyService?.unmountBellIcon?.();
          App.NotifyService?.stopScheduler?.();
          App.Boot.start();
        } else if (act === 'change-password') {
          openSelfChangePassword();
        } else if (act === 'settings') {
          App.Boot.switchTab('settings');
        }
      };
    });
  }

  ['dragover', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => e.preventDefault()));
  window.addEventListener('drop', (e) => {
    if (!App.AuthService.isLoggedIn()) return;
    const f = e.dataTransfer?.files?.[0];
    if (f) App.Boot.loadFile(f);
  });

  App.Bus.on(App.Bus.EVENTS.DATA_CLEARED, () => {
    App.State.reset();
    App.Boot.render();
  });

  const menuBtn = $('menuBtn');
  const sidebar = $('sidebar');
  const backdrop = $('sidebarBackdrop');
  function closeSidebar() { sidebar?.classList.remove('open'); backdrop?.classList.remove('open'); }

  menuBtn?.addEventListener('click', () => { sidebar?.classList.toggle('open'); backdrop?.classList.toggle('open'); });
  backdrop?.addEventListener('click', closeSidebar);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) closeSidebar(); });

  setupGlobalSearch();
}

function openSelfChangePassword() {
  const user = App.AuthService.getCurrentUser();
  if (!user) return;
  App.UI.openModal(`
    <h2 style="margin:0 0 14px">تغییر رمز عبور</h2>
    <div id="cpAlert"></div>
    <form id="cpForm">
      <div class="field"><label>رمز جدید</label><input type="password" id="cp-p1" required minlength="6"></div>
      <div class="field"><label>تکرار رمز جدید</label><input type="password" id="cp-p2" required minlength="6"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button type="button" class="btn plain" onclick="App.UI.closeModal()">انصراف</button>
        <button type="submit" class="btn solid">ذخیره</button>
      </div>
    </form>`);
  document.getElementById('cpForm').onsubmit = async (e) => {
    e.preventDefault();
    const a = document.getElementById('cp-p1').value;
    const b = document.getElementById('cp-p2').value;
    const alertBox = document.getElementById('cpAlert');
    if (a !== b) { alertBox.innerHTML = '<div class="login-error">رمزها یکسان نیستند</div>'; return; }
    try {
      await App.AuthService.changePassword(user.username, a);
      App.UI.closeModal();
      App.UI.toast.success('رمز عبور با موفقیت تغییر یافت');
    } catch (err) { alertBox.innerHTML = `<div class="login-error">${App.Utils.esc(err.message)}</div>`; }
  };
}

document.addEventListener('DOMContentLoaded', () => { bindGlobal(); App.Boot.start(); });

function setupGlobalSearch() {
  const input = document.getElementById('globalSearch');
  const results = document.getElementById('globalSearchResults');
  if (!input || !results) return;
  const U = App.Utils;
  let timer = null;

  const closeResults = () => { results.classList.remove('open'); results.innerHTML = ''; };
  const run = () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { closeResults(); return; }
    const state = App.State.state;
    let hits = [];
    [...state.members.values()].filter(m => (m.name || '').toLowerCase().includes(q) || (m.code || '').toLowerCase().includes(q)).slice(0, 4).forEach(m => hits.push({ type: 'member', icon: '👤', title: m.name, sub: `کد: ${m.code}`, action: () => App.Views.openMember(m.code, state) }));
    (state.loans || []).filter(l => (l.name || '').toLowerCase().includes(q) || (l.memberCode || '').toLowerCase().includes(q)).slice(0, 3).forEach(l => hits.push({ type: 'loan', icon: '💳', title: l.name || l.memberCode, sub: `وام ${U.fmt(l.amount)} تومان`, action: () => App.Boot.switchTab('loan-detail', { id: l.id }) }));
    
    if (!hits.length) { results.innerHTML = '<div class="gsr-empty">چیزی پیدا نشد</div>'; results.classList.add('open'); return; }
    let html = `<div class="gsr-group">نتایج</div>`;
    hits.forEach((h, idx) => {
      html += `<div class="gsr-item" data-idx="${idx}"><div class="gsr-icon">${h.icon}</div><div class="gsr-body"><div class="gsr-title">${U.esc(h.title)}</div><div class="gsr-sub">${U.esc(h.sub)}</div></div></div>`;
    });
    results.innerHTML = html;
    results.classList.add('open');
    results.querySelectorAll('.gsr-item').forEach(el => {
      el.onclick = () => { const h = hits[+el.dataset.idx]; closeResults(); input.value = ''; h.action(); };
    });
  };

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 180); });
  document.addEventListener('click', (e) => { if (!input.contains(e.target) && !results.contains(e.target)) closeResults(); });
}