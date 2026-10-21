/* =========================================================
   views/audit-log.js — لاگ تغییرات
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.auditLog = function (root, state) {
  const U = App.Utils;

  (async () => {
    const logs = await App.DataService.Repos.audit.all();
    logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const actionColors = {
      'edit:member':   'brand',
      'edit:period':   'warning',
      'edit:snapshot': 'purple',
      'edit:loan':     'success',
      'edit:loan-delete': 'danger',
      'loan:disburse': 'success',
      'loan:pay':      'ok',
      'period:add':    'brand',
      'import':        'purple'
    };

    root.innerHTML = `
      <div class="card">
        <div class="controls">
          <h3 style="margin:0"><span class="dot"></span> 📋 لاگ تغییرات</h3>
          <span class="spacer"></span>
          <span class="badge mut">${U.toFa(logs.length)} رویداد</span>
          <button class="btn plain sm" id="refreshBtn">🔄 رفرش</button>
        </div>

        <div class="tbl-wrap" style="max-height:70vh">
          <table class="tbl">
            <thead><tr>
              <th>تاریخ</th>
              <th>عملیات</th>
              <th>موجودیت</th>
              <th>شناسه</th>
              <th>تغییر</th>
            </tr></thead>
            <tbody>
              ${logs.length ? logs.slice(0, 300).map(l => {
                const tone = actionColors[l.action] || 'mut';
                const dt = l.timestamp
                  ? new Date(l.timestamp).toLocaleString('fa-IR')
                  : '—';

                let summary = '—';
                if (l.before && l.after) {
                  const keys = Object.keys(l.after).filter(k =>
                    JSON.stringify(l.before[k]) !== JSON.stringify(l.after[k])
                  );
                  summary = keys.slice(0, 3).map(k =>
                    `${k}: ${String(l.before[k]).slice(0, 15)} → ${String(l.after[k]).slice(0, 15)}`
                  ).join(' • ') || '—';
                } else if (l.after) {
                  summary = JSON.stringify(l.after).slice(0, 80);
                } else if (l.before) {
                  summary = JSON.stringify(l.before).slice(0, 80);
                }

                return `<tr>
                  <td style="font-size:11.5px;color:var(--muted)">${U.esc(dt)}</td>
                  <td><span class="badge ${tone}">${U.esc(l.action || '—')}</span></td>
                  <td>${U.esc(l.entity || '—')}</td>
                  <td><span class="badge b" style="font-size:10.5px">${U.esc(String(l.entityId || '—').slice(0, 20))}</span></td>
                  <td style="font-size:11.5px;color:var(--muted);max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    ${U.esc(summary)}
                  </td>
                </tr>`;
              }).join('') : '<tr><td colspan="5"><div class="empty">لاگی موجود نیست</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;

    root.querySelector('#refreshBtn').onclick = () => App.Views.auditLog(root, state);
  })();
};