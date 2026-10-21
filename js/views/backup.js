/* =========================================================
   views/backup.js — پشتیبان‌گیری و بازیابی
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.backup = function (root, state) {
  const U = App.Utils;
  const BS = App.BackupService;
  const Auth = App.AuthService;

  if (!Auth.hasRole('admin')) {
    root.innerHTML = '<div class="card"><div class="empty">⛔ فقط مدیر می‌تواند به این بخش دسترسی داشته باشد.</div></div>';
    return;
  }

  (async () => {
    const status = await BS.getBackupStatus();
    const snapshots = await BS.listLocalSnapshots();

    /* خلاصه‌ی حجم داده‌ها */
    const counts = {
      members:   state.members.size,
      periods:   state.months.length,
      loans:     (state.loans || []).length,
      yearly:    (state.years || []).length
    };

    const reminderBanner = status.needsReminder ? `
      <div class="backup-reminder">
        <span class="backup-reminder-icon">🔔</span>
        <div>
          <b>${status.lastBackupAt ? 'زمان بکاپ‌گیری رسیده است' : 'هنوز بکاپ نگرفته‌اید'}</b>
          <div>${status.lastBackupAt
            ? `آخرین بکاپ ${U.toFa(status.daysSince)} روز پیش بود. توصیه می‌شود هر ${U.toFa(status.reminderDays)} روز بکاپ بگیرید.`
            : 'برای محافظت از داده‌ها، فوراً یک بکاپ بگیرید.'}</div>
        </div>
      </div>
    ` : `
      <div class="backup-reminder backup-reminder-ok">
        <span class="backup-reminder-icon">✅</span>
        <div>
          <b>بکاپ شما به‌روز است</b>
          <div>آخرین بکاپ: ${status.lastBackupJalali} (${U.toFa(status.daysSince)} روز پیش)</div>
        </div>
      </div>
    `;

    root.innerHTML = `
      <div class="card">
        <div class="controls">
          <h3 style="margin:0"><span class="dot"></span> پشتیبان‌گیری و بازیابی</h3>
          <span class="spacer"></span>
          <span class="badge mut">${U.toFa(snapshots.length)} بکاپ محلی از ${U.toFa(BS.MAX_LOCAL_BACKUPS)}</span>
        </div>
        ${reminderBanner}
      </div>

      <div class="grid kpis" style="margin-bottom:16px">
        <div class="kpi">
          <div class="lbl">اعضا</div>
          <div class="val">${U.toFa(counts.members)}</div>
          <div class="sub">رکورد</div>
        </div>
        <div class="kpi g">
          <div class="lbl">دوره‌ها</div>
          <div class="val">${U.toFa(counts.periods)}</div>
          <div class="sub">ماه</div>
        </div>
        <div class="kpi o">
          <div class="lbl">وام‌ها</div>
          <div class="val">${U.toFa(counts.loans)}</div>
          <div class="sub">فقره</div>
        </div>
        <div class="kpi">
          <div class="lbl">جداول سالانه</div>
          <div class="val">${U.toFa(counts.yearly)}</div>
          <div class="sub">سال</div>
        </div>
      </div>

      <div class="grid charts">

        <!-- ساخت بکاپ -->
        <div class="card backup-panel">
          <h3><span class="dot"></span> 📤 ساخت بکاپ جدید</h3>
          <p style="color:var(--muted);font-size:13px;margin:-4px 0 14px">
            همه‌ی داده‌های برنامه (اعضا، وام‌ها، معاملات، کاربران و تنظیمات) را در یک فایل ذخیره کنید.
          </p>

          <div class="field">
            <label for="bk-note">یادداشت (اختیاری)</label>
            <input type="text" id="bk-note" placeholder="مثلاً: قبل از افزودن داده‌های سال جدید">
          </div>

          <div class="field">
            <label for="bk-password">رمزنگاری با رمز عبور (اختیاری)</label>
            <input type="password" id="bk-password" placeholder="اگر پر شود، فایل رمزنگاری می‌شود">
            <div class="field-hint">
              🔐 رمز باید حداقل ۶ کاراکتر باشد. رمز را <b>جای امن</b> نگه دارید — بازیابی بدون آن ممکن نیست.
            </div>
          </div>

          <div id="bkAlert"></div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
            <button class="btn solid" id="btnCreateBackup">💾 دانلود بکاپ</button>
            <button class="btn plain" id="btnCreateBackupFolder">📁 ذخیره در پوشه…</button>
          </div>
        </div>

        <!-- بازیابی از فایل -->
        <div class="card backup-panel">
          <h3><span class="dot" style="background:var(--warn)"></span> 📥 بازیابی از فایل</h3>
          <p style="color:var(--muted);font-size:13px;margin:-4px 0 14px">
            یک فایل بکاپ (خام یا رمزنگاری‌شده) انتخاب کنید تا داده‌ها بازیابی شوند.
          </p>

          <div class="field">
            <label>انتخاب فایل بکاپ</label>
            <input type="file" id="bk-file" accept=".json,application/json">
          </div>

          <div class="field" id="bk-restore-password-wrap" style="display:none">
            <label for="bk-restore-password">رمز عبور فایل</label>
            <input type="password" id="bk-restore-password" placeholder="رمز فایل رمزنگاری‌شده">
          </div>

          <div id="bkRestoreInfo"></div>
          <div id="bkRestoreAlert"></div>

          <button class="btn solid" id="btnRestore" disabled style="margin-top:12px">
            ♻️ بازیابی داده‌ها
          </button>
        </div>
      </div>

      <div class="card">
        <div class="controls">
          <h3 style="margin:0"><span class="dot" style="background:var(--brand2)"></span>
            🗂️ بکاپ‌های محلی</h3>
          <span class="spacer"></span>
          <button class="btn plain sm" id="btnRefreshSnapshots">🔄 به‌روزرسانی</button>
        </div>
        <p style="color:var(--muted);font-size:12.5px;margin:-4px 0 12px">
          آخرین ${U.toFa(BS.MAX_LOCAL_BACKUPS)} نسخه‌ی خودکار در همین مرورگر نگه داشته می‌شود.
        </p>

        ${snapshots.length ? `
        <div class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>#</th><th>تاریخ</th><th>تهیه‌کننده</th>
                <th>اعضا</th><th>دوره‌ها</th><th>وام‌ها</th>
                <th>نوع</th><th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              ${snapshots.map((s, i) => `
                <tr>
                  <td class="num">${U.toFa(i + 1)}</td>
                  <td>${U.esc(s.createdAtJalali)}</td>
                  <td>${U.esc(s.createdBy)}</td>
                  <td class="num">${U.toFa(s.counts?.members || 0)}</td>
                  <td class="num">${U.toFa(s.counts?.periods || 0)}</td>
                  <td class="num">${U.toFa(s.counts?.loans || 0)}</td>
                  <td>${s.encrypted ? '<span class="badge b">رمزدار</span>' : '<span class="badge mut">خام</span>'}</td>
                  <td class="actions">
                    <button class="btn plain sm js-download" data-id="${U.esc(s.id)}" title="دانلود">⬇️</button>
                    <button class="btn plain sm js-restore" data-id="${U.esc(s.id)}" title="بازیابی" style="color:var(--warn)">♻️</button>
                    <button class="btn plain sm js-delete" data-id="${U.esc(s.id)}" title="حذف" style="color:var(--danger)">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : `
          <div class="empty" style="padding:40px 20px">
            <div style="font-size:44px;margin-bottom:8px">📭</div>
            <p style="margin:0">هنوز بکاپ محلی‌ای ساخته نشده است.</p>
          </div>
        `}
      </div>
    `;

    /* =========== رویدادها =========== */

    /* ساخت و دانلود بکاپ */
    root.querySelector('#btnCreateBackup').onclick = () => createBackup('download');
    root.querySelector('#btnCreateBackupFolder').onclick = () => createBackup('folder');

    async function createBackup(mode) {
      const note = root.querySelector('#bk-note').value.trim();
      const password = root.querySelector('#bk-password').value;
      const alertBox = root.querySelector('#bkAlert');
      alertBox.innerHTML = '';

      if (password && password.length < 6) {
        alertBox.innerHTML = '<div class="form-alert danger">رمز باید حداقل ۶ کاراکتر باشد</div>';
        return;
      }

      const ok = await App.UI.confirm.ask({
        title: 'ساخت بکاپ',
        message: password
          ? 'فایل بکاپ رمزنگاری‌شده ساخته شود؟'
          : 'فایل بکاپ بدون رمز ساخته شود؟',
        details: password
          ? '⚠️ رمز را جای امن نگه دارید — بدون آن بازیابی ممکن نیست.'
          : '🔓 فایل بکاپ بدون رمز است. آن را در جای امن نگه دارید.',
        confirmText: 'بله، بساز'
      });
      if (!ok) return;

      const btn = mode === 'folder'
        ? root.querySelector('#btnCreateBackupFolder')
        : root.querySelector('#btnCreateBackup');
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = '⏳ در حال ساخت…';

      try {
        if (mode === 'folder') {
          const backup = await BS.createBackup({ note });
          let payload = backup;
          if (password) payload = await BS.encryptBackup(backup, password);
          const name = await BS.saveToFolder(payload);
          if (name) {
            await BS.saveLocalSnapshot(backup);
            await BS.markBackupDone();
            App.UI.toast.success(`بکاپ ذخیره شد: ${name}`);
          } else {
            App.UI.toast.warn('ذخیره لغو شد');
          }
        } else {
          const { filename } = await BS.createAndDownload({ note, password });
          App.UI.toast.success(`بکاپ دانلود شد: ${filename}`);
        }
        setTimeout(() => App.Views.backup(root, state), 500);
      } catch (e) {
        console.error(e);
        alertBox.innerHTML = `<div class="form-alert danger">${U.esc(e.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
    }

    /* بازیابی از فایل */
    const fileInput = root.querySelector('#bk-file');
    const pwWrap    = root.querySelector('#bk-restore-password-wrap');
    const pwInput   = root.querySelector('#bk-restore-password');
    const infoBox   = root.querySelector('#bkRestoreInfo');
    const restoreAlert = root.querySelector('#bkRestoreAlert');
    const restoreBtn = root.querySelector('#btnRestore');

    let pendingBackup = null;
    let pendingEncrypted = false;

    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      infoBox.innerHTML = '';
      restoreAlert.innerHTML = '';
      pendingBackup = null;
      pendingEncrypted = false;
      restoreBtn.disabled = true;
      pwWrap.style.display = 'none';

      if (!file) return;

      try {
        const { encrypted, payload } = await BS.readBackupFile(file);

        if (encrypted) {
          pendingEncrypted = true;
          pwWrap.style.display = '';
          infoBox.innerHTML = `
            <div class="form-alert" style="background:rgba(14,116,144,.08);color:var(--brand)">
              🔐 فایل رمزنگاری‌شده است.
              <div style="font-size:12px;margin-top:6px">
                تاریخ ساخت: ${U.esc(payload.createdAtJalali || '—')}
              </div>
            </div>`;
          restoreBtn.disabled = false;
        } else {
          pendingBackup = payload;
          const counts = payload.counts || {};
          infoBox.innerHTML = `
            <div class="form-alert" style="background:rgba(21,128,61,.08);color:var(--ok)">
              ✅ فایل بکاپ معتبر است.
              <table class="tbl" style="margin-top:8px;font-size:12px">
                <tbody>
                  <tr><td>تاریخ بکاپ</td><td>${U.esc(payload.createdAtJalali || '—')}</td></tr>
                  <tr><td>تهیه‌کننده</td><td>${U.esc(payload.createdBy || '—')}</td></tr>
                  <tr><td>اعضا</td><td>${U.toFa(counts.members || 0)}</td></tr>
                  <tr><td>دوره‌ها</td><td>${U.toFa(counts.periods || 0)}</td></tr>
                  <tr><td>وام‌ها</td><td>${U.toFa(counts.loans || 0)}</td></tr>
                </tbody>
              </table>
            </div>`;
          restoreBtn.disabled = false;
        }
      } catch (err) {
        infoBox.innerHTML = '';
        restoreAlert.innerHTML = `<div class="form-alert danger">${U.esc(err.message)}</div>`;
      }
    };

    restoreBtn.onclick = async () => {
      restoreAlert.innerHTML = '';
      try {
        let backup = pendingBackup;

        if (pendingEncrypted) {
          const pw = pwInput.value;
          if (!pw) {
            restoreAlert.innerHTML = '<div class="form-alert danger">رمز عبور را وارد کنید</div>';
            return;
          }
          const { payload } = await BS.readBackupFile(fileInput.files[0]);
          backup = await BS.decryptBackup(payload, pw);
          BS.validateBackup(backup);
        }

        if (!backup) {
          restoreAlert.innerHTML = '<div class="form-alert danger">فایل بکاپ انتخاب نشده</div>';
          return;
        }

        const res = await BS.restoreBackup(backup);
        if (res.cancelled) return;

        App.UI.toast.success('داده‌ها با موفقیت بازیابی شد');

        /* بارگذاری مجدد state و بازگشت به داشبورد */
        await App.DataService.loadAll(state);
        setTimeout(() => {
          App.Boot.switchTab('dashboard');
        }, 800);
      } catch (err) {
        console.error(err);
        restoreAlert.innerHTML = `<div class="form-alert danger">${U.esc(err.message)}</div>`;
      }
    };

    /* بکاپ‌های محلی */
    root.querySelector('#btnRefreshSnapshots').onclick = () => App.Views.backup(root, state);

    root.querySelectorAll('.js-download').forEach(b => {
      b.onclick = async () => {
        const rec = await BS.getLocalSnapshot(b.dataset.id);
        if (!rec) return;
        const name = BS.downloadBackup(rec.payload);
        App.UI.toast.success(`دانلود شد: ${name}`);
      };
    });

    root.querySelectorAll('.js-restore').forEach(b => {
      b.onclick = async () => {
        const rec = await BS.getLocalSnapshot(b.dataset.id);
        if (!rec) return;
        try {
          const res = await BS.restoreLocalSnapshot(b.dataset.id);
          if (res.cancelled) return;
          App.UI.toast.success('داده‌ها بازیابی شد');
          await App.DataService.loadAll(state);
          setTimeout(() => App.Boot.switchTab('dashboard'), 800);
        } catch (e) {
          App.UI.toast.error(e.message);
        }
      };
    });

    root.querySelectorAll('.js-delete').forEach(b => {
      b.onclick = async () => {
        const ok = await App.UI.confirm.danger(
          'این بکاپ محلی برای همیشه حذف شود؟',
          { title: 'حذف بکاپ' }
        );
        if (!ok) return;
        await BS.deleteLocalSnapshot(b.dataset.id);
        App.UI.toast.success('حذف شد');
        App.Views.backup(root, state);
      };
    });
  })();
};