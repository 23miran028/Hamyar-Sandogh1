/* =========================================================
   ui.js — Sidebar + Toast + Confirm + Form + Modal + Theme
   ========================================================= */
window.App = window.App || {};

App.UI = (function () {
  const U = App.Utils;

  /* =========================================================
     Toast
     ========================================================= */
  function _ensureToastHost() {
    let host = document.getElementById('toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    return host;
  }

  function _showToast(message, opts = {}) {
    const host = _ensureToastHost();
    const kind = opts.kind || 'info';
    const ms = opts.duration ?? 3000;
    const icon = { info:'ℹ️', success:'✅', warn:'⚠️', danger:'❌' }[kind] || 'ℹ️';

    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${U.esc(message)}</span>`;
    host.appendChild(el);

    requestAnimationFrame(() => el.classList.add('in'));
    const close = () => {
      el.classList.remove('in');
      el.classList.add('out');
      setTimeout(() => el.remove(), 250);
    };
    el.onclick = close;
    if (ms > 0) setTimeout(close, ms);
    return close;
  }

  const toast = {
    show: _showToast,
    info:    (m, o) => _showToast(m, { ...o, kind: 'info' }),
    success: (m, o) => _showToast(m, { ...o, kind: 'success' }),
    warn:    (m, o) => _showToast(m, { ...o, kind: 'warn' }),
    error:   (m, o) => _showToast(m, { ...o, kind: 'danger', duration: 5000 })
  };

  /* =========================================================
     Modal (پایه)
     ========================================================= */
  function openModal(html) {
    const modal = document.getElementById('modal');
    if (!modal) return;
    document.getElementById('modalBody').innerHTML = html;
    modal.classList.add('open');
  }
  function closeModal() {
    document.getElementById('modal')?.classList.remove('open');
  }

  /* =========================================================
     Confirm (با Modal)
     ========================================================= */
  function _confirmAsk(opts) {
    const o = typeof opts === 'string' ? { message: opts } : (opts || {});
    return new Promise((resolve) => {
      openModal(`
        <div class="confirm-body">
          <div class="confirm-icon ${o.kind === 'danger' ? 'danger' : ''}">
            ${o.kind === 'danger' ? '⚠️' : '❓'}
          </div>
          <h3>${U.esc(o.title || 'تأیید عملیات')}</h3>
          <p>${U.esc(o.message || '')}</p>
          ${o.details ? `<div class="confirm-details">${U.esc(o.details).replace(/\\n/g, '<br>')}</div>` : ''}
          <div class="confirm-actions">
            <button class="btn plain" id="cf-no">${U.esc(o.cancelText || 'انصراف')}</button>
            <button class="btn ${o.kind === 'danger' ? 'danger' : 'solid'}" id="cf-yes">
              ${U.esc(o.confirmText || 'تأیید')}
            </button>
          </div>
        </div>`);

      const modal = document.getElementById('modal');
      const cleanup = () => {
        closeModal();
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKey);
      };
      const onBackdrop = (e) => { if (e.target.id === 'modal') { cleanup(); resolve(false); } };
      const onKey = (e) => {
        if (e.key === 'Escape') { cleanup(); resolve(false); }
        if (e.key === 'Enter')  { cleanup(); resolve(true);  }
      };
      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKey);

      document.getElementById('cf-no').onclick  = () => { cleanup(); resolve(false); };
      document.getElementById('cf-yes').onclick = () => { cleanup(); resolve(true);  };
    });
  }

  const confirm = {
    ask: _confirmAsk,
    danger: (message, opts) => _confirmAsk({ ...opts, message, kind: 'danger' }),
    info:   (message, opts) => _confirmAsk({ ...opts, message })
  };

  /* =========================================================
     Form helper
     ========================================================= */
  const form = (function () {
    function field({ id, label, type = 'text', value = '', required = false, hint = '', attrs = '', options = null, rows = 1 }) {
      const hintHtml = hint ? `<div class="field-hint">${U.esc(hint)}</div>` : '';
      const attrsStr = attrs ? ' ' + attrs : '';
      if (options) {
        return `<div class="field" data-field="${id}">
          <label for="${id}">${U.esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>
          <select id="${id}"${attrsStr}>
            ${options.map(o => `<option value="${U.esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${U.esc(o.label)}</option>`).join('')}
          </select>
          ${hintHtml}
          <div class="field-error" data-error="${id}"></div>
        </div>`;
      }
      if (type === 'textarea') {
        return `<div class="field" data-field="${id}">
          <label for="${id}">${U.esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>
          <textarea id="${id}" rows="${rows}"${attrsStr}>${U.esc(value)}</textarea>
          ${hintHtml}
          <div class="field-error" data-error="${id}"></div>
        </div>`;
      }
      return `<div class="field" data-field="${id}">
        <label for="${id}">${U.esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>
        <input id="${id}" type="${type}" value="${U.esc(value)}"${attrsStr}>
        ${hintHtml}
        <div class="field-error" data-error="${id}"></div>
      </div>`;
    }

    function read(root, schema) {
      const out = {};
      for (const [k, def] of Object.entries(schema)) {
        const el = root.querySelector('#' + def.id);
        if (!el) continue;
        let v = el.value;
        if (def.type === 'number') v = v === '' ? null : Number(v);
        else if (def.trim !== false) v = String(v).trim();
        out[k] = v;
      }
      return out;
    }

    function setErrors(root, errors) {
      root.querySelectorAll('.field-error').forEach(el => el.textContent = '');
      root.querySelectorAll('.field').forEach(el => el.classList.remove('has-error'));
      for (const [k, msg] of Object.entries(errors || {})) {
        const errEl = root.querySelector(`[data-error="${k}"]`);
        if (errEl) {
          errEl.textContent = msg;
          errEl.closest('.field')?.classList.add('has-error');
        }
      }
    }
    return { field, read, setErrors, clearErrors: (r) => setErrors(r, {}) };
  })();

  /* =========================================================
     Sidebar Navigation (اصلاح‌شده و همگام با منوها)
     ========================================================= */
  const SIDEBAR_GROUPS = [
    {
      title: 'اصلی',
      items: [
        { id: 'dashboard', label: 'داشبورد', icon: '📊', roles: ['admin','treasurer','auditor','member'] },
        { id: 'forecast',  label: 'پیش‌بینی', icon: '🔮', roles: ['admin','treasurer','auditor'] },
        { id: 'reminders', label: 'یادآورها', icon: '🔔', roles: ['admin','treasurer','auditor'] }
      ]
    },
    {
      title: 'مدیریت مالی',
      items: [
        { id: 'members', label: 'اعضا',   icon: '👥', roles: ['admin','treasurer','auditor'] },
        { id: 'loans',   label: 'وام‌ها', icon: '💳', roles: ['admin','treasurer','auditor'] }
      ]
    },
    {
      title: 'گزارش‌ها',
      items: [
        { id: 'monthly', label: 'گزارش ماهانه', icon: '📅', roles: ['admin','treasurer','auditor'] },
        { id: 'yearly',  label: 'گزارش سالانه', icon: '📈', roles: ['admin','treasurer','auditor'] },
        { id: 'reports', label: 'مرکز گزارش‌ها', icon: '📄', roles: ['admin','treasurer','auditor'] }
      ]
    },
    {
      title: 'سیستم',
      items: [
        { id: 'backup',         label: 'پشتیبان‌گیری',   icon: '💾', roles: ['admin'] },
        { id: 'settingsGlobal', label: 'تنظیمات صندوق', icon: '⚙️', roles: ['admin'] },
        { id: 'auditLog',       label: 'لاگ تغییرات',    icon: '📋', roles: ['admin'] },
        { id: 'data',           label: 'داده‌ها',         icon: '🗄️', roles: ['admin'] },
        { id: 'settings',       label: 'کاربران',        icon: '👤', roles: ['admin'] }
      ]
    }
  ];

  const TABS = SIDEBAR_GROUPS
    .reduce((acc, g) => acc.concat(g.items.map(i => ({ ...i, hidden: false }))), [])
    .concat([
      { id:'member-edit',    label:'ویرایش عضو',  roles:[], hidden:true },
      { id:'txn-edit',       label:'ثبت معامله',  roles:[], hidden:true },
      { id:'loan-new',       label:'وام جدید',    roles:[], hidden:true },
      { id:'loan-detail',    label:'جزئیات وام',  roles:[], hidden:true },
      { id:'loan-edit',      label:'ویرایش وام',  roles:[], hidden:true }, // ← اضافه شد
      { id:'period-manage',  label:'مدیریت دوره', roles:[], hidden:true },
      { id:'report-viewer',  label:'نمایش گزارش', roles:[], hidden:true }
    ]);

  function renderTabs(state, onTab) {
    const user = App.AuthService?.getCurrentUser?.();
    if (!user) return; // ← جلوگیری از رندر بدون لاگین
    const role = user.role || 'member';

    const allVisibleItems = SIDEBAR_GROUPS.flatMap(g => g.items).filter(i => !i.roles || i.roles.length === 0 || i.roles.includes(role));
    const isHiddenTab = TABS.some(t => t.id === state.tab && t.hidden);

    if (!isHiddenTab && !allVisibleItems.some(i => i.id === state.tab)) {
      state.tab = allVisibleItems[0]?.id || 'dashboard';
    }

    const inner = document.getElementById('sidebarInner');
    if (!inner) return;

    let html = '';
    for (const group of SIDEBAR_GROUPS) {
      const items = group.items.filter(i => !i.roles || i.roles.length === 0 || i.roles.includes(role));
      if (!items.length) continue;

      html += `<div class="sidebar-group">
        <div class="sidebar-group-title">${group.title}</div>
        ${items.map(it => {
          const active = (!isHiddenTab && state.tab === it.id) ? ' active' : '';
          const badge = it.id === 'reminders' ? '<span class="si-badge" id="sidebarReminderBadge" style="display:none"></span>' : '';
          return `<button class="sidebar-item${active}" data-tab="${it.id}">
            <span class="si-icon">${it.icon}</span>
            <span class="si-label">${it.label}</span>
            ${badge}
          </button>`;
        }).join('')}
      </div>`;
    }

    inner.innerHTML = html;

    inner.querySelectorAll('.sidebar-item').forEach(b => {
      b.onclick = () => {
        onTab(b.dataset.tab);
        if (window.innerWidth <= 900) {
          document.getElementById('sidebar')?.classList.remove('open');
          document.getElementById('sidebarBackdrop')?.classList.remove('open');
        }
      };
    });

    updateSidebarBadge();
  }

  function updateSidebarBadge() {
    const badge = document.getElementById('sidebarReminderBadge');
    if (!badge) return;
    try {
      const n = App.NotifyService?.getBadgeCount?.() || 0;
      if (n === 0) { badge.style.display = 'none'; } 
      else { badge.style.display = ''; badge.textContent = U.toFa(n); }
    } catch {}
  }

  /* =========================================================
     Welcome
     ========================================================= */
  function welcome(el, onPick) {
    el.innerHTML = `
      <div class="welcome">
        <div class="big">🏦</div>
        <h2 style="margin:0 0 6px">به سامانه صندوق قرض‌الحسنه خوش آمدید</h2>
        <p style="color:var(--muted);margin:0">برای شروع، فایل داده <b>workbook.json</b> را بارگذاری کنید.</p>
        <div class="drop" id="drop">
          <h3>📂 فایل داده را اینجا رها کنید</h3>
          <p>یا روی دکمه زیر کلیک کنید (فرمت JSON)</p>
          <button class="btn plain" id="pickBtn">انتخاب فایل داده</button>
          <div class="hint">داده‌ها فقط در مرورگر همین دستگاه ذخیره می‌شود.</div>
        </div>
      </div>`;

    el.querySelector('#pickBtn').onclick = () => onPick();
    const dz = el.querySelector('#drop');
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('hot'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('hot'); }));
    dz.addEventListener('drop', e => { if (e.dataTransfer.files[0]) onPick(e.dataTransfer.files[0]); });
  }

  /* =========================================================
     Theme
     ========================================================= */
  function applyTheme(theme) { document.documentElement.dataset.theme = theme; }
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(cur);
    App.State.setTheme(cur);
    return cur;
  }

  return {
    TABS, SIDEBAR_GROUPS, renderTabs, updateSidebarBadge,
    openModal, closeModal, toast, confirm, form, welcome,
    applyTheme, toggleTheme
  };
})();