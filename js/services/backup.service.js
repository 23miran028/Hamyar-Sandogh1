/* =========================================================
   services/backup.service.js — پشتیبان‌گیری و بازیابی
   ========================================================= */
window.App = window.App || {};

App.BackupService = (function () {
  const Err = App.Err;
  const U   = App.Utils;
  const Bus = App.Bus;
  const DB  = App.DB;
  const Crypt = App.Crypto;

  const FORMAT_VERSION = 1;
  const APP_ID = 'qarz-fund';
  const MAX_LOCAL_BACKUPS = 10;
  const BACKUP_REMINDER_DAYS = 7;

  const DATA_STORES = ['meta','members','periods','snapshots','yearly','loans','settings'];
  const ALL_STORES  = [...DATA_STORES, 'users'];

  /* =========================================================
     ساخت بکاپ از DB
     ========================================================= */
    async function collectAll(includeUsers = false) {
    const stores = includeUsers ? ALL_STORES : DATA_STORES;
    const data = {};
    /* خطا در خواندن یک جدول نباید به‌صورت بی‌صدا به یک بکاپ ناقص (با جدول خالی) تبدیل شود */
    for (const store of stores) {
      try {
        data[store] = await DB.getAll(store);
      } catch (e) {
        throw Err.DB(`خطا در خواندن جدول «${store}» هنگام تهیه بکاپ`, e);
      }
    }
    return data;
  }

  async function createBackup(meta = {}) {
    const data = await collectAll(!!meta.includeUsers);
    const counts = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
    );

    const backup = {
      app: APP_ID,
      version: FORMAT_VERSION,
      createdAt: Date.now(),
      createdAtJalali: App.Jalali.format(new Date()),
      createdBy: App.AuthService.getCurrentUser()?.username || 'system',
      counts,
      meta,
      data
    };

    return backup;
  }

  /* =========================================================
     بازیابی از بکاپ
     ========================================================= */
  async function restoreBackup(backup, options = {}) {
    validateBackup(backup);

    if (backup.app !== APP_ID) {
      throw Err.Validation('این فایل بکاپ مربوط به این برنامه نیست');
    }

    const summary = {
      members:   backup.data.members?.length || 0,
      periods:   backup.data.periods?.length || 0,
      snapshots: backup.data.snapshots?.length || 0,
      loans:     backup.data.loans?.length || 0,
      users:     backup.data.users?.length || 0,
      createdAt: backup.createdAt,
      createdAtJalali: backup.createdAtJalali
    };

    if (!options.skipPrompt) {
      const ok = await App.UI.confirm.ask({
        title: '⚠️ بازیابی بکاپ',
        message: 'تمام داده‌های فعلی پاک و با این بکاپ جایگزین می‌شوند. آیا مطمئن هستید؟',
        details:
          `تاریخ بکاپ: ${backup.createdAtJalali || new Date(backup.createdAt).toLocaleString('fa-IR')}\n` +
          `اعضا: ${U.toFa(summary.members)} • دوره‌ها: ${U.toFa(summary.periods)}\n` +
          `رکوردهای ماهانه: ${U.toFa(summary.snapshots)} • وام‌ها: ${U.toFa(summary.loans)}`,
        confirmText: 'بله، بازیابی کن',
        kind: 'danger'
      });
      if (!ok) return { cancelled: true };
    }

    /* پاک‌کردن جدول‌های داده + نوشتن بکاپ در «یک تراکنش واحد»:
       اگر هر مرحله خطا بدهد، کل عملیات لغو می‌شود و داده‌ی فعلی دست‌نخورده می‌ماند.
       کاربران/لاگ/بکاپ‌های محلی حفظ می‌شوند. */
    const now = Date.now();
    const ops = DB.DATA_STORES.map(store => ({ type: 'clear', store }));

    /* نوشتن داده‌های جدید — به‌جز users (جلوگیری از تصاحب حساب) */
    for (const store of ALL_STORES) {
      if (store === 'users' && !options.includeUsers) continue;
      const items = backup.data[store];
      if (Array.isArray(items)) {
        items.forEach(data => ops.push({ type: 'put', store, data }));
      }
    }

    /* به‌روزرسانی meta */
    const metaPut = (key, value) => ({ type: 'put', store: 'meta', data: { key, value, updatedAt: now } });
    ops.push(
      metaPut('schemaVersion', App.DataService.SCHEMA_VERSION),
      metaPut('importedAt', now),
      metaPut('restoredFrom', {
        createdAt: backup.createdAt,
        createdBy: backup.createdBy,
        restoredAt: now
      }),
      metaPut('usersRestoredFromBackup', !!options.includeUsers)
    );

    await DB.batch(ops);

    /* Audit Log */
    try {
      await App.DataService.logAudit({
        action: 'backup:restore',
        entity: 'system',
        meta: { createdAt: backup.createdAt, counts: summary }
      });
    } catch (e) {}

    Bus.emit('backup:restored', summary);
    return { ok: true, summary };
  }

  function validateBackup(backup) {
    if (!backup || typeof backup !== 'object')
      throw Err.Validation('فایل بکاپ نامعتبر است');
    if (!backup.data || typeof backup.data !== 'object')
      throw Err.Validation('ساختار فایل بکاپ ناقص است');
    if (!Array.isArray(backup.data.members))
      throw Err.Validation('داده‌ی اعضا در بکاپ وجود ندارد');
    /* بکاپ ناقص نباید جایگزین داده‌ی کامل شود: جدول‌های اصلی باید وجود داشته باشند */
    for (const store of ['periods', 'snapshots']) {
      if (!Array.isArray(backup.data[store]))
        throw Err.Validation(`داده‌ی «${store}» در بکاپ وجود ندارد یا نامعتبر است`);
    }
    for (const store of ALL_STORES) {
      const items = backup.data[store];
      if (items !== undefined && !Array.isArray(items))
        throw Err.Validation(`ساختار «${store}» در بکاپ نامعتبر است`);
    }
  }

  /* =========================================================
     رمزنگاری بکاپ (AES-GCM + PBKDF2)
     ========================================================= */
  async function encryptBackup(backup, password) {
    if (!password || password.length < 6) {
      throw Err.Validation('رمز باید حداقل ۶ کاراکتر باشد');
    }

    const plaintext = JSON.stringify(backup);
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));

    /* کلید از رمز */
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    /* رمزنگاری */
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext)
    );

    return {
      app: APP_ID,
      version: FORMAT_VERSION,
      encrypted: true,
      algorithm: 'AES-GCM-256',
      kdf: 'PBKDF2-SHA256',
      iterations: 120000,
      salt: Crypt.bytesToB64(salt),
      iv:   Crypt.bytesToB64(iv),
      data: Crypt.bytesToB64(new Uint8Array(ciphertext)),
      createdAt: Date.now(),
      createdAtJalali: App.Jalali.format(new Date()),
      createdBy: App.AuthService.getCurrentUser()?.username || 'system',
      counts: backup.counts
    };
  }

  async function decryptBackup(encrypted, password) {
    if (!encrypted || !encrypted.encrypted) {
      throw Err.Validation('این فایل رمزنگاری نشده است');
    }
    if (!password) throw Err.Validation('رمز عبور الزامی است');

    const enc = new TextEncoder();
    const salt = Crypt.b64ToBytes(encrypted.salt);
    const iv   = Crypt.b64ToBytes(encrypted.iv);
    const cipherBytes = Crypt.b64ToBytes(encrypted.data);

    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: encrypted.iterations || 120000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    try {
      const plainBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipherBytes
      );
      const json = new TextDecoder().decode(plainBuffer);
      return JSON.parse(json);
    } catch (e) {
      throw Err.Validation('رمز عبور نادرست است یا فایل آسیب دیده');
    }
  }

  /* =========================================================
     دانلود / آپلود
     ========================================================= */
  function downloadBackup(backup, filename) {
    const name = filename || buildFilename(backup);
    const isEncrypted = !!backup.encrypted;
    const text = JSON.stringify(backup, null, isEncrypted ? 0 : 2);
    const blob = new Blob([text], { type: 'application/json' });
    U.download(blob, name);
    return name;
  }

  function buildFilename(backup) {
    const date = new Date(backup.createdAt || Date.now());
    const j = App.Jalali.toJalali(date);
    const d = String(j.jy) + '-' +
              String(j.jm).padStart(2, '0') + '-' +
              String(j.jd).padStart(2, '0');
    const t = String(date.getHours()).padStart(2, '0') + '-' +
              String(date.getMinutes()).padStart(2, '0');
    const suffix = backup.encrypted ? 'encrypted' : 'plain';
    return `qarz-fund-backup-${d}_${t}-${suffix}.json`;
  }

  async function readBackupFile(file) {
    const text = await file.text();
    let json;
    try { json = JSON.parse(text); }
    catch (e) { throw Err.Validation('فایل JSON معتبر نیست'); }

    if (json?.encrypted) return { encrypted: true, payload: json };
    validateBackup(json);
    return { encrypted: false, payload: json };
  }

  /* =========================================================
     بکاپ‌های محلی
     ========================================================= */
  async function saveLocalSnapshot(backup) {
    const id = 'bk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const record = {
      id,
      createdAt: backup.createdAt || Date.now(),
      createdAtJalali: backup.createdAtJalali || App.Jalali.format(new Date()),
      counts: backup.counts || {},
      createdBy: backup.createdBy || 'system',
      encrypted: !!backup.encrypted,
      payload: backup
    };

    await DB.put('backups', record);

    /* حذف نسخه‌های قدیمی */
    const all = await DB.getAll('backups');
    all.sort((a, b) => b.createdAt - a.createdAt);
    if (all.length > MAX_LOCAL_BACKUPS) {
      for (const old of all.slice(MAX_LOCAL_BACKUPS)) {
        await DB.del('backups', old.id);
      }
    }

    Bus.emit('backup:local-created', { id });
    return record;
  }

  async function listLocalSnapshots() {
    const all = await DB.getAll('backups');
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }

  async function getLocalSnapshot(id) {
    return DB.get('backups', id);
  }

  async function deleteLocalSnapshot(id) {
    return DB.del('backups', id);
  }

  async function restoreLocalSnapshot(id) {
    const rec = await getLocalSnapshot(id);
    if (!rec) throw Err.NotFound('بکاپ محلی یافت نشد');
    return restoreBackup(rec.payload);
  }

  /* =========================================================
     وضعیت بکاپ
     ========================================================= */
  async function getBackupStatus() {
    const [localSnapshots, lastBackupMeta] = await Promise.all([
      listLocalSnapshots(),
      DB.get('meta', 'lastBackupAt').then(r => r?.value || null)
    ]);

    const lastBackupAt = lastBackupMeta || (localSnapshots[0]?.createdAt || null);
    const daysSince = lastBackupAt
      ? Math.floor((Date.now() - lastBackupAt) / (24 * 60 * 60 * 1000))
      : null;

    return {
      lastBackupAt,
      lastBackupJalali: lastBackupAt ? App.Jalali.format(new Date(lastBackupAt)) : null,
      daysSince,
      needsReminder: daysSince == null || daysSince >= BACKUP_REMINDER_DAYS,
      localCount: localSnapshots.length,
      maxLocal: MAX_LOCAL_BACKUPS,
      reminderDays: BACKUP_REMINDER_DAYS
    };
  }

  async function markBackupDone() {
    await DB.put('meta', { key: 'lastBackupAt', value: Date.now(), updatedAt: Date.now() });
  }

  /* =========================================================
     ساخت + دانلود + ذخیره محلی
     ========================================================= */
  async function createAndDownload(options = {}) {
    const backup = await createBackup({
      note: options.note || '',
      includeUsers: !!options.password    // کاربران فقط در بکاپ رمزنگاری‌شده
    });

    let payload = backup;
    if (options.password) {
      payload = await encryptBackup(backup, options.password);
    }

    const filename = downloadBackup(payload, options.filename);

    /* ذخیره‌ی نسخه‌ی محلی — همیشه رمزنگاری‌شده نیست، همیشه به‌صورت plain برای بازیابی سریع */
    try {
      await saveLocalSnapshot(backup);
    } catch (e) {
      console.warn('[backup] ذخیره محلی ناموفق:', e);
    }

    await markBackupDone();

    try {
      await App.DataService.logAudit({
        action: 'backup:create',
        entity: 'system',
        meta: { filename, encrypted: !!options.password, counts: backup.counts }
      });
    } catch (e) {}

    Bus.emit('backup:created', { filename, encrypted: !!options.password });
    return { filename, backup: payload };
  }

  /* =========================================================
     File System Access API (ذخیره در پوشه دلخواه)
     ========================================================= */
  async function saveToFolder(backup) {
    if (!('showSaveFilePicker' in window)) {
      throw Err.Validation('این مرورگر از انتخاب پوشه پشتیبانی نمی‌کند (از Chrome/Edge نسخه ۸۶+ استفاده کنید)');
    }

    const filename = buildFilename(backup);
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'فایل بکاپ', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(backup, null, 2));
      await writable.close();
      return handle.name;
    } catch (e) {
      if (e.name === 'AbortError') return null;
      throw e;
    }
  }

  return {
    /* ساخت */
    createBackup, createAndDownload,
    /* بازیابی */
    restoreBackup, restoreLocalSnapshot,
    validateBackup, readBackupFile,
    /* رمزنگاری */
    encryptBackup, decryptBackup,
    /* دانلود */
    downloadBackup, buildFilename,
    /* محلی */
    saveLocalSnapshot, listLocalSnapshots, getLocalSnapshot,
    deleteLocalSnapshot,
    /* وضعیت */
    getBackupStatus, markBackupDone,
    /* فایل سیستم */
    saveToFolder,
    /* ثوابت */
    MAX_LOCAL_BACKUPS, BACKUP_REMINDER_DAYS, FORMAT_VERSION
  };
})();