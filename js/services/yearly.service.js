/* =========================================================
   services/yearly.service.js — سرویس داده سالانه
   ========================================================= */
window.App = window.App || {};

App.YearlyService = (function () {
  const Err   = App.Err;
  const U     = App.Utils;
  const Repos = App.DataService.Repos;

  async function get(year) {
    return Repos.yearly.get(String(year));
  }

  async function list() {
    const arr = await Repos.yearly.all();
    return arr.sort((a, b) => Number(a.year) - Number(b.year));
  }

  /* ---------- ویرایش یک ردیف ماه ---------- */
  async function updateRow(year, monthName, patch) {
    const y = await get(year);
    if (!y) throw Err.NotFound('سال یافت نشد');

    const idx = y.rows.findIndex(r => r.month === monthName);
    if (idx === -1) throw Err.NotFound('ماه یافت نشد');

    const before = { ...y.rows[idx] };

    /* ادغام مقادیر جدید */
    y.rows[idx] = {
      ...y.rows[idx],
      ...patch,
      /* اطمینان از اینکه اعداد عدد باقی بمانند */
      balance:              U.num(patch.balance              ?? y.rows[idx].balance),
      available:            U.num(patch.available            ?? y.rows[idx].available),
      instAmt:              U.num(patch.instAmt              ?? y.rows[idx].instAmt),
      loanAmt:              U.num(patch.loanAmt              ?? y.rows[idx].loanAmt),
      loansPaid:            U.num(patch.loansPaid            ?? y.rows[idx].loansPaid),
      capitalPerMember:     U.num(patch.capitalPerMember     ?? y.rows[idx].capitalPerMember),
      totalReceived:        U.num(patch.totalReceived        ?? y.rows[idx].totalReceived),
      capitalReceived:      U.num(patch.capitalReceived      ?? y.rows[idx].capitalReceived),
      installmentsReceived: U.num(patch.installmentsReceived ?? y.rows[idx].installmentsReceived),
      share:                U.num(patch.share                ?? y.rows[idx].share),
      memberCount:          U.num(patch.memberCount          ?? y.rows[idx].memberCount),
      name:                 patch.name ?? y.rows[idx].name ?? null
    };

    y.updatedAt = Date.now();
    await Repos.yearly.put(y);

    await App.DataService.logAudit({
      action: 'yearly:update-row',
      entity: 'yearly',
      entityId: `${year}::${monthName}`,
      before,
      after: y.rows[idx]
    });

    await App.DataService.loadAll(App.State.state);
    return y.rows[idx];
  }

  /* ---------- ویرایش مقدار یک عضو در یک ماه ---------- */
  async function updateMemberValue(year, monthName, memberIdx, value) {
    const y = await get(year);
    if (!y) throw Err.NotFound('سال یافت نشد');

    const rowIdx = y.rows.findIndex(r => r.month === monthName);
    if (rowIdx === -1) throw Err.NotFound('ماه یافت نشد');

    const row = y.rows[rowIdx];
    if (!Array.isArray(row.members)) row.members = [];
    if (!row.members[memberIdx]) {
      row.members[memberIdx] = { name: '', value: 0 };
    }

    const before = { ...row.members[memberIdx] };
    row.members[memberIdx].value = U.num(value);

    y.updatedAt = Date.now();
    await Repos.yearly.put(y);

    await App.DataService.logAudit({
      action: 'yearly:update-member',
      entity: 'yearly',
      entityId: `${year}::${monthName}::${memberIdx}`,
      before,
      after: row.members[memberIdx]
    });

    await App.DataService.loadAll(App.State.state);
    return row.members[memberIdx];
  }

  /* ---------- افزودن ردیف جدید (ماه) ---------- */
  async function addRow(year, monthName) {
    const y = await get(year);
    if (!y) throw Err.NotFound('سال یافت نشد');

    if (y.rows.some(r => r.month === monthName)) {
      throw Err.Conflict('این ماه قبلاً وجود دارد');
    }

    const template = y.rows[y.rows.length - 1] || {};
    const newRow = {
      balance: 0, available: 0, instAmt: 0, loanAmt: 0, loansPaid: 0,
      capitalPerMember: template.capitalPerMember || 0,
      borrowerCount: null, name: null, month: monthName,
      totalReceived: 0, capitalReceived: 0, installmentsReceived: 0,
      share: template.share || 0, memberCount: template.memberCount || 0,
      members: (template.members || []).map(m => ({ name: m.name, value: 0 }))
    };

    y.rows.push(newRow);
    y.updatedAt = Date.now();
    await Repos.yearly.put(y);
    await App.DataService.loadAll(App.State.state);
    return newRow;
  }

  /* ---------- حذف ردیف ---------- */
  async function removeRow(year, monthName) {
    const y = await get(year);
    if (!y) throw Err.NotFound('سال یافت نشد');

    const before = y.rows.length;
    y.rows = y.rows.filter(r => r.month !== monthName);
    if (y.rows.length === before) throw Err.NotFound('ماه یافت نشد');

    y.updatedAt = Date.now();
    await Repos.yearly.put(y);
    await App.DataService.loadAll(App.State.state);
    return true;
  }

  return { get, list, updateRow, updateMemberValue, addRow, removeRow };
})();