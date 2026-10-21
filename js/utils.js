/* =========================================================
   utils.js — توابع عمومی و کمکی
   ========================================================= */
window.App = window.App || {};

App.Utils = (function () {
  const FA_D = '۰۱۲۳۴۵۶۷۸۹';
  const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
                  'مهر','آبان','آذر','دی','بهمن','اسفند'];
  const NF = new Intl.NumberFormat('fa-IR');

  const toFa  = s => String(s).replace(/[0-9]/g, d => FA_D[+d]);
  const num   = v => { const n = Number(v); return isFinite(n) ? n : 0; };

/* =========================================================
تبدیل نمایش: DB در ریال — نمایش در تومان
========================================================= */
const RIAL_PER_TOMAN = 10;
const toToman = (rial) => Math.round(Number(rial) / RIAL_PER_TOMAN);

function fmt(n) {
  if (n === null || n === undefined || n === '' || n === '-') return '—';
  const v = Number(n);
  if (!isFinite(v)) return '—';
  return NF.format(toToman(v));      // ← تقسیم بر ۱۰
}

function shortMoney(n) {
  const t = Math.abs(Number(n) / RIAL_PER_TOMAN);
  if (t >= 1e9) return toFa((t / 1e9).toFixed(1)) + ' میلیارد';
  if (t >= 1e6) return toFa(Math.round(t / 1e6)) + ' میلیون';
  if (t >= 1e3) return toFa(Math.round(t / 1e3)) + ' هزار';
  return toFa(Math.round(t));
}

  function norm(s) {
    return String(s ?? '')
      .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
      .replace(/\u200c/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function monthInfo(key) {
    const n = norm(key);
    const parts = n.split(' ');
    const year = Number(parts.find(p => /^\d+$/.test(p))) || 0;
    const name = parts.find(p => MONTHS.includes(p)) || parts[0] || n;
    const idx  = MONTHS.indexOf(name);
    return { name, year, idx: idx < 0 ? 99 : idx };
  }

  const monthLabel = m => m.name + ' ' + toFa(m.year);

    /* ترتیب عددی کلید دوره — برای مقایسه‌ی درست (D-03) */
  function periodOrder(key) {
    const m = monthInfo(key);
    return (m.year * 12) + (m.idx < 0 ? 0 : m.idx);
  }

  /* مقایسه‌ی دو کلید دوره: منفی = a قبل از b */
  function comparePeriodKeys(a, b) {
    return periodOrder(a) - periodOrder(b);
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  function exportCSV(filename, headers, rows) {
    const esc2 = v => {
      const s = (v === null || v === undefined) ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [headers.map(esc2).join(',')]
      .concat(rows.map(r => r.map(esc2).join(',')))
      .join('\r\n');
    download(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), filename);
  }

/* ---------- شمارنده متحرک ---------- */
function animateValue(el, from, to, duration = 900, formatter = null) {
  if (!el) return;
  const start = performance.now();
  const fmt = formatter || ((v) => Math.round(v));
  const diff = to - from;

  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    const current = from + diff * eased;
    el.textContent = fmt(current);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = fmt(to);
  }
  requestAnimationFrame(tick);
}

  return {
  FA_D, MONTHS, NF,
  toFa, num, fmt, shortMoney, norm, esc,
  monthInfo, monthLabel,
  periodOrder, comparePeriodKeys,
  download, exportCSV,
  RIAL_PER_TOMAN, toToman,
  animateValue  // ← اضافه
};
})();