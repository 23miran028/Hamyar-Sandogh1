/* =========================================================
   views/dashboard.js — داشبورد حرفه‌ای (ظاهری ۳)
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.dashboard = function (el, state) {
  const U = App.Utils;
  const C = App.Charts;
  const Auth = App.AuthService;

  /* ---- محافظت در برابر داده ناقص ---- */
  const ms = Array.isArray(state?.months)
    ? state.months.filter(m => m && typeof m.year === 'number')
    : [];

  if (!ms.length) {
    el.innerHTML = `
      <div class="card">
        <div class="empty-state-large">
          <div class="empty-state-icon">📊</div>
          <h3>داده‌ای برای نمایش نیست</h3>
          <p>فایل داده را بارگذاری کنید تا داشبورد فعال شود.</p>
        </div>
      </div>`;
    return;
  }

  const user = Auth.getCurrentUser();
  const last = ms[ms.length - 1];
  const prev = ms.length > 1 ? ms[ms.length - 2] : last;

  const totals = (m) => m.totals || { totalCap: 0, remaining: 0, installment: 0, deposit: 0 };
  const tLast = totals(last);
  const tPrev = totals(prev);

  const rows = Array.isArray(last.data) ? last.data : [];
  const capital   = U.num(tLast.totalCap);
  const remaining = U.num(tLast.remaining);
  const inst      = U.num(tLast.installment);
  const deposit   = U.num(tLast.deposit);
  const activeLoans = rows.filter(r => r && r.loan > 0);
  const loanSum = activeLoans.reduce((s, r) => s + U.num(r.loan), 0);

  const allLoansPaid = (state.loans || []).reduce((s, l) => s + U.num(l.amount), 0);
  const allInstallments = (state.years || []).reduce((s, y) =>
    s + (Array.isArray(y.rows) ? y.rows.reduce((a, r) => a + U.num(r.installmentsReceived), 0) : 0), 0);

  /* ---------- تغییرات ---------- */
  const delta = (a, b) => {
    if (!b) return { pct: 0, dir: 'flat', text: '—' };
    const d = a - b, p = Math.round(d / b * 1000) / 10;
    if (!d) return { pct: 0, dir: 'flat', text: 'ثابت' };
    return {
      pct: Math.abs(p),
      dir: d > 0 ? 'up' : 'down',
      text: `${d > 0 ? '▲' : '▼'} ${U.toFa(Math.abs(p))}٪`
    };
  };

  const dCapital = delta(capital, tPrev.totalCap);
  const dRemaining = delta(remaining, tPrev.remaining);
  const dInst = delta(inst, tPrev.installment);

  /* ---------- داده sparkline برای هر KPI ---------- */
  const last8 = ms.slice(-8);
  const sparkCapital = last8.map(m => U.num((m.totals || {}).totalCap));
  const sparkRemaining = last8.map(m => U.num((m.totals || {}).remaining));
  const sparkInst = last8.map(m => U.num((m.totals || {}).installment));
  const sparkLoans = last8.map(m => (m.data || []).filter(r => r && r.loan > 0).length);
  const sparkMembers = last8.map(m => (m.data || []).length);

  /* ---------- اعضای برتر (بر اساس سرمایه کل) ---------- */
  const topMembers = rows
    .map(r => {
      const active = state.members.get(r.code);
      return {
        code: r.code,
        name: r.name,
        totalCap: U.num(r.totalCap),
        hasLoan: U.num(r.loan) > 0,
        paidCount: U.num(r.paidCount),
        remaining: U.num(r.remaining),
        loanAmount: U.num(r.loan),
        status: active?.status || 'active'
      };
    })
    .sort((a, b) => b.totalCap - a.totalCap)
    .slice(0, 6);

  /* ---------- رویدادهای اخیر ---------- */
  const recentEvents = buildRecentEvents(state, ms);

  /* ---------- ترکیب سرمایه برای donut ---------- */
  const totalLoanRemaining = (state.loans || [])
    .filter(l => l.status === 'active')
    .reduce((s, l) => s + U.num(l.remaining), 0);
  const availableCash = Math.max(0, capital - totalLoanRemaining);

  const donutData = [
    { label: 'مطالبات (وام‌های جاری)', value: totalLoanRemaining, color: '#f59e0b' },
    { label: 'موجودی نقدی صندوق',      value: availableCash,       color: '#16a34a' }
  ];

  /* =========================================================
     HTML
     ========================================================= */
  el.innerHTML = `
    <!-- Hero -->
    <div class="dash-hero">
      <div class="dash-hero-content">
        <div class="dash-hero-badge">
          <span class="dot-live"></span>
          ${U.esc(U.monthLabel(last))}
        </div>
        <h1>سلام ${U.esc((user?.displayName || 'کاربر').split(' ')[0])} 👋</h1>
        <p>خوش آمدید به داشبورد صندوق قرض‌الحسنه. وضعیت مالی این ماه در یک نگاه.</p>
      </div>
      <div class="dash-hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-value">${U.toFa(rows.length)}</div>
          <div class="hero-stat-label">عضو فعال</div>
        </div>
        <div class="hero-stat-divider"></div>
        <div class="hero-stat">
          <div class="hero-stat-value">${U.toFa(activeLoans.length)}</div>
          <div class="hero-stat-label">وام جاری</div>
        </div>
        <div class="hero-stat-divider"></div>
        <div class="hero-stat">
          <div class="hero-stat-value">${U.fmt(availableCash)}</div>
          <div class="hero-stat-label">موجودی صندوق (تومان)</div>
        </div>
      </div>
    </div>

    <div class="dash-hero-actions" style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
  <button class="btn" id="dashAddPeriodBtn" type="button" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.35)">
    ➕ افزودن دوره جدید
  </button>
  <button class="btn" id="dashAddLoanBtn" type="button" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.35)">
    💳 پرداخت وام جدید
  </button>
</div>

    <!-- KPI Grid -->
    <div class="kpi-grid-modern">

      <!-- سرمایه کل -->
      <div class="kpi-card kpi-card-brand">
        <div class="kpi-card-top">
          <div class="kpi-card-icon kpi-icon-brand">💰</div>
          <div class="kpi-card-trend trend-${dCapital.dir}">
            ${dCapital.text}
          </div>
        </div>
        <div class="kpi-card-label">سرمایه کل صندوق</div>
        <div class="kpi-card-value" data-animate="${capital}">0</div>
        <div class="kpi-card-unit">تومان</div>
        <div class="kpi-spark" id="spark1"></div>
      </div>

      <!-- مطالبات -->
      <div class="kpi-card kpi-card-warn">
        <div class="kpi-card-top">
          <div class="kpi-card-icon kpi-icon-warn">📋</div>
          <div class="kpi-card-trend trend-${dRemaining.dir}">
            ${dRemaining.text}
          </div>
        </div>
        <div class="kpi-card-label">مجموع باقیمانده وام‌ها</div>
        <div class="kpi-card-value" data-animate="${remaining}">0</div>
        <div class="kpi-card-unit">تومان</div>
        <div class="kpi-spark" id="spark2"></div>
      </div>

      <!-- اقساط دریافتی -->
      <div class="kpi-card kpi-card-ok">
        <div class="kpi-card-top">
          <div class="kpi-card-icon kpi-icon-ok">💵</div>
          <div class="kpi-card-trend trend-${dInst.dir}">
            ${dInst.text}
          </div>
        </div>
        <div class="kpi-card-label">اقساط دریافتی این ماه</div>
        <div class="kpi-card-value" data-animate="${inst}">0</div>
        <div class="kpi-card-unit">تومان</div>
        <div class="kpi-spark" id="spark3"></div>
      </div>


      <!-- واریز سرمایه -->
      <div class="kpi-card kpi-card-accent">
        <div class="kpi-card-top">
          <div class="kpi-card-icon kpi-icon-accent">📥</div>
          <div class="kpi-card-trend trend-flat">واریز ماهانه</div>
        </div>
        <div class="kpi-card-label">واریز سرمایه اعضا</div>
        <div class="kpi-card-value" data-animate="${deposit}">0</div>
        <div class="kpi-card-unit">تومان</div>
        <div class="kpi-spark" id="spark4"></div>
      </div>

      <div class="kpi-card purple">
        <div class="kpi-card-top">
          <div class="kpi-card-icon kpi-icon-accent">🏦</div>
          <div class="kpi-card-trend">جاری</div>
        </div>
        <div class="kpi-card-label">موجودی واقعی این ماه</div>
        <div class="kpi-card-value">${U.fmt((tLast.deposit || 0) + (tLast.installment || 0))}</div>
        <div class="kpi-card-unit">واریز + اقساط (تومان)</div>
      </div>

    </div>

    <!-- Charts Row 1 -->
    <div class="charts-grid-modern">
      <div class="card">
        <div class="card-header">
          <div class="card-header-title">
            <span class="dot" style="background:var(--brand-500)"></span>
            <h3>روند سرمایه کل صندوق</h3>
          </div>
          <div class="card-header-meta">${U.toFa(ms.length)} دوره</div>
        </div>
        <div class="chart-host" id="c1"></div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-header-title">
            <span class="dot" style="background:var(--danger-500)"></span>
            <h3>روند باقیمانده وام‌ها</h3>
          </div>
          <div class="card-header-meta">${U.toFa(activeLoans.length)} وام فعال</div>
        </div>
        <div class="chart-host" id="c2"></div>
      </div>
    </div>

    <!-- Charts Row 2 -->
    <div class="charts-grid-modern">
      <div class="card">
        <div class="card-header">
          <div class="card-header-title">
            <span class="dot" style="background:var(--warn-500)"></span>
            <h3>اقساط دریافتی ماهانه</h3>
          </div>
        </div>
        <div class="chart-host" id="c3"></div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-header-title">
            <span class="dot" style="background:var(--ok-500)"></span>
            <h3>ترکیب سرمایه صندوق</h3>
          </div>
          <div class="card-header-meta">${U.fmt(capital)} تومان</div>
        </div>
        <div class="chart-host" id="c5"></div>
        <div id="donutLegend" class="donut-legend"></div>
      </div>
    </div>

    <!-- Top Members + Recent Activity -->
    <div class="two-col-grid">

      <!-- اعضای برتر -->
      <div class="card">
        <div class="card-header">
          <div class="card-header-title">
            <span class="dot"></span>
            <h3>اعضای برتر این ماه</h3>
          </div>
          <button class="btn plain sm" onclick="App.Boot.switchTab('members')">
            مشاهده همه ←
          </button>
        </div>
        <div class="top-members-list">
          ${topMembers.map((m, i) => `
            <div class="top-member-item" data-code="${U.esc(m.code)}">
              <div class="top-member-rank rank-${i + 1}">${U.toFa(i + 1)}</div>
              <div class="top-member-avatar">
                ${U.esc((m.name || '?').trim().charAt(0))}
              </div>
              <div class="top-member-info">
                <div class="top-member-name">${U.esc(m.name)}</div>
                <div class="top-member-meta">
                  <span class="badge b">${U.esc(m.code)}</span>
                  ${m.hasLoan
                    ? `<span class="badge warn">وام جاری</span>`
                    : `<span class="badge ok">بدون وام</span>`}
                </div>
              </div>
              <div class="top-member-value">
                <div class="top-member-cap">${U.fmt(m.totalCap)}</div>
                <div class="top-member-cap-label">تومان</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- فعالیت‌های اخیر -->
      <div class="card">
        <div class="card-header">
          <div class="card-header-title">
            <span class="dot" style="background:var(--accent-500)"></span>
            <h3>فعالیت‌های اخیر</h3>
          </div>
        </div>
        <div class="activity-feed">
          ${recentEvents.length
            ? recentEvents.map(e => `
              <div class="activity-item activity-${e.kind}">
                <div class="activity-icon">${e.icon}</div>
                <div class="activity-body">
                  <div class="activity-title">${U.esc(e.title)}</div>
                  <div class="activity-meta">${U.esc(e.meta)}</div>
                </div>
                <div class="activity-time">${U.esc(e.time)}</div>
              </div>
            `).join('')
            : '<div class="empty-mini">فعالیتی در ۳ ماه گذشته ثبت نشده است.</div>'
          }
        </div>
      </div>

    </div>
  `;

  /* =========================================================
     انیمیشن شمارنده KPI
     ========================================================= */
  el.querySelectorAll('[data-animate]').forEach((node, i) => {
    const target = Number(node.dataset.animate) || 0;
    setTimeout(() => {
      U.animateValue(node, 0, target, 900, (v) => U.fmt(v));
    }, i * 120);
  });

  /* =========================================================
     نمودارها
     ========================================================= */
  requestAnimationFrame(() => {
    try {
      const validMonths = ms.filter(m => m && typeof m.year === 'number' && typeof m.idx === 'number');
      const mLabel = (m) => U.toFa(m.year) + '/' + U.toFa(String((m.idx || 0) + 1).padStart(2, '0'));

      /* نمودار سرمایه */
      C.line(el.querySelector('#c1'),
        validMonths.map(m => ({ l: mLabel(m), v: U.num((m.totals || {}).totalCap) })),
        { color: '#3b5ff5', height: 260 });

      /* نمودار باقیمانده وام */
      C.line(el.querySelector('#c2'),
        validMonths.map(m => ({ l: mLabel(m), v: U.num((m.totals || {}).remaining) })),
        { color: '#ef4444', height: 260 });

      /* نمودار اقساط دریافتی */
      const kolMonths = [];
      (state.years || []).forEach(y => {
        if (!y || !Array.isArray(y.rows)) return;
        y.rows.forEach(r => {
          const idx = U.MONTHS.indexOf(r.month);
          kolMonths.push({
            l: U.toFa(y.year) + '/' + U.toFa(String((idx >= 0 ? idx : 0) + 1).padStart(2, '0')),
            v: U.num(r.installmentsReceived)
          });
        });
      });
      C.bars(el.querySelector('#c3'), kolMonths, { color: '#f59e0b', height: 260 });

      /* Donut ترکیب سرمایه */
      C.donut(el.querySelector('#c5'), donutData, {
        size: 210,
        thickness: 24,
        centerLabel: 'سرمایه کل',
        centerValue: capital
      });

      /* Legend */
      const legend = el.querySelector('#donutLegend');
      legend.innerHTML = donutData.map(d => `
        <div class="donut-legend-item">
          <span class="donut-legend-color" style="background:${d.color}"></span>
          <span class="donut-legend-label">${U.esc(d.label)}</span>
          <b class="donut-legend-value">${U.fmt(d.value)}</b>
          <span class="donut-legend-pct">
            ${U.toFa(((d.value / capital) * 100 || 0).toFixed(1))}٪
          </span>
        </div>`).join('');

      /* Sparklines */
      C.sparkline(el.querySelector('#spark1'), sparkCapital, { color: '#3b5ff5' });
      C.sparkline(el.querySelector('#spark2'), sparkRemaining, { color: '#ef4444' });
      C.sparkline(el.querySelector('#spark3'), sparkInst, { color: '#16a34a' });
      C.sparkline(el.querySelector('#spark4'), sparkDeposits(last8), { color: '#8b5cf6' });

    } catch (err) {
      console.warn('[dashboard] خطای نمودار:', err);
    }
  el.querySelector('#dashAddPeriodBtn')?.addEventListener('click', () => {
  App.Boot.switchTab('period-manage');
});

el.querySelector('#dashAddLoanBtn')?.addEventListener('click', () => {
  App.Boot.switchTab('loan-new');
});

  });

  /* =========================================================
     رویدادها
     ========================================================= */
  el.querySelectorAll('.top-member-item').forEach(item => {
    item.style.cursor = 'pointer';
    item.onclick = () => App.Views.openMember(item.dataset.code, state);
  });

  /* ---------- helper ---------- */
  function sparkDeposits(months) {
    return months.map(m => U.num((m.totals || {}).deposit));
  }

  function buildRecentEvents(state, months) {
    const events = [];
    const recentMonths = months.slice(-3).reverse();

    /* وام‌های اخیر */
    (state.loans || []).slice().reverse().slice(0, 5).forEach(l => {
      if (!l.startPeriodKey) return;
      events.push({
        kind: 'loan',
        icon: '💳',
        title: `وام ${U.fmt(l.amount)} تومانی به ${l.name || l.memberCode}`,
        meta: `دوره ${l.startPeriodKey}`,
        time: l.startPeriodKey,
        ts: l.startYear * 12 + l.startIdx
      });
    });

    /* اعضای جدید */
    [...state.members.values()].forEach(m => {
      if (m.createdAt && Date.now() - m.createdAt < 30 * 24 * 60 * 60 * 1000) {
        events.push({
          kind: 'member',
          icon: '👤',
          title: `عضو جدید: ${m.name}`,
          meta: `کد ${m.code}`,
          time: 'اخیر',
          ts: 99999
        });
      }
    });

    /* پرداخت‌های مهم */
    recentMonths.forEach(m => {
      const topPayer = (m.data || []).slice().sort((a, b) => U.num(b.installment) - U.num(a.installment))[0];
      if (topPayer && U.num(topPayer.installment) > 0) {
        events.push({
          kind: 'payment',
          icon: '💵',
          title: `پرداخت قسط توسط ${topPayer.name}`,
          meta: `${U.fmt(topPayer.installment)} تومان — ${U.monthLabel({ name: m.name, year: m.year })}`,
          time: m.key,
          ts: m.year * 12 + m.idx
        });
      }
    });

    events.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return events.slice(0, 8);
  }
};