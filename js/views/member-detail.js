/* =========================================================
   views/member-detail.js — مودال جزئیات کامل عضو
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.openMember = function (code, state) {
  const U = App.Utils;
  const C = App.Charts;
  const Auth = App.AuthService;

  const m = state.members.get(code);
  if (!m) {
    if (App.UI?.toast?.error) App.UI.toast.error('عضو یافت نشد');
    else alert('عضو یافت نشد');
    return;
  }

  const L = m.last || {};
  const pct = Math.min(100, Math.round(((L.paidCount || 0) / 20) * 100));

  const canWrite = Auth.hasRole('admin', 'treasurer');

  /* تاریخچه به ترتیب نزولی */
  const history = (m.history || []).slice().reverse();

  /* وام‌ها به ترتیب نزولی */
  const loans = (m.loans || []).slice().reverse();

  /* جمع‌ها */
  const totalDeposits = m.totalDeposit || 0;
  const totalPaid     = m.totalPaid || 0;
  const totalCap      = U.num(L.totalCap);

  const html = `
    <div class="mhead">
      <div class="avatar">${U.esc((m.name || '?').trim().charAt(0))}</div>
      <div style="flex:1;min-width:0">
        <h2>${U.esc(m.name)}</h2>
        <span>کد عضویت: ${U.esc(m.code)} • ${U.toFa((m.history || []).length)} دوره ثبت‌شده
          ${m.status === 'active' ? '• <span style="color:var(--ok-600)">فعال</span>' : '• <span style="color:var(--muted)">غیرفعال</span>'}
        </span>
      </div>
      ${canWrite ? `
        <button class="btn plain sm" id="mdEditBtn" title="ویرایش عضو">✏️ ویرایش</button>
      ` : ''}
    </div>

    <!-- KPIها -->
    <div class="grid kpis" style="margin-bottom:16px">
      <div class="kpi">
        <div class="lbl">سرمایه کل</div>
        <div class="val">${U.fmt(totalCap)}</div>
        <div class="sub">تومان</div>
      </div>
      <div class="kpi g">
        <div class="lbl">جمع واریزها</div>
        <div class="val">${U.fmt(totalDeposits)}</div>
        <div class="sub">تومان</div>
      </div>
      <div class="kpi o">
        <div class="lbl">جمع اقساط پرداخت‌شده</div>
        <div class="val">${U.fmt(totalPaid)}</div>
        <div class="sub">تومان</div>
      </div>
      <div class="kpi ${m.activeLoan ? 'r' : 'g'}">
        <div class="lbl">باقیمانده وام جاری</div>
        <div class="val">${U.fmt(L.remaining)}</div>
        <div class="sub">${m.activeLoan
          ? `${U.toFa(L.paidCount || 0)} از ۲۰ قسط`
          : 'بدون وام جاری'}</div>
      </div>
    </div>

    <!-- پیشرفت بازپرداخت -->
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin-bottom:12px"><span class="dot"></span> پیشرفت بازپرداخت وام جاری</h3>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="bar" style="flex:1;height:12px">
          <i style="width:${pct}%"></i>
        </div>
        <b style="white-space:nowrap">${U.toFa(L.paidCount || 0)} از ۲۰ قسط</b>
      </div>
      ${m.activeLoan ? `
        <div style="font-size:12.5px;color:var(--muted);margin-top:8px">
          مبلغ وام: <b>${U.fmt(m.activeLoan.amount)} تومان</b>
          • قسط ماهانه: <b>${U.fmt(m.activeLoan.installment)} تومان</b>
          • باقیمانده: <b style="color:var(--danger-600)">${U.fmt(L.remaining)} تومان</b>
        </div>
      ` : ''}
    </div>

    <!-- نمودار روند -->
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin-bottom:12px"><span class="dot" style="background:var(--danger-500)"></span> روند باقیمانده وام</h3>
      <div class="chart-host" id="mdChart" style="min-height:200px"></div>
    </div>

    <!-- وام‌ها -->
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin-bottom:12px"><span class="dot" style="background:var(--warn-500)"></span> سابقه وام‌ها (${U.toFa(loans.length)} فقره)</h3>
      ${loans.length ? `
        <div class="tbl-wrap" style="max-height:280px">
          <table class="tbl">
            <thead><tr>
              <th>دوره شروع</th><th>مبلغ وام</th><th>قسط</th>
              <th>پرداخت‌شده</th><th>باقیمانده</th><th>وضعیت</th>
            </tr></thead>
            <tbody>
              ${loans.map(l => `<tr class="js-loan-row" data-id="${U.esc(l.id)}" style="cursor:pointer">
                <td>${U.esc(l.startPeriodKey || '—')}</td>
                <td class="num">${U.fmt(l.amount)}</td>
                <td class="num">${U.fmt(l.installment)}</td>
                <td class="num">${U.toFa(l.paid || 0)} از ۲۰</td>
                <td class="num">${U.fmt(l.remaining)}</td>
                <td>${l.status === 'active'
                  ? '<span class="badge warn">جاری</span>'
                  : '<span class="badge ok">تسویه‌شده</span>'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-mini">وامی ثبت نشده است.</div>'}
    </div>

    <!-- کارنامه ماه‌به‌ماه -->
    <div class="card">
      <h3 style="margin-bottom:12px"><span class="dot" style="background:var(--accent-500)"></span> کارنامه ماه‌به‌ماه</h3>
      <div class="tbl-wrap" style="max-height:340px">
        <table class="tbl">
          <thead><tr>
            <th>دوره</th><th>واریز</th><th>وام</th>
            <th>قسط</th><th>پرداخت‌شده</th><th>باقیمانده</th><th>سرمایه کل</th>
          </tr></thead>
          <tbody>
            ${history.map(h => `<tr>
              <td>${U.esc(h.monthKey || '—')}</td>
              <td class="num">${U.fmt(h.deposit)}</td>
              <td class="num">${h.loan ? U.fmt(h.loan) : '—'}</td>
              <td class="num">${h.installment ? U.fmt(h.installment) : '—'}</td>
              <td class="num">${h.paidCount != null ? U.toFa(h.paidCount) : '—'}</td>
              <td class="num">${U.fmt(h.remaining)}</td>
              <td class="num"><b>${U.fmt(h.totalCap)}</b></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (App.UI?.openModal) {
    App.UI.openModal(html);
  } else {
    alert('خطا: App.UI.openModal موجود نیست');
    return;
  }

  /* دکمه ویرایش */
  const editBtn = document.getElementById('mdEditBtn');
  if (editBtn) {
    editBtn.onclick = () => {
      if (App.UI?.closeModal) App.UI.closeModal();
      setTimeout(() => App.Views.memberEdit(document.getElementById('view'), state, { code }), 200);
    };
  }

  /* کلیک روی وام‌ها → صفحه جزئیات وام */
  document.querySelectorAll('.js-loan-row').forEach(tr => {
    tr.onclick = () => {
      if (App.UI?.closeModal) App.UI.closeModal();
      setTimeout(() => App.Boot.switchTab('loan-detail', { id: tr.dataset.id }), 200);
    };
  });

  /* نمودار */
  requestAnimationFrame(() => {
    try {
      const chartHost = document.getElementById('mdChart');
      if (!chartHost) return;
      const hist = m.history || [];
      if (!hist.length) {
        chartHost.innerHTML = '<div class="empty-mini">داده‌ای برای نمایش نیست.</div>';
        return;
      }
      C.line(chartHost, hist.map(h => ({
        l: U.toFa(h.year) + '/' + U.toFa(String((h.idx || 0) + 1).padStart(2, '0')),
        v: U.num(h.remaining)
      })), { color: '#ef4444', height: 200 });
    } catch (err) {
      console.warn('[member-detail] خطای نمودار:', err);
    }
  });
};