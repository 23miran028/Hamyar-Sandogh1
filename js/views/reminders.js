/* =========================================================
   views/reminders.js — صفحه یادآورها
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.reminders = function (root, state) {
  const U = App.Utils;
  const NS = App.NotifyService;

  (async () => {
    await NS.loadSettings();
    const reminders = await NS.computeReminders();
    const stats = NS.countBySeverity();
    const settings = NS.getSettings();

    const severityLabels = {
      danger:  { label: 'خطر',   cls: 'danger' },
      warn:    { label: 'هشدار', cls: 'warn' },
      info:    { label: 'اطلاع', cls: 'info' },
      success: { label: 'موفق',  cls: 'success' }
    };

    const renderReminder = (r) => `
      <div class="reminder-item reminder-${r.severity}" data-key="${U.esc(r.key)}">
        <div class="reminder-icon">${r.icon || '•'}</div>
        <div class="reminder-body">
          <div class="reminder-title">${U.esc(r.title)}</div>
          <div class="reminder-msg">${U.esc(r.message)}</div>
        </div>
        <div class="reminder-actions">
          ${r.action ? `<button class="btn plain sm js-action"
            data-route="${U.esc(r.action.route)}"
            data-params='${JSON.stringify(r.action.params || {})}'>
            ${U.esc(r.action.label)}</button>` : ''}
        </div>
      </div>`;

    const perm = NS.getPermission();
    const permInfo = {
      granted:     { icon: '✅', text: 'اعلان مرورگر فعال است', cls: 'ok' },
      denied:      { icon: '🚫', text: 'اعلان مرورگر مسدود شده — در تنظیمات مرورگر اجازه دهید', cls: 'danger' },
      default:     { icon: '❓', text: 'اعلان مرورگر فعال نیست — برای فعال‌سازی کلیک کنید', cls: 'warn' },
      unsupported: { icon: '⚠️', text: 'مرورگر شما از اعلان پشتیبانی نمی‌کند', cls: 'mut' }
    }[perm] || { icon: '❔', text: 'وضعیت نامشخص', cls: 'mut' };

    const groups = {
      danger:  reminders.filter(r => r.severity === 'danger'),
      warn:    reminders.filter(r => r.severity === 'warn'),
      info:    reminders.filter(r => r.severity === 'info'),
      success: reminders.filter(r => r.severity === 'success')
    };

    root.innerHTML = `
      <div class="card">
        <div class="controls">
          <h3 style="margin:0"><span class="dot"></span> مرکز یادآورها</h3>
          <span class="spacer"></span>
          <button class="btn plain sm" id="btnRefresh">🔄 بررسی مجدد</button>
          <button class="btn plain sm" id="btnSettings">⚙️ تنظیمات اعلان</button>
        </div>

        <div class="reminder-stats">
          <div class="rstat rstat-danger">
            <div class="rstat-val">${U.toFa(stats.danger)}</div>
            <div class="rstat-lbl">خطر</div>
          </div>
          <div class="rstat rstat-warn">
            <div class="rstat-val">${U.toFa(stats.warn)}</div>
            <div class="rstat-lbl">هشدار</div>
          </div>
          <div class="rstat rstat-info">
            <div class="rstat-val">${U.toFa(stats.info)}</div>
            <div class="rstat-lbl">اطلاع</div>
          </div>
          <div class="rstat rstat-success">
            <div class="rstat-val">${U.toFa(stats.success)}</div>
            <div class="rstat-lbl">موفق</div>
          </div>
        </div>

        <div class="reminder-perm reminder-perm-${permInfo.cls}">
          <span class="reminder-perm-icon">${permInfo.icon}</span>
          <span>${U.esc(permInfo.text)}</span>
          ${perm === 'default' ? '<button class="btn plain sm" id="btnAllowNotif" style="margin-right:auto">🔔 فعال‌سازی</button>' : ''}
        </div>
      </div>

      ${!reminders.length ? `
        <div class="card">
          <div class="empty" style="padding:60px 20px">
            <div style="font-size:56px;margin-bottom:12px">✨</div>
            <h3 style="margin:0 0 6px">همه چیز مرتب است</h3>
            <p style="color:var(--muted);margin:0">هیچ یادآور فعالی وجود ندارد.</p>
          </div>
        </div>
      ` : `
        ${groups.danger.length ? `
          <div class="card">
            <h3><span class="dot" style="background:var(--danger)"></span>
              🔴 نیازمند اقدام فوری (${U.toFa(groups.danger.length)})</h3>
            <div class="reminder-list">
              ${groups.danger.map(renderReminder).join('')}
            </div>
          </div>` : ''}

        ${groups.warn.length ? `
          <div class="card">
            <h3><span class="dot" style="background:var(--warn)"></span>
              🟡 هشدارها (${U.toFa(groups.warn.length)})</h3>
            <div class="reminder-list">
              ${groups.warn.map(renderReminder).join('')}
            </div>
          </div>` : ''}

        ${groups.info.length ? `
          <div class="card">
            <h3><span class="dot" style="background:var(--brand)"></span>
              🔵 اطلاع‌رسانی (${U.toFa(groups.info.length)})</h3>
            <div class="reminder-list">
              ${groups.info.map(renderReminder).join('')}
            </div>
          </div>` : ''}

        ${groups.success.length ? `
          <div class="card">
            <h3><span class="dot" style="background:var(--ok)"></span>
              🟢 موفقیت‌ها (${U.toFa(groups.success.length)})</h3>
            <div class="reminder-list">
              ${groups.success.map(renderReminder).join('')}
            </div>
          </div>` : ''}
      `}
    `;

    /* رویدادها */
    root.querySelector('#btnRefresh').onclick = async () => {
      await NS.computeReminders();
      NS.updateBadge();
      App.Views.reminders(root, state);
      App.UI.toast?.success('یادآورها به‌روز شد');
    };

    root.querySelector('#btnSettings').onclick = () => openSettings();

    const btnAllow = root.querySelector('#btnAllowNotif');
    if (btnAllow) {
      btnAllow.onclick = async () => {
        const p = await NS.requestPermission();
        if (p === 'granted') {
          App.UI.toast?.success('اعلان مرورگر فعال شد');
          await NS.showNativeNotification('سامانه صندوق', 'اعلان‌ها با موفقیت فعال شدند.', 'welcome');
        } else if (p === 'denied') {
          App.UI.toast?.warn('اجازه اعلان داده نشد');
        }
        App.Views.reminders(root, state);
      };
    }

    root.querySelectorAll('.js-action').forEach(b => {
      b.onclick = () => {
        const route = b.dataset.route;
        let params = {};
        try { params = JSON.parse(b.dataset.params || '{}'); } catch {}
        App.Boot.switchTab(route, Object.keys(params).length ? params : null);
      };
    });
  })();

  /* ---------- مودال تنظیمات ---------- */
  function openSettings() {
    const s = NS.getSettings();

    App.UI.openModal(`
      <h2 style="margin:0 0 16px">⚙️ تنظیمات اعلان‌ها</h2>

      <div class="field">
        <label>
          <input type="checkbox" id="ns-enabled" ${s.enabled ? 'checked' : ''}
                 style="width:auto;margin-left:8px">
          فعال بودن سیستم یادآورها
        </label>
      </div>

      <div class="field">
        <label>
          <input type="checkbox" id="ns-native" ${s.nativeEnabled ? 'checked' : ''}
                 style="width:auto;margin-left:8px">
          نمایش اعلان مرورگر (نیاز به اجازه)
        </label>
      </div>

      <div class="section-title">انواع یادآور</div>

      <div class="field">
        <label><input type="checkbox" id="ns-overdue" ${s.notifyOverdue ? 'checked' : ''}
                      style="width:auto;margin-left:8px"> اقساط معوق</label>
      </div>
      <div class="field">
        <label><input type="checkbox" id="ns-period" ${s.notifyPeriodMissing ? 'checked' : ''}
                      style="width:auto;margin-left:8px"> دوره جدید ثبت نشده</label>
      </div>
      <div class="field">
        <label><input type="checkbox" id="ns-settled" ${s.notifyLoanSettled ? 'checked' : ''}
                      style="width:auto;margin-left:8px"> وام‌های تسویه‌شده</label>
      </div>
      <div class="field">
        <label><input type="checkbox" id="ns-eligible" ${s.notifyLoanEligible ? 'checked' : ''}
                      style="width:auto;margin-left:8px"> اعضای واجد شرایط وام</label>
      </div>

      <div class="section-title">فاصله‌ی بررسی خودکار</div>
      <div class="field">
        <select id="ns-interval">
          ${[5, 15, 30, 60, 120].map(m =>
            `<option value="${m}" ${s.schedulerMinutes === m ? 'selected' : ''}>
              هر ${U.toFa(m)} دقیقه
            </option>`).join('')}
        </select>
      </div>

      <div class="field-hint" style="margin-top:8px">
        آخرین بررسی:
        ${s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString('fa-IR') : 'هرگز'}
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
        <button type="button" class="btn plain" onclick="App.UI.closeModal()">انصراف</button>
        <button type="button" class="btn solid" id="nsSave">💾 ذخیره</button>
      </div>
    `);

    document.getElementById('nsSave').onclick = async () => {
      await NS.saveSettings({
        enabled:             document.getElementById('ns-enabled').checked,
        nativeEnabled:       document.getElementById('ns-native').checked,
        notifyOverdue:       document.getElementById('ns-overdue').checked,
        notifyPeriodMissing: document.getElementById('ns-period').checked,
        notifyLoanSettled:   document.getElementById('ns-settled').checked,
        notifyLoanEligible:  document.getElementById('ns-eligible').checked,
        schedulerMinutes:    Number(document.getElementById('ns-interval').value) || 15
      });
      App.UI.closeModal();
      NS.stopScheduler();
      NS.startScheduler();
      App.Views.reminders(document.getElementById('view'), App.State.state);
      App.UI.toast?.success('تنظیمات ذخیره شد');
    };
  }
};