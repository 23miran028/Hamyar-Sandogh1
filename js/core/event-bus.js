/* =========================================================
   core/event-bus.js — Pub/Sub ساده
   ========================================================= */
window.App = window.App || {};

App.Bus = (function () {
  const handlers = new Map();

  function on(evt, fn) {
    if (!handlers.has(evt)) handlers.set(evt, new Set());
    handlers.get(evt).add(fn);
    return () => off(evt, fn);
  }
  function off(evt, fn) {
    const set = handlers.get(evt);
    if (set) set.delete(fn);
  }
  function once(evt, fn) {
    const wrap = (...a) => { off(evt, wrap); fn(...a); };
    return on(evt, wrap);
  }
  function emit(evt, data) {
    const set = handlers.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(data); }
      catch (e) { console.error(`[Bus] خطا در handler رویداد "${evt}":`, e); }
    }
  }
  function clear(evt) {
    if (evt) handlers.delete(evt);
    else handlers.clear();
  }

  /* رویدادهای استاندارد */
  const EVENTS = {
    DATA_IMPORTED:  'data:imported',
    DATA_CLEARED:   'data:cleared',
    DATA_LOADED:    'data:loaded',
    MEMBER_UPDATED: 'member:updated',
    MEMBER_DELETED: 'member:deleted',
    LOAN_UPDATED:   'loan:updated',
    PERIOD_UPDATED: 'period:updated',
    STATE_CHANGED:  'state:changed'
  };

  return { on, off, once, emit, clear, EVENTS };
})();