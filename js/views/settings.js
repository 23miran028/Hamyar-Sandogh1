/* =========================================================
   views/settings.js — تنظیمات، کاربران، PWA
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.settings = function (root, state) {
  const Auth = App.AuthService;
  const U = App.Utils;

  if (!Auth.hasRole('admin')) {
    root.innerHTML = '<div class="card"><div class="empty">⛔ شما به این بخش دسترسی ندارید.</div></div>';
    return;
  }

  (async () => {
    const users = await Auth.listUsers();
    const me = Auth.getCurrentUser();

    root.innerHTML = `
      <div class="card">
        <h3><span class="dot"></span> کاربران سامانه</h3>
        <div class="controls">
          <button class="btn plain" id="addUser">➕ کاربر جدید</button>
          <span class="spacer"></span>
          <button class="btn plain" id="changeMyPass">🔑 تغییر رمز عبور من</button>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>نام کاربری</th><th>نام نمایشی</th><th>نقش</th>
                <th>عضو مرتبط</th><th>وضعیت</th><th>آخرین ورود</th><th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td><b>${U.esc(u.username)}</b>${u.username === me.username
                    ? ' <span class="badge b">شما</span>' : ''}</td>
                  <td>${U.esc(u.displayName)}</td>
                  <td><span class="role-badge role-${u.role}">${U.esc(Auth.ROLE_LABELS[u.role])}</span></td>
                  <td>${u.memberCode ? U.esc(u.memberCode) : '—'}</td>
                  <td>${u.isActive
                    ? '<span class="badge ok">فعال</span>'
                    : '<span class="badge mut">غیرفعال</span>'}</td>
                  <td>${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('fa-IR') : '—'}</td>
                  <td>
                    <button class="btn plain sm" data-act="edit" data-user="${U.esc(u.username)}">✏️</button>
                    <button class="btn plain sm" data-act="resetpass" data-user="${U.esc(u.username)}">🔑</button>
                    ${u.username !== me.username && u.username !== 'admin'
                      ? `<button class="btn plain sm" data-act="del" data-user="${U.esc(u.username)}"
                                 style="color:var(--danger)">🗑️</button>` : ''}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3><span class="dot"></span> راهنمای نقش‌ها</h3>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>نقش</th><th>دسترسی‌ها</th></tr></thead>
            <tbody>
              <tr><td><span class="role-badge role-admin">مدیر</span></td>
                  <td>دسترسی کامل به تمام بخش‌ها، مدیریت کاربران، پاک‌سازی داده</td></tr>
              <tr><td><span class="role-badge role-treasurer">خزانه‌دار</span></td>
                  <td>ثبت معاملات، مدیریت وام‌ها، مشاهده اعضا و گزارش‌ها</td></tr>
              <tr><td><span class="role-badge role-auditor">بازرس</span></td>
                  <td>فقط مشاهده: اعضا، وام‌ها، معاملات، گزارش‌ها، لاگ‌ها</td></tr>
              <tr><td><span class="role-badge role-member">عضو</span></td>
                  <td>فقط مشاهده اطلاعات خودش</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ⬇️ کارت PWA ⬇️ -->
      <div class="card">
        <h3><span class="dot"></span> نصب و آفلاین (PWA)</h3>
        <div id="pwaStatus"></div>
      </div>
    `;

    /* رویدادها */
    root.querySelector('#addUser').onclick = () => openUserForm(null);
    root.querySelector('#changeMyPass').onclick = () => openPasswordForm(me.username, 'تغییر رمز عبور');
    root.querySelectorAll('button[data-act]').forEach(b => {
      b.onclick = () => {
        const uname = b.dataset.user, act = b.dataset.act;
        if (act === 'edit')      openUserForm(uname);
        if (act === 'resetpass') openPasswordForm(uname, 'بازنشانی رمز');
        if (act === 'del')       confirmDelete(uname);
      };
    });

    /* ⬇️ نمایش وضعیت PWA ⬇️ */
    renderPWAStatus();
  })();

  /* ---------- فرم کاربر ---------- */
  async function openUserForm(username) {
    const isEdit = !!username;
    const user = isEdit ? await Auth.getUser(username) : null;

    const memberOpts = [...state.members.values()]
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
      .map(m => `<option value="${U.esc(m.code)}" ${user?.memberCode === m.code ? 'selected' : ''}>
        ${U.esc(m.code)} — ${U.esc(m.name)}</option>`).join('');

    App.UI.openModal(`
      <h2 style="margin:0 0 14px">${isEdit ? 'ویرایش کاربر' : 'کاربر جدید'}</h2>
      <div id="ufAlert"></div>
      <form id="userForm">
        <div class="field">
          <label>نام کاربری</label>
          <input type="text" id="uf-username" value="${user ? U.esc(user.username) : ''}"
                 ${isEdit ? 'disabled' : 'required'} pattern="[a-zA-Z0-9_.-]{3,}">
        </div>
        <div class="field">
          <label>نام نمایشی</label>
          <input type="text" id="uf-displayname" value="${user ? U.esc(user.displayName) : ''}" required>
        </div>
        ${!isEdit ? `
        <div class="field">
          <label>رمز عبور اولیه</label>
          <input type="password" id="uf-password" required minlength="6">
        </div>` : ''}
        <div class="field">
          <label>نقش</label>
          <select id="uf-role">
            ${Auth.ROLES.map(r => `<option value="${r}" ${user?.role === r ? 'selected' : ''}>
              ${U.esc(Auth.ROLE_LABELS[r])}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>عضو مرتبط (اختیاری)</label>
          <select id="uf-member">
            <option value="">— هیچ‌کدام —</option>
            ${memberOpts}
          </select>
        </div>
        ${isEdit ? `
        <div class="field">
          <label>وضعیت</label>
          <select id="uf-active">
            <option value="1" ${user.isActive ? 'selected' : ''}>فعال</option>
            <option value="0" ${!user.isActive ? 'selected' : ''}>غیرفعال</option>
          </select>
        </div>` : ''}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button type="button" class="btn plain" onclick="App.UI.closeModal()">انصراف</button>
          <button type="submit" class="btn solid">${isEdit ? 'ذخیره' : 'ایجاد'}</button>
        </div>
      </form>`);

    document.getElementById('userForm').onsubmit = async (e) => {
      e.preventDefault();
      const alertBox = document.getElementById('ufAlert');
      try {
        if (isEdit) {
          await Auth.updateUser(username, {
            displayName: document.getElementById('uf-displayname').value.trim(),
            role:        document.getElementById('uf-role').value,
            memberCode:  document.getElementById('uf-member').value || null,
            isActive:    document.getElementById('uf-active').value === '1'
          });
        } else {
          await Auth.createUser({
            username:    document.getElementById('uf-username').value.trim(),
            password:    document.getElementById('uf-password').value,
            displayName: document.getElementById('uf-displayname').value.trim(),
            role:        document.getElementById('uf-role').value,
            memberCode:  document.getElementById('uf-member').value || null
          });
        }
        App.UI.closeModal();
        App.Views.settings(root, state);
      } catch (err) {
        alertBox.innerHTML = `<div class="login-error">${U.esc(err.message)}</div>`;
      }
    };
  }

  /* ---------- فرم رمز عبور ---------- */
  function openPasswordForm(username, title) {
    App.UI.openModal(`
      <h2 style="margin:0 0 14px">${U.esc(title)} — ${U.esc(username)}</h2>
      <div id="cpAlert"></div>
      <form id="cpForm">
        <div class="field"><label>رمز جدید</label>
          <input type="password" id="cp-p1" required minlength="6"></div>
        <div class="field"><label>تکرار رمز جدید</label>
          <input type="password" id="cp-p2" required minlength="6"></div>
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
        await Auth.changePassword(username, a);
        App.UI.closeModal();
        alert('رمز عبور با موفقیت تغییر یافت');
      } catch (err) {
        alertBox.innerHTML = `<div class="login-error">${U.esc(err.message)}</div>`;
      }
    };
  }

  async function confirmDelete(username) {
    if (!confirm(`کاربر «${username}» حذف شود؟ این عمل بازگشت‌پذیر نیست.`)) return;
    try {
      await Auth.deleteUser(username);
      App.Views.settings(root, state);
    } catch (e) { alert(e.message); }
  }

  /* ---------- نمایش وضعیت PWA ---------- */
  function renderPWAStatus() {
    const el = root.querySelector('#pwaStatus');
    if (!el) return;

    const st = App.PWAService?.getStatus?.() || {};
    const rows = [];

    rows.push({
      label: 'پشتیبانی مرورگر',
      value: st.supported ? '✅ دارد' : '❌ ندارد',
      ok: st.supported
    });

    rows.push({
      label: 'Context امن (HTTPS یا localhost)',
      value: st.secure ? '✅ دارد' : '❌ ندارد',
      ok: st.secure,
      hint: st.fileProtocol
        ? '⚠️ برنامه از file:// باز شده. برای فعال‌سازی کامل، از http://localhost استفاده کن.'
        : null
    });

    rows.push({
      label: 'Service Worker',
      value: st.registration ? '✅ فعال' : '❌ غیرفعال',
      ok: st.registration
    });

    rows.push({
      label: 'نصب‌شده روی دستگاه',
      value: st.installed ? '✅ بله' : '❌ خیر',
      ok: st.installed
    });

    rows.push({
      label: 'وضعیت شبکه',
      value: st.offline ? '📵 آفلاین' : '🌐 آنلاین',
      ok: !st.offline
    });

    if (st.updateReady) {
      rows.push({
        label: 'به‌روزرسانی',
        value: '🔄 نسخه جدید آماده',
        ok: true,
        action: '<button class="btn solid sm" onclick="App.PWAService.applyUpdate()">به‌روزرسانی</button>'
      });
    }

    el.innerHTML = `
      <table class="tbl">
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="width:50%;color:var(--muted)">${r.label}</td>
              <td>
                ${r.value}
                ${r.hint ? `<div style="font-size:11.5px;color:var(--warn);margin-top:4px">${r.hint}</div>` : ''}
              </td>
              <td style="text-align:end">${r.action || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${!st.installed && st.canInstall ? `
        <div style="margin-top:16px">
          <button class="btn solid" id="pwaInstallBtn">📱 نصب برنامه روی دستگاه</button>
        </div>
      ` : ''}

      ${st.installed ? `
        <div class="form-alert" style="background:rgba(21,128,61,.08);color:var(--ok);margin-top:16px">
          ✅ برنامه نصب شده است. برای اجرا، از آیکون روی صفحه اصلی استفاده کن.
        </div>
      ` : ''}
    `;

    const btn = el.querySelector('#pwaInstallBtn');
    if (btn) {
      btn.onclick = async () => {
        const r = await App.PWAService.promptInstall();
        if (r.outcome === 'accepted') {
          App.UI.toast.success('✅ نصب آغاز شد');
        } else if (r.outcome === 'unavailable') {
          App.UI.toast.warn('نصب از این مرورگر پشتیبانی نمی‌شود');
        }
      };
    }
  }
};