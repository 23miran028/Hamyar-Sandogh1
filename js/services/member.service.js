/* =========================================================
   services/member.service.js — CRUD اعضا
   ========================================================= */
window.App = window.App || {};

App.MemberService = (function () {
  const Err = App.Err;
  const M   = App.Models;
  const Bus = App.Bus;
  const V   = App.Validators;
  const Repos = App.DataService.Repos;

  async function list() {
    return Repos.members.all();
  }

  async function get(code) {
    return Repos.members.get(String(code).trim());
  }

  async function listCodes() {
    const all = await Repos.members.all();
    return new Set(all.map(m => m.code));
  }

  async function create(input) {
    const member = M.Member.create(input);
    const codes = await listCodes();
    const v = V.member(member, codes);
    if (!v.ok) throw Err.Validation('اطلاعات نامعتبر', v.errors);

    const exists = await Repos.members.get(member.code);
    if (exists) throw Err.Conflict('عضوی با این کد وجود دارد');

    await Repos.members.put(member);
    await App.DataService.logAudit({
      action: 'member:create', entity: 'member', entityId: member.code,
      after: { code: member.code, name: member.name }
    });
    Bus.emit(Bus.EVENTS.MEMBER_UPDATED, { code: member.code, action: 'create' });
    return member;
  }

  async function update(code, patch) {
    const existing = await Repos.members.get(code);
    if (!existing) throw Err.NotFound('عضو یافت نشد');

    const merged = M.Member.create({ ...existing, ...patch, code });
    const v = V.member(merged, null);   // بدون بررسی یکتایی کد (کد تغییر نمی‌کند)
    if (!v.ok) throw Err.Validation('اطلاعات نامعتبر', v.errors);

    merged.updatedAt = Date.now();
    await Repos.members.put(merged);
    await App.DataService.logAudit({
      action: 'member:update', entity: 'member', entityId: code,
      before: { name: existing.name, status: existing.status },
      after:  { name: merged.name,   status: merged.status }
    });
    Bus.emit(Bus.EVENTS.MEMBER_UPDATED, { code, action: 'update' });
    return merged;
  }

  /* غیرفعال‌سازی (soft) یا حذف کامل اگر هیچ سابقه‌ای نداشته باشد */
  async function remove(code) {
    const member = await Repos.members.get(code);
    if (!member) throw Err.NotFound('عضو یافت نشد');

    const snaps = await Repos.snapshots.byIndex('memberCode', code);
    const loans = await Repos.loans.byIndex('memberCode', code);

    if (snaps.length || loans.length) {
      /* غیرفعال‌سازی */
      member.status = 'inactive';
      member.updatedAt = Date.now();
      await Repos.members.put(member);
      await App.DataService.logAudit({
        action: 'member:deactivate', entity: 'member', entityId: code
      });
      Bus.emit(Bus.EVENTS.MEMBER_UPDATED, { code, action: 'deactivate' });
      return { mode: 'deactivate' };
    }

    await Repos.members.del(code);
    await App.DataService.logAudit({
      action: 'member:delete', entity: 'member', entityId: code,
      before: { code: member.code, name: member.name }
    });
    Bus.emit(Bus.EVENTS.MEMBER_UPDATED, { code, action: 'delete' });
    return { mode: 'delete' };
  }

  async function activate(code) {
    const member = await Repos.members.get(code);
    if (!member) throw Err.NotFound('عضو یافت نشد');
    member.status = 'active';
    member.updatedAt = Date.now();
    await Repos.members.put(member);
    Bus.emit(Bus.EVENTS.MEMBER_UPDATED, { code, action: 'activate' });
    return member;
  }

  /* لیست اعضا + آمار خلاصه */
  async function listWithStats() {
    const [members, loans, snaps] = await Promise.all([
      Repos.members.all(),
      Repos.loans.all(),
      Repos.snapshots.all()
    ]);
    const loansByMember = new Map();
    loans.forEach(l => {
      if (!loansByMember.has(l.memberCode)) loansByMember.set(l.memberCode, []);
      loansByMember.get(l.memberCode).push(l);
    });
    const lastSnapByMember = new Map();
    snaps.forEach(s => {
      const cur = lastSnapByMember.get(s.memberCode);
      if (!cur || (s.periodKey > cur.periodKey)) lastSnapByMember.set(s.memberCode, s);
    });

    return members.map(m => {
      const ls = lastSnapByMember.get(m.code) || null;
      const lns = loansByMember.get(m.code) || [];
      const active = lns.find(l => l.status === 'active') || null;
      return {
        ...m,
        lastSnapshot: ls,
        loansCount: lns.length,
        activeLoan: active,
        remaining: ls?.remaining || 0,
        totalCap:  ls?.totalCap  || 0
      };
    }).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }

  return { list, get, create, update, remove, activate, listWithStats, listCodes };
})();