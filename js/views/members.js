/* =========================================================
   views/members.js — فهرست اعضا (نسخه ۳)
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.members = function (root, state) {
  const U = App.Utils;
  const MS = App.MemberService;
  const Auth = App.AuthService;
  const canWrite = Auth.hasRole('admin', 'treasurer');

  (async () => {
    const allList = await MS.listWithStats();

    /* توابع رندر */
    const renderRow = (m) => {
      const active = m.activeLoan;
      const pct = active
        ? Math.min(100, Math.round((active.paid || 0) / (active.count || 20) * 100))
        : 0;
      return `<tr data-code="${U.esc(m.code)}">
        <td><span class="badge b">${U.esc(m.code)}</span></td>
        <td>${U.esc(m.name)}</td>
        <td>${m.status === 'active'
          ? '<span class="badge ok">فعال</span>'
          : '<span class="badge mut">غیرفعال</span>'}</td>
        <td class="num">${U.fmt(m.totalCap)}</td>
        <td class="num">${active ? U.fmt(active.amount) : '—'}</td>
        <td class="num">${U.fmt(m.remaining)}</td>
        <td>${active ? `<div class="bar"><i style="width:${pct}%"></i></div>` : '—'}</td>
        <td class="num">${U.toFa(m.loansCount)}</td>
        ${canWrite ? `<td class="actions">
          <button class="btn plain sm" data-act="edit"   data-code="${U.esc(m.code)}" title="ویرایش">✏️</button>
          <button class="btn plain sm" data-act="detail" data-code="${U.esc(m.code)}" title="جزئیات">👁️</button>
        </td>` : ''}
      </tr>`;
    };

    const filterList = () => {
      const q = (state.memberQuery || '').trim().toLowerCase();
      if (!q) return allList;
      return allList.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.code || '').toLowerCase().includes(q));
    };

    const renderRows = () => {
      const list = filterList();
      const tbody = root.querySelector('#membersTbody');
      if (!tbody) return;
      tbody.innerHTML = list.length
        ? list.map(renderRow).join('')
        : `<tr><td colspan="${canWrite ? 9 : 8}"><div class="empty">موردی یافت نشد.</div></td></tr>`;
      const badge = root.querySelector('#membersCount');
      if (badge) badge.textContent = U.toFa(list.length) + ' عضو';
    };

    /* رندر اولیه */
    root.innerHTML = `
      <div class="card">
        <div class="controls">
          <input type="search" id="mq" placeholder="جستجوی نام یا کد..."
                 value="${U.esc(state.memberQuery)}" style="min-width:260px">
          ${canWrite ? '<button class="btn solid" id="addBtn">➕ افزودن عضو</button>' : ''}
          <span class="spacer"></span>
          <span class="badge mut" id="membersCount">—</span>
        </div>

        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr>
              <th>کد</th><th>نام</th><th>وضعیت</th><th>سرمایه کل</th>
              <th>وام جاری</th><th>باقیمانده</th><th>اقساط</th>
              <th>#وام</th>${canWrite ? '<th>عملیات</th>' : ''}
            </tr></thead>
            <tbody id="membersTbody"></tbody>
          </table>
        </div>
      </div>`;

    renderRows();

    /* جستجو — فقط tbody را عوض می‌کند، input دست‌نخورده می‌ماند */
    const inp = root.querySelector('#mq');
    inp.addEventListener('input', (e) => {
      state.memberQuery = e.target.value;
      renderRows();
    });

    /* افزودن */
    root.querySelector('#addBtn')?.addEventListener('click', () => {
      App.Views.memberEdit(root, state, {});
    });

    /* ویرایش / جزئیات */
    root.querySelector('#membersTbody').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (btn) {
        e.stopPropagation();
        const { act, code } = btn.dataset;
        if (act === 'edit')   return App.Views.memberEdit(root, state, { code });
        if (act === 'detail') return App.Views.openMember(code, state);
        return;
      }
      const tr = e.target.closest('tr[data-code]');
      if (tr) App.Views.openMember(tr.dataset.code, state);
    });
  })();
};