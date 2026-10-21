/* =========================================================
   parser.js — تجزیه فایل خام ورودی (فاز ۱ — نسخه نهایی)
   =========================================================
   وظیفه: تبدیل JSON خام به ساختار میانی { months, years }
   هیچ منطق دامنه‌ای (member/loan building) اینجا نیست؛
   آن کار در services/data.service.js انجام می‌شود.
   ========================================================= */
window.App = window.App || {};

App.Parser = (function () {
  const U = App.Utils;

  /* ---------- نقطه ورود ---------- */
  function parseWorkbook(raw) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('فایل ورودی نامعتبر است (JSON نیست)');
    }
    const keys = Object.keys(raw || {});
    const mhKey  = keys.find(k => /MH/i.test(k))  || keys[0];
    const kolKey = keys.find(k => /KOL/i.test(k)) || keys[1];
    const MH  = raw[mhKey];
    const KOL = raw[kolKey] || {};

    if (!MH || typeof MH !== 'object') {
      throw new Error('شیت ماهانه (MH) در فایل پیدا نشد');
    }

    const months = parseMonthly(MH);
    const years  = parseYearly(KOL);

    return { months, years, mhKey, kolKey };
  }

  /* ---------- D-11: نگاشت ستون‌ها ---------- */
  function buildMonthlyColMap(headers) {
    if (!Array.isArray(headers) || !headers.length) return null;
    const norm = headers.map(h => U.norm(h || ''));
    const find = (...candidates) => {
      for (let i = 0; i < norm.length; i++) {
        for (const c of candidates) {
          if (norm[i].includes(c)) return i;
        }
      }
      return -1;
    };
    const map = {
      remaining:   find('باقیمانده'),
      capInst:     find('سرمایه و قسط', 'سرمایه+قسط'),
      paidCount:   find('تعداد قسط'),
      installment: find('قسط ماهانه'),
      loan:        find('وام دریافتی', 'وام'),
      deposit:     find('واریز'),
      totalCap:    find('سرمایه کل'),
      name:        find('نام'),
      code:        find('کد'),
      rowNo:       find('ردیف')
    };
    /* اگر حداقل code یا name پیدا نشد، نقشه معتبر نیست */
    if (map.code < 0 && map.name < 0) return null;
    return map;
  }

  const FIXED_MAP = {
    remaining: 0, capInst: 1, paidCount: 2, installment: 3,
    loan: 4, deposit: 5, totalCap: 6, name: 7, code: 8, rowNo: 9
  };

  function parseMonthly(MH) {
    const months = [];

    for (const [k, sheet] of Object.entries(MH)) {
      if (!sheet || !Array.isArray(sheet.rows)) continue;

      const mi = U.monthInfo(k);

      /* D-11: اول با هدر، بعد با اندیس ثابت */
      let colMap = buildMonthlyColMap(sheet.headers);
      let usedFallback = false;
      if (!colMap) { colMap = FIXED_MAP; usedFallback = true; }

      /* اعتبارسنجی: ردیف‌ها باید حداقل به اندازه‌ی بزرگ‌ترین اندیس باشند */
      const maxIdx = Math.max(...Object.values(colMap).filter(i => i >= 0));
      const badRow = sheet.rows.find(r => Array.isArray(r) && r.length > 0 && r.length <= maxIdx);
      if (badRow && usedFallback) {
        console.warn(`[parser] ساختار ستون‌های «${k}» مشکوک است (تعداد ستون کم). از هدر استفاده کنید.`);
      }

      const readCol = (row, key) => {
        const i = colMap[key];
        return (i >= 0 && row[i] !== undefined) ? row[i] : null;
      };

      const all = sheet.rows
        .filter(r => Array.isArray(r))
        .map(r => ({
          remaining  : U.num(readCol(r, 'remaining')),
          capInst    : U.num(readCol(r, 'capInst')),
          paidCount  : (readCol(r, 'paidCount') === null || readCol(r, 'paidCount') === undefined || readCol(r, 'paidCount') === '')
                       ? null : U.num(readCol(r, 'paidCount')),
          installment: U.num(readCol(r, 'installment')),
          loan       : U.num(readCol(r, 'loan')),
          deposit    : U.num(readCol(r, 'deposit')),
          totalCap   : U.num(readCol(r, 'totalCap')),
          name       : readCol(r, 'name') ? U.norm(readCol(r, 'name')) : null,
          code       : readCol(r, 'code') ? String(readCol(r, 'code')).trim() : null,
          rowNo      : readCol(r, 'rowNo')
        }));

      const data = all.filter(r => r.code);

      /* ردیف جمع (بدون کد) */
      let totals = all.find(r => !r.code);
      if (!totals) {
        totals = {
          remaining  : data.reduce((s, r) => s + r.remaining, 0),
          capInst    : data.reduce((s, r) => s + r.capInst, 0),
          installment: data.reduce((s, r) => s + r.installment, 0),
          deposit    : data.reduce((s, r) => s + r.deposit, 0),
          totalCap   : data.reduce((s, r) => s + (r.totalCap || 0), 0)
        };
      }

      months.push({ key: k, ...mi, data, totals, usedFallback });
    }

    /* D-11: اگر هیچ ماهی پیدا نشد، خطای واضح */
    if (!months.length) {
      throw new Error('هیچ ماه معتبری در شیت MH پیدا نشد. ساختار فایل ورودی را بررسی کنید.');
    }

    months.sort((a, b) => (a.year - b.year) || (a.idx - b.idx));
    return months;
  }

  /* ---------- شیت سالانه ---------- */
  function parseYearly(KOL) {
    const years = [];

    for (const [k, sheet] of Object.entries(KOL)) {
      if (!sheet || !Array.isArray(sheet.rows)) continue;

      const H = sheet.headers || [];
      const memberCols = H.slice(14).map(U.norm);

      const rows = sheet.rows.map(r => {
        const members = memberCols.map((c, i) => ({
          name: c, value: U.num(r[14 + i])
        }));

        return {
          balance              : U.num(r[0]),
          available            : U.num(r[1]),
          instAmt              : U.num(r[2]),
          loanAmt              : U.num(r[3]),
          loansPaid            : U.num(r[4]),
          capitalPerMember     : U.num(r[5]),
          borrowerCount        : (r[6] == null) ? null : U.num(r[6]),
          name                 : r[7] ? U.norm(r[7]) : null,
          month                : U.norm(r[8] || ''),
          totalReceived        : U.num(r[9]),
          capitalReceived      : U.num(r[10]),
          installmentsReceived : U.num(r[11]),
          share                : U.num(r[12]),
          memberCount          : U.num(r[13]),
          members
        };
      });

      years.push({ year: String(k), rows, memberCols });
    }

    years.sort((a, b) => Number(a.year) - Number(b.year));
    return years;
  }

  /* ---------- API عمومی ---------- */
  return { parseWorkbook };
})();