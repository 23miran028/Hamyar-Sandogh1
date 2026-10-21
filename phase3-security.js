/* =========================================================
   phase3-security.js — امنیت، قفل خودکار و لاگ تفصیلی (فاز ۳)
   ========================================================= */
(function() {
  if (window._phase3SecurityApplied) return;
  window._phase3SecurityApplied = true;

  console.log('🔒 [Phase 3] در حال فعال‌سازی ماژول امنیت و لاگ تفصیلی...');

  const U = App.Utils;
  const Auth = App.AuthService;

  // ═══════════════════════════════════════════════════════════
  // ۱. استایل‌های مربوط به لاگ تفصیلی و دکمه قفل
  // ═══════════════════════════════════════════════════════════
  const style = document.createElement('style');
  style.innerHTML = `
    .diff-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; direction: ltr; text-align: left; }
    .diff-table th, .diff-table td { border: 1px solid var(--line); padding: 8px 12px; }
    .diff-table th { background: var(--bg-soft); color: var(--text); font-weight: bold; }
    .diff-old { color: var(--danger-600); text-decoration: line-through; background: var(--danger-bg); }
    .diff-new { color: var(--ok-600); font-weight: bold; background: var(--ok-bg); }
    .audit-row { cursor: pointer; transition: background 0.2s; }
    .audit-row:hover { background: var(--panel-2); }
    #btnLockApp { color: var(--warn-600) !important; font-weight: bold; }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════════════════
  // ۲. دکمه قفل دستی در منوی کاربر
  // ═══════════════════════════════════════════════════════════
  setTimeout(() => {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown && !document.getElementById('btnLockApp')) {
      const lockBtn = document.createElement('a');
      lockBtn.href = "#";
      lockBtn.id = "btnLockApp";
      lockBtn.innerHTML = "🔒 قفل کردن سیستم";
      lockBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        App.AuthService.logout();
        App.UI.closeModal();
        App.Boot.start();
        App.UI.toast.info('سیستم با موفقیت قفل شد.');
      };
      
      const divider = dropdown.querySelector('.dropdown-divider');
      if (divider) dropdown.insertBefore(lockBtn, divider);
      else dropdown.appendChild(lockBtn);
    }
  }, 1000);

  // ═══════════════════════════════════════════════════════════
  // ۳. اعمال زمان قفل خودکارِ قابل تنظیم
  // ═══════════════════════════════════════════════════════════
  // مقدار پیش‌فرض ۳۰ دقیقه است، اما اگر مدیر تنظیمات را عوض کند، خوانده می‌شود
  const getLockMins = () => parseInt(localStorage.getItem('fund_autolock_mins') || '30', 10);
  
  const origIsLoggedIn = Auth.isLoggedIn;
  Auth.isLoggedIn = function() {
    if (!origIsLoggedIn.call(this)) return false;
    const user = Auth.getCurrentUser();
    if (user && user.lastActivity) {
      const lockMins = getLockMins();
      if (Date.now() - user.lastActivity > (lockMins * 60 * 1000)) {
        Auth.logout();
        App.UI.toast.warn(`سیستم به دلیل عدم فعالیت بیش از ${U.toFa(lockMins)} دقیقه قفل شد.`);
        App.Boot.start();
        return false;
      }
    }
    return true;
  };

  // ═══════════════════════════════════════════════════════════
  // ۴. افزودن فیلد تنظیم زمان قفل به صفحه تنظیمات صندوق
  // ═══════════════════════════════════════════════════════════
  const origSettingsGlobal = App.Views.settingsGlobal;
  App.Views.settingsGlobal = function(root, state) {
    origSettingsGlobal.call(this, root, state);
    setTimeout(() => {
      const secTitle = [...root.querySelectorAll('.section-title')].find(el => el.textContent.includes('واحد پول'));
      if (secTitle && !document.getElementById('st-lock-mins')) {
        const lockDiv = document.createElement('div');
        lockDiv.innerHTML = `
          <div class="section-title">🔒 امنیت و قفل خودکار</div>
          <div class="field" style="max-width:300px">
            <label for="st-lock-mins">قفل شدن خودکار پس از (دقیقه)</label>
            <input type="number" id="st-lock-mins" value="${getLockMins()}" min="1" max="120">
            <div class="field-hint">اگر برای مدتی با سیستم کار نکنید، به صفحه ورود هدایت می‌شوید.</div>
          </div>
        `;
        secTitle.parentNode.insertBefore(lockDiv, secTitle);

        // دکمه ذخیره
        const saveBtn = root.querySelector('#stSave');
        if (saveBtn) {
          const origClick = saveBtn.onclick;
          saveBtn.onclick = async (e) => {
            const mins = Number(document.getElementById('st-lock-mins').value) || 30;
            localStorage.setItem('fund_autolock_mins', mins);
            return origClick.call(saveBtn, e);
          };
        }
      }
    }, 100);
  };

  // ═══════════════════════════════════════════════════════════
  // ۵. بازنویسی صفحه لاگ تغییرات برای نمایش Diff
  // ═══════════════════════════════════════════════════════════
  App.Views.auditLog = function(root, state) {
    (async () => {
      const logs = await App.DataService.Repos.audit.all();
      logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const actionColors = {
        'edit:member': 'brand', 'edit:period': 'warning', 'edit:snapshot': 'purple',
        'edit:loan': 'success', 'edit:loan-delete': 'danger', 'loan:disburse': 'success',
        'loan:pay': 'ok', 'period:add': 'brand', 'import': 'purple'
      };

      root.innerHTML = `
        <div class="card">
          <div class="controls">
            <h3 style="margin:0"><span class="dot"></span> 📋 لاگ تغییرات (قابل کلیک برای جزئیات)</h3>
            <span class="spacer"></span>
            <span class="badge mut">${U.toFa(logs.length)} رویداد</span>
            <button class="btn plain sm" id="refreshBtn">🔄 رفرش</button>
          </div>

          <div class="tbl-wrap" style="max-height:70vh">
            <table class="tbl">
              <thead><tr>
                <th>تاریخ</th><th>عملیات</th><th>کاربر</th><th>موجودیت</th><th>شناسه</th>
              </tr></thead>
              <tbody>
                ${logs.length ? logs.slice(0, 300).map((l, idx) => {
                  const tone = actionColors[l.action] || 'mut';
                  const dt = l.timestamp ? new Date(l.timestamp).toLocaleString('fa-IR') : '—';
                  return `<tr class="audit-row" data-idx="${idx}">
                    <td style="font-size:11.5px;color:var(--muted)">${U.esc(dt)}</td>
                    <td><span class="badge ${tone}">${U.esc(l.action || '—')}</span></td>
                    <td>${U.esc(l.actor || '—')}</td>
                    <td>${U.esc(l.entity || '—')}</td>
                    <td><span class="badge b" style="font-size:10.5px">${U.esc(String(l.entityId || '—').slice(0, 20))}</span></td>
                  </tr>`;
                }).join('') : '<tr><td colspan="5"><div class="empty">لاگی موجود نیست</div></td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;

      root.querySelector('#refreshBtn').onclick = () => App.Views.auditLog(root, state);

      // هندل کلیک برای نمایش جزئیات
      root.querySelectorAll('.audit-row').forEach(tr => {
        tr.onclick = () => {
          const log = logs[+tr.dataset.idx];
          showAuditDiff(log);
        };
      });
    })();
  };

  // تابع نمایش پنجره Diff
  function showAuditDiff(log) {
    let bodyHtml = `<h2 style="margin:0 0 10px">📄 جزئیات تغییر</h2>
      <div style="margin-bottom:15px; font-size:13px; color:var(--text-2)">
        <b>عملیات:</b> ${U.esc(log.action)} <br>
        <b>کاربر:</b> ${U.esc(log.actor)} <br>
        <b>زمان:</b> ${new Date(log.timestamp).toLocaleString('fa-IR')}
      </div>`;

    if (log.before && log.after) {
      bodyHtml += `<table class="diff-table">
        <thead><tr><th>فیلد</th><th>مقدار قبلی (Before)</th><th>مقدار جدید (After)</th></tr></thead>
        <tbody>`;
      
      const keys = [...new Set([...Object.keys(log.before), ...Object.keys(log.after)])];
      let hasChanges = false;
      
      keys.forEach(k => {
        const bVal = JSON.stringify(log.before[k] ?? '');
        const aVal = JSON.stringify(log.after[k] ?? '');
        if (bVal !== aVal && k !== 'updatedAt') {
          hasChanges = true;
          bodyHtml += `<tr>
            <td><b>${U.esc(k)}</b></td>
            <td class="diff-old">${U.esc(log.before[k] !== undefined && log.before[k] !== null ? log.before[k] : '—')}</td>
            <td class="diff-new">${U.esc(log.after[k] !== undefined && log.after[k] !== null ? log.after[k] : '—')}</td>
          </tr>`;
        }
      });
      
      bodyHtml += `</tbody></table>`;
      if (!hasChanges) bodyHtml = `<div class="empty">هیچ فیلد قابل نمایشی تغییر نکرده است.</div>`;
      
    } else if (log.after) {
      bodyHtml += `<div style="background:var(--bg-soft); padding:15px; border-radius:8px; direction:ltr; text-align:left;"><pre style="margin:0; font-size:12px">${JSON.stringify(log.after, null, 2)}</pre></div>`;
    } else if (log.before) {
      bodyHtml += `<div style="background:var(--bg-soft); padding:15px; border-radius:8px; direction:ltr; text-align:left;"><pre style="margin:0; font-size:12px">${JSON.stringify(log.before, null, 2)}</pre></div>`;
    } else {
      bodyHtml += `<div class="empty">داده‌ای برای نمایش وجود ندارد.</div>`;
    }

    App.UI.openModal(bodyHtml);
  }

  console.log('✅ [Phase 3] ماژول امنیت و لاگ تفصیلی فعال شد.');
})();