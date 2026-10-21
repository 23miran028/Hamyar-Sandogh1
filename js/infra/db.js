/* =========================================================
   infra/db.js — پوشش IndexedDB (اصلاح Race Condition)
   ========================================================= */
window.App = window.App || {};

App.DB = (function () {
  const Err = App.Err;

  const DB_NAME = 'qarz_fund';
  const DB_VERSION = 3;
  
  const DATA_STORES = ['members', 'periods', 'snapshots', 'yearly', 'loans'];

  const STORES = {
    meta:      { keyPath: 'key' },
    members:   { keyPath: 'code',      indexes: [['name','name'], ['status','status']] },
    periods:   { keyPath: 'key',       indexes: [['year','year'], ['order',['year','idx']]] },
    snapshots: { keyPath: ['periodKey','memberCode'], indexes: [['periodKey','periodKey'], ['memberCode','memberCode']] },
    yearly:    { keyPath: 'year' },
    loans:     { keyPath: 'id', indexes: [['memberCode','memberCode'], ['status','status'], ['startPeriodKey','startPeriodKey']] },
    users:     { keyPath: 'username',  indexes: [['role','role']] },
    backups:   { keyPath: 'id',        indexes: [['createdAt','createdAt']] },
    settings:  { keyPath: 'key' },
    audit_log: { keyPath: 'id', autoIncrement: true, indexes: [['timestamp','timestamp'], ['action','action']] }
  };

  let _db = null;
  let _openPromise = null; // ← جلوگیری از باز شدن همزمان

  function open() {
    if (_db) return Promise.resolve(_db);
    if (_openPromise) return _openPromise;

    _openPromise = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { _openPromise = null; return reject(Err.DB('مرورگر از IndexedDB پشتیبانی نمی‌کند', e)); }

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const tx = e.target.transaction;

        for (const [name, def] of Object.entries(STORES)) {
          let store;
          if (!db.objectStoreNames.contains(name)) {
            store = db.createObjectStore(name, { keyPath: def.keyPath, autoIncrement: !!def.autoIncrement });
          } else {
            store = tx.objectStore(name);
          }
          (def.indexes || []).forEach(([iname, ipath, opts]) => {
            if (!store.indexNames.contains(iname)) {
              store.createIndex(iname, ipath, opts || { unique: false });
            }
          });
        }
      };
      
      req.onsuccess = () => {
        _db = req.result;
        _db.onversionchange = () => { _db.close(); _db = null; _openPromise = null; };
        _openPromise = null;
        resolve(_db);
      };
      req.onerror   = () => { _openPromise = null; reject(Err.DB('خطا در باز کردن پایگاه داده', req.error)); };
      req.onblocked = () => { _openPromise = null; reject(Err.DB('پایگاه داده در تب دیگری قفل است')); };
    });
    return _openPromise;
  }

  async function tx(storeNames, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      let t;
      try { t = db.transaction(storeNames, mode); }
      catch (e) { return reject(Err.DB('خطا در ایجاد تراکنش', e)); }

      let result;
      t.oncomplete = () => resolve(result);
      t.onerror    = () => reject(Err.DB('خطای تراکنش', t.error));
      t.onabort    = () => reject(Err.DB('تراکنش لغو شد', t.error));

      try {
        const stores = Array.isArray(storeNames)
          ? storeNames.reduce((a, n) => (a[n] = t.objectStore(n), a), {})
          : { [storeNames]: t.objectStore(storeNames) };
        result = fn(stores, t);
      } catch (e) {
        try { t.abort(); } catch (_) {}
        reject(Err.wrap(e, 'DB_TX'));
      }
    });
  }

  function req(r) {
    return new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result);
      r.onerror   = () => reject(Err.DB('خطای درخواست', r.error));
    });
  }

  async function get(store, key) { const db = await open(); return req(db.transaction(store, 'readonly').objectStore(store).get(key)); }
  async function getAll(store) { const db = await open(); return req(db.transaction(store, 'readonly').objectStore(store).getAll()); }
  
  async function put(store, obj) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      const req = t.objectStore(store).put(obj);
      req.onsuccess = () => { if(STORES[store]?.autoIncrement) obj[STORES[store].keyPath] = req.result; };
      t.oncomplete = () => resolve(obj);
      t.onerror    = () => reject(Err.DB('خطا در ذخیره', t.error));
      t.onabort    = () => reject(Err.DB('ذخیره لغو شد', t.error));
    });
  }

  async function putMany(store, arr) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      t.oncomplete = () => resolve(arr.length);
      t.onerror    = () => reject(Err.DB('خطا در ذخیره گروهی', t.error));
      t.onabort    = () => reject(Err.DB('ذخیره گروهی لغو شد', t.error));
      try { const s = t.objectStore(store); arr.forEach(o => s.put(o)); } 
      catch (e) { try { t.abort(); } catch (_) {} reject(e); }
    });
  }

  async function del(store, key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      t.oncomplete = () => resolve(true);
      t.onerror    = () => reject(Err.DB('خطا در حذف', t.error));
      t.onabort    = () => reject(Err.DB('حذف لغو شد', t.error));
      try { t.objectStore(store).delete(key); } catch (e) { try { t.abort(); } catch (_) {} reject(e); }
    });
  }

  async function clear(store) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      t.oncomplete = () => resolve(true);
      t.onerror    = () => reject(Err.DB('خطا در پاک‌سازی', t.error));
      t.onabort    = () => reject(Err.DB('پاک‌سازی لغو شد', t.error));
      try { t.objectStore(store).clear(); } catch (e) { try { t.abort(); } catch (_) {} reject(e); }
    });
  }

  async function count(store) { const db = await open(); return req(db.transaction(store, 'readonly').objectStore(store).count()); }
  async function byIndex(store, indexName, value) { const db = await open(); return req(db.transaction(store, 'readonly').objectStore(store).index(indexName).getAll(value)); }

  async function batch(operations) {
    if (!Array.isArray(operations) || !operations.length) return true;
    const stores = [...new Set(operations.map(o => o.store))];
    const db = await open();
    return new Promise((resolve, reject) => {
      let t;
      try { t = db.transaction(stores, 'readwrite'); } catch (e) { return reject(Err.DB('خطا در ایجاد تراکنش batch', e)); }
      t.oncomplete = () => resolve(true);
      t.onerror    = () => reject(Err.DB('خطای batch', t.error));
      t.onabort    = () => reject(Err.DB('batch لغو شد', t.error));
      try {
        for (const op of operations) {
          const store = t.objectStore(op.store);
          if (op.type === 'put') store.put(op.data);
          else if (op.type === 'del') store.delete(op.key);
          else if (op.type === 'clear') store.clear();
        }
      } catch (e) { try { t.abort(); } catch (_) {} reject(e); }
    });
  }

  async function clearData() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(DATA_STORES, 'readwrite');
      t.oncomplete = () => resolve(true);
      t.onerror    = () => reject(Err.DB('خطا در پاک‌سازی داده', t.error));
      t.onabort    = () => reject(Err.DB('پاک‌سازی داده لغو شد', t.error));
      DATA_STORES.forEach(n => t.objectStore(n).clear());
    });
  }

  async function clearAll() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(Object.keys(STORES), 'readwrite');
      t.oncomplete = () => resolve(true);
      t.onerror    = () => reject(Err.DB('خطا در پاک‌سازی', t.error));
      t.onabort    = () => reject(Err.DB('پاک‌سازی لغو شد', t.error));
      Object.keys(STORES).forEach(n => t.objectStore(n).clear());
    });
  }

  return {
    open, tx, req, get, getAll, put, putMany, del, clear, count, byIndex,
    clearAll, clearData, batch, STORES, DATA_STORES, DB_NAME, DB_VERSION,
    close() { if (_db) { _db.close(); _db = null; _openPromise = null; } },
    async info() {
      const db = await open();
      return { name: db.name, version: db.version, stores: Array.from(db.objectStoreNames) };
    }
  };
})();