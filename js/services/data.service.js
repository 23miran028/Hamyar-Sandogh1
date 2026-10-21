/* =========================================================
   services/data.service.js — لایه سرویس داده (فاز ۱)
   ========================================================= */
window.App = window.App || {};

App.DataService = (function () {
  /* ---------- وابستگی‌ها ---------- */
  const Err   = App.Err;
  const M     = App.Models;
  const Bus   = App.Bus;
  const DB    = App.DB;         // ← اصلاح‌شده
  const Parser = App.Parser;    // ← اصلاح‌شده (به جای App.Parser.parseWorkbook)

  const Repos = {
    meta:      App.Repo.create('meta'),
    members:   App.Repo.create('members'),
    periods:   App.Repo.create('periods'),
    snapshots: App.Repo.create('snapshots'),
    yearly:    App.Repo.create('yearly'),
    loans:     App.Repo.create('loans'),
    settings:  App.Repo.create('settings'),
    audit:     App.Repo.create('audit_log')
  };

  const SCHEMA_VERSION = 3;   /* Q-03: هماهنگ با DB_VERSION */

  /* ---------- متادیتا ---------- */
  async function setMeta(key, value) {
    return Repos.meta.put({ key, value, updatedAt: Date.now() });
  }
  async function getMeta(key) {
    const rec = await Repos.meta.get(key);
    return rec ? rec.value : null;
  }

  /* ---------- بررسی خالی بودن ---------- */
  async function isEmpty() {
    return (await Repos.members.count()) === 0;
  }

  /* ---------- ورود داده خام ---------- */
  async function importRaw(raw, opts = {}) {
    if (!raw || typeof raw !== 'object')
      throw Err.Import('فایل ورودی نامعتبر است');

    const parsed = Parser.parseWorkbook(raw);   // ← اصلاح‌شده
    if (!parsed.months.length)
      throw Err.Import('هیچ داده ماهانه‌ای در فایل یافت نشد');

    /* اعضا */
    const members = extractMembers(parsed.months);

    /* دوره‌ها */
    const periods = parsed.months.map(m => {
  /* نرخ واریز ثابت این دوره = مقدار deposit یک ردیف نمونه */
  const sampleRow = m.data.find(r => r.code);
  const depositRate = sampleRow ? sampleRow.deposit : 200000;
  return M.Period.create({
    key: m.key, name: m.name, year: m.year, idx: m.idx,
    depositRate,                     // ← جدید
    totals: m.totals
  });
});

    /* اسنپ‌شات‌ها */
    const snapshots = [];
    parsed.months.forEach(m => m.data.forEach(r => {
      snapshots.push(M.Snapshot.create({
      periodKey: m.key,
      memberCode: r.code,
      name: r.name || '',                  // ← این خط را اضافه کن
      remaining: r.remaining,
      capInst: r.capInst,
      paidCount: r.paidCount,
      installment: r.installment,
      loan: r.loan,
      deposit: r.deposit,
      totalCap: r.totalCap,
      rowNo: r.rowNo
      }));
    }));

    /* داده سالانه */
    const yearly = parsed.years.map(y => M.Yearly.create({
      year: y.year, memberCols: y.memberCols, rows: y.rows
    }));

    /* وام‌ها */
    const loans = extractLoans(snapshots, periods);
    /* همه‌ی محاسبات بالا پیش از هر نوشتن انجام شده‌اند؛ پاک‌سازی و نوشتن در یک
       تراکنش واحد انجام می‌شود تا در صورت خطا، داده‌ی قبلی دست‌نخورده بماند.
       فقط جدول‌های داده پاک می‌شوند — کاربران/لاگ/بکاپ حفظ می‌شوند. */
    const now = Date.now();
    const metaPut = (key, value) => ({ type: 'put', store: 'meta', data: { key, value, updatedAt: now } });
    const ops = [
      ...DB.DATA_STORES.map(store => ({ type: 'clear', store })),
      ...members.map(data   => ({ type: 'put', store: 'members',   data })),
      ...periods.map(data   => ({ type: 'put', store: 'periods',   data })),
      ...snapshots.map(data => ({ type: 'put', store: 'snapshots', data })),
      ...yearly.map(data    => ({ type: 'put', store: 'yearly',    data })),
      ...loans.map(data     => ({ type: 'put', store: 'loans',     data })),
      /* نرخ واریز آخرین دوره برای دسترسی سریع */
      metaPut('defaultDepositRate', periods[periods.length - 1]?.depositRate || 200000),
      metaPut('schemaVersion', SCHEMA_VERSION),
      metaPut('importedAt', now),
      metaPut('sourceFile', opts.sourceFile || null),
      /* rawSnapshot دیگر ذخیره نمی‌شود (حجم پایگاه را دو برابر می‌کرد و منبع D-02 بود) */
      metaPut('rawSnapshot', null)
    ];
    await DB.batch(ops);

    await logAudit({
      action: 'import',
      entity: 'system',
      meta: { periods: periods.length, members: members.length, loans: loans.length }
    });

    Bus.emit(Bus.EVENTS.DATA_IMPORTED, {
      periods: periods.length, members: members.length, loans: loans.length
    });

    return { members, periods, snapshots, yearly, loans };
  }

  /* ---------- استخراج اعضا ---------- */
  function extractMembers(months) {
    const map = new Map();
    months.forEach(m => m.data.forEach(r => {
      if (!r.code) return;
      if (!map.has(r.code)) {
        map.set(r.code, M.Member.create({
          code: r.code, name: r.name, joinedAt: m.key, status: 'active'
        }));
      } else if (r.name) {
        const mb = map.get(r.code);
        if (mb.name !== r.name) { mb.name = r.name; mb.updatedAt = Date.now(); }
      }
    }));
    return [...map.values()];
  }

  /* ---------- استخراج وام‌ها ---------- */
function extractLoans(snapshots, periods) {
  const periodByKey = new Map(periods.map(p => [p.key, p]));
  const byMember = new Map();

  snapshots.forEach(s => {
    if (!byMember.has(s.memberCode)) byMember.set(s.memberCode, []);
    byMember.get(s.memberCode).push(s);
  });

  const loans = [];
  byMember.forEach((snaps, code) => {
    snaps.sort((a, b) => {
      const pa = periodByKey.get(a.periodKey);
      const pb = periodByKey.get(b.periodKey);
      return (pa.year - pb.year) || (pa.idx - pb.idx);
    });

    let prevLoan = 0;
    let prevSnap = null;
    snaps.forEach(s => {
      /* D-09: اگر ماه قبل وام تسویه شده (paidCount=20 یا remaining=0)،
         این مبلغ هرچقدر هم مساوی قبلی باشه، وام جدید است */
      const prevSettled = prevLoan > 0 && (
        (prevSnap?.paidCount || 0) >= 20 || (prevSnap?.remaining || 0) <= 0
      );
      const isNewLoan = s.loan > 0 && (s.loan !== prevLoan || prevSettled);
      if (isNewLoan) {
        const p = periodByKey.get(s.periodKey);
        loans.push(M.Loan.create({
          id: `${code}__${s.periodKey.replace(/\s+/g, '_')}`,
          memberCode: code,
          name: s.name || '',
          amount: s.loan,
          installment: Math.round(s.loan / 20),
          startPeriodKey: s.periodKey,
          startYear: p.year,
          startIdx: p.idx,
          paid: s.paidCount == null ? 0 : s.paidCount,
          remaining: s.remaining,
          status: 'active'
        }));
      }
      prevLoan = s.loan;
      prevSnap = s;
    });

    /* ─── اصلاح‌شده ─── */
const mine = loans.filter(l => l.memberCode === code);
if (mine.length) {
  const lastSnap = snaps[snaps.length - 1];
  const stillActive = lastSnap.loan > 0 && lastSnap.remaining > 0;

  /* قدم ۱: همه را settled کن */
  mine.forEach(l => {
    l.status = 'settled';
    l.paid = l.count || 20;
    l.remaining = 0;
  });

  /* قدم ۲: اگر آخرین وام فعال است، فقط همان را active کن */
  if (stillActive) {
    const last = mine[mine.length - 1];
    last.status = 'active';
    last.paid = lastSnap.paidCount || 0;
    last.remaining = lastSnap.remaining;
  }
}
  });

  return loans;
}
  /* ---------- بارگذاری از DB در state ---------- */
  async function loadAll(state) {
    const [members, periods, snapshots, yearly, loans] = await Promise.all([
      Repos.members.all(),
      Repos.periods.all(),
      Repos.snapshots.all(),
      Repos.yearly.all(),
      Repos.loans.all()
    ]);
    if (!members.length) {
      state.months = [];
      state.years = [];
      state.loans = [];
      state.members = new Map();
      state.monthIdx = -1;
      state.yearIdx = -1;
      return state;
    }

    periods.sort((a, b) => (a.year - b.year) || (a.idx - b.idx));

    /* نقشه اعضا */
    const memberMap = new Map();
    members.forEach(m => memberMap.set(m.code, {
      ...m, history: [], loans: [], last: null, first: null,
      activeLoan: null, totalPaid: 0, totalDeposit: 0, totalBorrowed: 0
    }));

    /* گروه‌بندی اسنپ‌شات‌ها */
    const snapsByPeriod = new Map();
    snapshots.forEach(s => {
      if (!snapsByPeriod.has(s.periodKey)) snapsByPeriod.set(s.periodKey, []);
      snapsByPeriod.get(s.periodKey).push(s);
    });

    /* بازسازی state.months */
    state.months = periods.map(p => {
      const rows = (snapsByPeriod.get(p.key) || []).map(s => {
        const mb = memberMap.get(s.memberCode);
        return {
          code: s.memberCode,
          name: mb ? mb.name : (s.name || ''),
          remaining: s.remaining,
          capInst: s.capInst,
          paidCount: s.paidCount,
          installment: s.installment,
          loan: s.loan,
          deposit: s.deposit,
          totalCap: s.totalCap,
          rowNo: s.rowNo
        };
      });
      return { key: p.key, name: p.name, year: p.year, idx: p.idx,
               data: rows, totals: p.totals };
    });

    /* تاریخچه اعضا */
    state.months.forEach(m => m.data.forEach(r => {
      const mb = memberMap.get(r.code);
      if (mb) mb.history.push({ monthKey: m.key, year: m.year, idx: m.idx, ...r });
    }));

    memberMap.forEach(mb => {
      mb.history.sort((a, b) => (a.year - b.year) || (a.idx - b.idx));
      mb.last  = mb.history[mb.history.length - 1] || null;
      mb.first = mb.history[0] || null;
      mb.totalPaid    = mb.history.reduce((s, h) => s + (h.installment || 0), 0);
      mb.totalDeposit = mb.history.reduce((s, h) => s + (h.deposit || 0), 0);
    });

    /* الصاق وام‌ها */
    loans.forEach(l => {
      const mb = memberMap.get(l.memberCode);
      if (mb) mb.loans.push(l);
    });
    memberMap.forEach(mb => {
      mb.loans.sort((a, b) => (a.startYear - b.startYear) || (a.startIdx - b.startIdx));
      mb.activeLoan = mb.loans.find(l => l.status === 'active') || null;
      mb.totalBorrowed = mb.loans.reduce((s, l) => s + l.amount, 0);
    });

    state.members = memberMap;
    state.years = yearly.slice().sort((a, b) => Number(a.year) - Number(b.year));
    state.loans = loans.slice().sort((a, b) =>
      (a.startYear - b.startYear) || (a.startIdx - b.startIdx));

    state.monthIdx = state.months.length - 1;
    state.yearIdx  = state.years.length - 1;

    Bus.emit(Bus.EVENTS.DATA_LOADED, {
      months: state.months.length, members: state.members.size, loans: state.loans.length
    });
    return state;
  }

  /* ---------- خروجی به فرمت اصلی ---------- */
  async function exportRaw() {
    /* همیشه از داده‌ی فعلی ساخته می‌شود، نه rawSnapshot اولیه (D-02) */
    const [members, periods, snapshots, yearly] = await Promise.all([
      Repos.members.all(), Repos.periods.all(),
      Repos.snapshots.all(), Repos.yearly.all()
    ]);

    const nameByCode = new Map(members.map(m => [m.code, m.name]));
    const snapsByPeriod = new Map();
    snapshots.forEach(s => {
      if (!snapsByPeriod.has(s.periodKey)) snapsByPeriod.set(s.periodKey, []);
      snapsByPeriod.get(s.periodKey).push(s);
    });

    const MH = {};
    periods.forEach(p => {
      const rows = (snapsByPeriod.get(p.key) || []).map(s => [
        s.remaining, s.capInst, s.paidCount, s.installment,
        s.loan, s.deposit, s.totalCap,
        nameByCode.get(s.memberCode) || null, s.memberCode, s.rowNo
      ]);
      rows.push([
        p.totals.remaining, p.totals.capInst, null, p.totals.installment,
        null, p.totals.deposit, p.totals.totalCap, null, null, null
      ]);
      MH[p.key] = {
        headers: [
          'باقیمانده وام', 'سرمایه و قسط ماهانه', 'تعداد قسط پرداخت شده',
          'قسط ماهانه', 'وام دریافتی', 'واریز ماهانه سرمایه', 'سرمایه کل',
          'نام', 'کد', 'ردیف'
        ], rows
      };
    });

    const KOL = {};
    yearly.forEach(y => { KOL[y.year] = { headers: [], rows: y.rows }; });

    return { 'MH (exported)': MH, 'KOL (exported)': KOL };
  }

  /* ---------- لاگ ---------- */
  async function logAudit(entry) {
    try {
      const actor = App.AuthService?.getCurrentUser?.()?.username || 'system';
      await Repos.audit.put(M.AuditLog.create({ ...entry, actor }));
    } catch (e) {
      console.warn('خطا در ثبت لاگ:', e);
    }
  }

  /* ---------- پاک‌سازی ---------- */
  async function clearAll() {
    /* فقط داده‌ها را پاک کن؛ کاربران/لاگ/بکاپ محلی حفظ می‌شوند */
    await DB.clearData();
    Bus.emit(Bus.EVENTS.DATA_CLEARED, {});
  }

  /* ---------- وضعیت ---------- */
  async function status() {
    const [m, p, s, y, l] = await Promise.all([
      Repos.members.count(), Repos.periods.count(), Repos.snapshots.count(),
      Repos.yearly.count(), Repos.loans.count()
    ]);
    return {
      isEmpty: m === 0,
      members: m, periods: p, snapshots: s, yearly: y, loans: l,
      schemaVersion: await getMeta('schemaVersion'),
      importedAt:    await getMeta('importedAt'),
      sourceFile:    await getMeta('sourceFile'),
      hasRaw:        !!(await getMeta('rawSnapshot'))
    };
  }

  return {
    Repos, SCHEMA_VERSION,
    setMeta, getMeta,
    isEmpty, importRaw, loadAll, exportRaw, clearAll, status, logAudit
  };
})();