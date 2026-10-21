/* =========================================================
   domain/validators.js — اعتبارسنجی
   ========================================================= */
window.App = window.App || {};

App.Validators = (function () {
  const Err = App.Err;
  const U = App.Utils;

  const checks = {
    required: (v) => (v !== null && v !== undefined && String(v).trim() !== '') || 'الزامی است',
    minLen: (v, n) => (String(v).length >= n) || `حداقل ${n} کاراکتر`,
    maxLen: (v, n) => (String(v).length <= n) || `حداکثر ${n} کاراکتر`,
    pattern: (v, re, msg) => re.test(String(v)) || (msg || 'قالب نامعتبر'),
    number:  (v) => !isNaN(Number(v)) || 'باید عدد باشد',
    positive:(v) => Number(v) >= 0 || 'نباید منفی باشد',
    integer: (v) => Number.isInteger(Number(v)) || 'باید عدد صحیح باشد',
    oneOf:   (v, list) => list.includes(v) || 'مقدار نامعتبر',
    code:    (v) => /^[A-Za-z0-9_.-]{2,20}$/.test(String(v)) || 'فقط حرف/عدد/._-'
  };

  /* اجرای زنجیره‌ای: value → [(fn, args)] */
  function validate(value, rules) {
    for (const r of rules) {
      if (typeof r === 'function') {
        const res = r(value);
        if (res !== true) return res || 'نامعتبر';
      } else if (Array.isArray(r)) {
        const [fn, ...args] = r;
        const res = checks[fn] ? checks[fn](value, ...args) : true;
        if (res !== true) return res;
      }
    }
    return true;
  }

  /* ---------- اعتبارسنجی عضو ---------- */
  function member(m, existingCodes) {
    const errors = {};
    const put = (f, msg) => { if (msg !== true) errors[f] = msg; };

    put('code', validate(m.code, [
      'required', 'code',
      (v) => !existingCodes || !existingCodes.has(v) || 'این کد قبلاً استفاده شده'
    ]));
    put('name', validate(m.name, ['required', ['minLen', 3], ['maxLen', 60]]));
    if (m.phone) put('phone', validate(m.phone, [
      (v) => /^[0-9+\-\s]{6,20}$/.test(v) || 'شماره نامعتبر'
    ]));

    return { ok: Object.keys(errors).length === 0, errors };
  }

  /* ---------- اعتبارسنجی معامله دوره ---------- */
  function txn(t) {
    const errors = {};
    const put = (f, msg) => { if (msg !== true) errors[f] = msg; };

    put('memberCode', validate(t.memberCode, ['required']));
    put('periodKey',  validate(t.periodKey,  ['required']));
    put('deposit',    validate(t.deposit,    ['required', 'number', 'positive', 'integer']));
    put('installment',validate(t.installment,['required', 'number', 'positive']));
    put('paidCount',  validate(t.paidCount,  [
  'number', 'positive',
  (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 'عدد نامعتبر';
    if (n < 0) return 'نباید منفی باشد';
    if (n > 20) return 'حداکثر ۲۰';
    return true;
  }
]));
    put('loan',       validate(t.loan,       ['number', 'positive']));
    put('remaining',  validate(t.remaining,  ['number', 'positive']));

    return { ok: Object.keys(errors).length === 0, errors };
  }

  return { checks, validate, member, txn };
})();