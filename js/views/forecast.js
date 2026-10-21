/* =========================================================
   views/forecast.js — پیش‌بینی صندوق
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.forecast = function (root, state) {
  const U = App.Utils;
  const F = App.ForecastService;
  const C = App.Charts;

  (async () => {
    root.innerHTML = '<div class="card"><div class="empty">⏳ در حال محاسبه پیش‌بینی…</div></div>';

    const [fundPower, allForecasts, projection] = await Promise.all([
      F.getFundPower(),
      F.getAllMemberForecasts(),
      F.projectFund(18)
    ]);

    if (!fundPower.lastPeriod) {
      root.innerHTML = '<div class="card"><div class="empty">داده‌ای برای پیش‌بینی موجود نیست.</div></div>';
      return;
    }

    /* واجدین شرایط وام جدید */
    const eligible = allForecasts.filter(f => !f.hasActiveLoan);
    const withActive = allForecasts.filter(f => f.hasActiveLoan);

    /* پیش‌بینی وام برای هر واجد شرایط */
    const predictions = eligible.map(p => ({
      ...p,
      nextLoan: F.predictNextLoan(p, fundPower, eligible.length)
    }));

    /* دوره‌ی پایان ۱۸ ماه آینده */
    const lastProjection = projection[projection.length - 1];

    root.innerHTML = `
      <div class="card">
        <div class="controls">
          <h3 style="margin:0"><span class="dot"></span> قدرت صندوق — ${U.monthLabel(fundPower.lastPeriod)}</h3>
          <span class="spacer"></span>
          <button class="btn plain sm" id="btnAddPeriod">➕ افزودن دوره جدید</button>
        </div>

        <div class="grid kpis">
          <div class="kpi">
            <div class="lbl">سرمایه کل صندوق</div>
            <div class="val">${U.fmt(fundPower.totalCapital)}</div>
            <div class="sub">تومان • مجموع واریزی‌ها + اقساط</div>
          </div>
          <div class="kpi r">
            <div class="lbl">مطالبات از اعضا</div>
            <div class="val">${U.fmt(fundPower.activeLoansOutstanding)}</div>
            <div class="sub">وام‌های جاری</div>
          </div>
          <div class="kpi g">
            <div class="lbl">موجودی نقدی قابل تخصیص</div>
            <div class="val">${U.fmt(fundPower.availableCash)}</div>
            <div class="sub">تومان</div>
          </div>
          <div class="kpi o">
            <div class="lbl">ورودی ماهانه</div>
            <div class="val">${U.fmt(fundPower.monthlyInflow)}</div>
            <div class="sub">واریز: ${U.fmt(fundPower.monthlyDeposits)} + قسط: ${U.fmt(fundPower.monthlyInstallments)}</div>
          </div>
          <div class="kpi">
            <div class="lbl">واریز ثابت اعضا</div>
            <div class="val">${U.fmt(fundPower.depositRate)}</div>
            <div class="sub">تومان / ماه × ${U.toFa(fundPower.activeMembersCount)} عضو</div>
          </div>
          <div class="kpi">
            <div class="lbl">پیش‌بینی سرمایه پس از ۱۸ ماه</div>
            <div class="val">${U.fmt(lastProjection?.projectedCapital || 0)}</div>
            <div class="sub">در ${lastProjection?.key || '—'}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3><span class="dot"></span> پیش‌بینی رشد سرمایه صندوق</h3>
        <div class="chart-host" id="projChart"></div>
        <div class="tbl-wrap" style="margin-top:16px;max-height:300px">
          <table class="tbl">
            <thead><tr>
              <th>ماه</th><th>واریز اعضا</th><th>اقساط</th>
              <th>ورودی کل</th><th>سرمایه پیش‌بینی‌شده</th>
            </tr></thead>
            <tbody>
              ${projection.map(p => `<tr>
                <td>${U.esc(p.key)}</td>
                <td class="num">${U.fmt(p.monthlyDeposits)}</td>
                <td class="num">${U.fmt(p.monthlyInstallments)}</td>
                <td class="num">${U.fmt(p.monthlyInflow)}</td>
                <td class="num"><b>${U.fmt(p.projectedCapital)}</b></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3><span class="dot" style="background:var(--danger)"></span> اعضای دارای وام جاری — زمان تسویه</h3>
        ${withActive.length ? `
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr>
                <th>کد</th><th>نام</th><th>مبلغ وام</th><th>قسط ماهانه</th>
                <th>پرداخت‌شده</th><th>باقیمانده</th><th>تسویه در</th>
              </tr></thead>
              <tbody>
                ${withActive.map(f => {
                  const l = f.activeLoan;
                  return `<tr data-code="${U.esc(f.member.code)}" class="clickable">
                    <td><span class="badge b">${U.esc(f.member.code)}</span></td>
                    <td>${U.esc(f.member.name)}</td>
                    <td class="num">${U.fmt(l.amount)}</td>
                    <td class="num">${U.fmt(l.installment)}</td>
                    <td class="num">${U.toFa(l.paid)} از ۲۰</td>
                    <td class="num">${U.fmt(l.remaining)}</td>
                    <td><b style="color:var(--warn)">${U.esc(f.currentLoanPayoff || '—')}</b></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty">هیچ وام جاری‌ای وجود ندارد.</div>'}
      </div>

      <div class="card">
        <h3><span class="dot" style="background:var(--brand2)"></span>
          اولویت وام‌گیری آینده</h3>
        <p style="color:var(--muted);font-size:12.5px;margin:-4px 0 12px">
          امتیاز بر اساس: ۴۰٪ سابقه واریز، ۳۰٪ مدت انتظار، ۲۰٪ نبود وام فعال، ۱۰٪ اعتبار بازپرداخت.
        </p>
        ${predictions.length ? `
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr>
                <th>#</th><th>کد</th><th>نام</th><th>جمع واریزی</th>
                <th>ماه انتظار</th><th>سابقه</th><th>امتیاز</th>
                <th>وام پیش‌بینی‌شده</th><th>قسط</th>
                <th>شروع</th><th>تسویه</th>
              </tr></thead>
              <tbody>
                ${predictions.map((f, i) => {
                  const p = f.nextLoan;
                  return `<tr data-code="${U.esc(f.member.code)}" class="clickable">
                    <td class="num">${U.toFa(i + 1)}</td>
                    <td><span class="badge b">${U.esc(f.member.code)}</span></td>
                    <td>${U.esc(f.member.name)}</td>
                    <td class="num">${U.fmt(f.totalDeposits)}</td>
                    <td class="num">${f.monthsSinceLastLoan >= 999
                      ? '—'
                      : U.toFa(f.monthsSinceLastLoan) + ' ماه'}</td>
                    <td class="num">${U.toFa(f.settledLoans)} / ${U.toFa(f.totalLoans)}</td>
                    <td><span class="badge ${f.priority >= 60 ? 'ok' : f.priority >= 40 ? 'warn' : 'mut'}">
                      ${U.toFa(f.priority)}</span></td>
                    <td class="num"><b style="color:var(--brand)">${p ? U.fmt(p.amount) : '—'}</b></td>
                    <td class="num">${p ? U.fmt(p.installment) : '—'}</td>
                    <td>${p ? U.esc(p.startKey) : '—'}</td>
                    <td>${p ? U.esc(p.payoffKey) : '—'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty">هیچ عضوی برای وام آینده واجد شرایط نیست.</div>'}
      </div>

      <div class="card">
        <h3><span class="dot"></span> خلاصه تمام اعضا</h3>
        <div class="tbl-wrap" style="max-height:60vh">
          <table class="tbl">
            <thead><tr>
              <th>کد</th><th>نام</th><th>وضعیت وام</th><th>جمع واریزی</th>
              <th>جمع اقساط</th><th>باقیمانده وام</th><th>تسویه فعلی در</th>
              <th>امتیاز</th>
            </tr></thead>
            <tbody>
              ${allForecasts.map(f => {
                const s = f.lastSnap || {};
                return `<tr data-code="${U.esc(f.member.code)}" class="clickable">
                  <td><span class="badge b">${U.esc(f.member.code)}</span></td>
                  <td>${U.esc(f.member.name)}</td>
                  <td>${f.hasActiveLoan
                    ? '<span class="badge warn">وام جاری</span>'
                    : f.settledLoans > 0
                      ? '<span class="badge ok">تسویه‌شده</span>'
                      : '<span class="badge mut">بدون وام</span>'}</td>
                  <td class="num">${U.fmt(f.totalDeposits)}</td>
                  <td class="num">${U.fmt(f.totalInstallments)}</td>
                  <td class="num">${U.fmt(s.remaining)}</td>
                  <td>${f.currentLoanPayoff ? U.esc(f.currentLoanPayoff) : '—'}</td>
                  <td><span class="badge ${f.priority >= 60 ? 'ok' : f.priority >= 40 ? 'warn' : 'mut'}">
                    ${U.toFa(f.priority)}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    /* دکمه افزودن دوره */
    root.querySelector('#btnAddPeriod').onclick = () =>
      App.Boot.switchTab('period-manage');

    /* کلیک روی ردیف‌ها → پروفایل عضو */
    root.querySelectorAll('tr[data-code]').forEach(tr => {
      tr.onclick = () => App.Views.openMember(tr.dataset.code, state);
    });

    /* نمودار */
    requestAnimationFrame(() => {
      const validProjection = projection.filter(p => p && typeof p.year === 'number');
      C.line(root.querySelector('#projChart'),
        validProjection.map(p => ({
          l: U.toFa(p.year) + '/' + U.toFa(String(p.idx + 1).padStart(2, '0')),
          v: p.projectedCapital
        })),
        { color: 'var(--brand)', height: 280 });
    });
  })();
};