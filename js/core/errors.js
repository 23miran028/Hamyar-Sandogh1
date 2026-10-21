/* =========================================================
   core/errors.js — انواع خطای برنامه
   ========================================================= */
window.App = window.App || {};

App.Err = (function () {
  class AppError extends Error {
    constructor(code, message, details) {
      super(message || code);
      this.name = 'AppError';
      this.code = code;
      this.details = details || null;
    }
    toString() { return `[${this.code}] ${this.message}`; }
  }

  const make = (code, defaultMsg) => (msg, details) =>
    new AppError(code, msg || defaultMsg, details);

  return {
    AppError,
    NotFound:   make('NOT_FOUND',    'مورد یافت نشد'),
    Validation: make('VALIDATION',   'خطای اعتبارسنجی'),
    Conflict:   make('CONFLICT',     'تعارض داده'),
    Permission: make('PERMISSION',   'عدم دسترسی'),
    DB:         make('DB_ERROR',     'خطای پایگاه داده'),
    Import:     make('IMPORT_ERROR', 'خطای ورود داده'),
    wrap(e, code) {
      if (e instanceof AppError) return e;
      return new AppError(code || 'UNKNOWN', e?.message || 'خطای ناشناخته', e);
    }
  };
})();