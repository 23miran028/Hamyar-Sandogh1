/* =========================================================
   views/yearly.js — گزارش سالانه (با ویرایش)
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.yearly = function (el, state) {
  const U = App.Utils;
  const YS = App.YearlyService;
  const Auth = App.AuthService;
  const canWrite = Auth.hasRole('admin', 'treasurer');

  const ys = state.years || [];
  if (!ys.length) {
    el.innerHTML = '<div class="card"><div class="empty">داده سالانه‌ای موجود نیست.</div></div>';
    return;
  }

  const idx = Math.min(Math.max(state.yearIdx ?? ys.length - 1, 0), ys.length - 1);
  const y = ys[idx];
  const sum = k => y.rows.reduce((s, r) => s + U.num(r[k]), 0);

  el.innerHTML = `
    <div class="card">
      <div class="controls">
        <label style="font-weight:700">انتخاب سال:</label>
        <select id="ySel">
          ${ys.map((x, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${U.toFa(x.year)}</option>`).join('')}
        </select>
        <span class="spacer"></span>
        ${canWrite ? '<span class="badge b">✏️ قابل ویرایش</span>' : ''}
        <button class="btn plain sm" id="yExp">⬇️ خروجی CSV</button>
      </div>

      <div class="grid kpis" style="margin-bottom:16px">
        <div class="kpi g"><div class="lbl">وام‌های پرداخت‌شده در سال</div>
          <div class="val">${U.fmt(sum('loansPaid'))}</div><div class="sub">تومان</div></div>
        <div class="kpi o"><div class="lbl">اقساط دریافت‌شده</div>
          <div class="val">${U.fmt(sum('installmentsReceived'))}</div><div class="sub">تومان</div></div>
        <div class="kpi"><div class="lbl">دریافت سرمایه</div>
          <div class="val">${U.fmt(sum('capitalReceived'))}</div><div class="sub">تومان</div></div>
        <div class="kpi r"><div class="lbl">مانده پایان سال</div>
          <div class="val">${U.fmt(y.rows[y.rows.length - 1]?.balance)}</div><div class="sub">تومان</div></div>
      </div>

      <div class="tbl-wrap" style="margin-bottom:16px">
        <table class="tbl">
          <thead><tr>
            <th>ماه</th><th>موجودی</th><th>مانده</th><th>مبلغ هر وام</th><th>وام پرداختی</th>
            <th>وام‌گیرنده</th><th>مبلغ هر قسط</th><th>کل دریافتی</th>
            <th>دریافت سرمایه</th><th>اقساط دریافتی</th><th>سهام</th><th>سرمایه هر عضو</th>
            ${canWrite ? '<th>عملیات</th>' : ''}
          </tr></thead>
          <tbody>
            ${y.rows.map(r => `<tr>
              <td><b>${U.esc(r.month)}</b></td>
              <td class="num">${U.fmt(r.available)}</td>
              <td class="num">${U.fmt(r.balance)}</td>
              <td class="num">${r.loanAmt ? U.fmt(r.loanAmt) : '—'}</td>
              <td class="num">${r.loansPaid ? U.fmt(r.loansPaid) : '—'}</td>
              <td>${r.name ? U.esc(r.name) : '—'}</td>
              <td class="num">${r.instAmt ? U.fmt(r.instAmt) : '—'}</td>
              <td class="num">${U.fmt(r.totalReceived)}</td>
              <td class="num">${U.fmt(r.capitalReceived)}</td>
              <td class="num">${U.fmt(r.installmentsReceived)}</td>
              <td class="num">${U.fmt(r.share)}</td>
              <td class="num">${U.fmt(r.capitalPerMember)}</td>
              ${canWrite ? `<td class="actions">
                <button class="btn plain sm js-edit-row"
                        data-year="${U.esc(y.year)}"
                        data-month="${U.esc(r.month)}" title="ویرایش">✏️</button>
              </td>` : ''}
            </tr>`).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="3">جمع کل</td>
            <td colspan="5"></td>
            <td class="num">${U.fmt(sum('totalReceived'))}</td>
            <td class="num">${U.fmt(sum('capitalReceived'))}</td>
            <td class="num">${U.fmt(sum('installmentsReceived'))}</td>
            <td colspan="2"></td>
            ${canWrite ? '<td></td>' : ''}
          </tr></tfoot>
        </table>
      </div>

      <h3 style="margin-top:20px">
        <span class="dot" style="background:var(--brand-2)"></span>
        اقساط دریافتی از هر عضو (ماه‌به‌ماه)
        ${canWrite ? '<span class="mini-badge" style="margin-inline-start:10px">✏️ روی عدد کلیک کن یا دکمه ویرایش بزن</span>' : ''}
      </h3>
      <div class="tbl-wrap" style="max-height:420px">
        <table class="tbl">
          <thead><tr>
            <th>ماه</th>
            ${y.memberCols.map(c => `<th>${U.esc(c)}</th>`).join('')}
            <th>جمع</th>
            ${canWrite ? '<th>عملیات</th>' : ''}
          </tr></thead>
          <tbody>
            ${y.rows.map(r => {
              const tot = (r.members || []).reduce((s, x) => s + U.num(x.value), 0);
              return `<tr>
                <td><b>${U.esc(r.month)}</b></td>
                ${(r.members || []).map((x, mi) => `
                  <td class="num">
                    ${canWrite
                      ? `<input type="number" class="js-member-input"
                                data-year="${U.esc(y.year)}"
                                data-month="${U.esc(r.month)}"
                                data-mi="${mi}"
                                value="${U.num(x.value)}"
                                style="width:100px;padding:4px 6px;font-size:12px;text-align:center">`
                      : U.fmt(x.value)}
                  </td>
                `).join('')}
                <td class="num"><b>${U.fmt(tot)}</b></td>
                ${canWrite ? `<td class="actions">
                  <button class="btn plain sm js-edit-member-row"
                          data-year="${U.esc(y.year)}"
                          data-month="${U.esc(r.month)}" title="ویرایش دسته‌جمعی">✏️</button>
                </td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot><tr>
            <td>جمع</td>
            ${y.memberCols.map((c, i) => {
              const t = y.rows.reduce((s, r) => s + U.num(r.members?.[i]?.value), 0);
              return `<td class="num">${U.fmt(t)}</td>`;
            }).join('')}
            <td class="num">${U.fmt(y.rows.reduce((s, r) =>
              (r.members || []).reduce((a, x) => a + U.num(x.value), 0), 0))}</td>
            ${canWrite ? '<td></td>' : ''}
          </tr></tfoot>
        </table>
      </div>
    </div>`;

  /* ═══════════ رویدادها ═══════════ */

  el.querySelector('#ySel').onchange = e => {
    state.yearIdx = +e.target.value;
    App.Views.yearly(el, state);
  };

  el.querySelector('#yExp').onclick = () => {
    U.exportCSV(`gozaresh-sale-${y.year}.csv`,
      ['ماه', 'موجودی', 'مانده', 'مبلغ هر وام', 'وام پرداختی', 'وام‌گیرنده',
       'مبلغ هر قسط', 'کل دریافتی', 'دریافت سرمایه', 'اقساط دریافتی', 'سهام', 'سرمایه هر عضو'],
      y.rows.map(r => [r.month, r.available, r.balance, r.loanAmt, r.loansPaid,
        r.name || '', r.instAmt, r.totalReceived, r.capitalReceived,
        r.installmentsReceived, r.share, r.capitalPerMember]));
  };

  /* ---------- ویرایش ردیف ماه ---------- */
  el.querySelectorAll('.js-edit-row').forEach(btn => {
    btn.onclick = () => {
      openRowEditor(btn.dataset.year, btn.dataset.month, el, state);
    };
  });

  /* ---------- ویرایش inline مقدار عضو ---------- */
  el.querySelectorAll('.js-member-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      const year  = inp.dataset.year;
      const month = inp.dataset.month;
      const mi    = +inp.dataset.mi;
      const value = U.num(inp.value);

      try {
        await YS.updateMemberValue(year, month, mi, value);
        App.UI.toast.success('ذخیره شد');
        /* فقط total این ردیف را به‌روز کن بدون re-render کامل */
        const tr = inp.closest('tr');
        if (tr) {
          const inputs = tr.querySelectorAll('.js-member-input');
          const tot = [...inputs].reduce((s, i) => s + U.num(i.value), 0);
          const totCell = tr.querySelector('td:nth-last-child(' + (canWrite ? 2 : 1) + ')');
          if (totCell) totCell.innerHTML = '<b>' + U.fmt(tot) + '</b>';
        }
      } catch (e) {
        App.UI.toast.error(e.message);
      }
    });
  });

  /* ---------- ویرایش دسته‌جمعی اعضای یک ماه ---------- */
  el.querySelectorAll('.js-edit-member-row').forEach(btn => {
    btn.onclick = () => {
      openMemberBatchEditor(btn.dataset.year, btn.dataset.month, el, state);
    };
  });
};

/* ═══════════════════════════════════════════════════════════
   مودال ویرایش ردیف ماه
   ═══════════════════════════════════════════════════════════ */
function openRowEditor(year, monthName, el, state) {
  const U = App.Utils;
  const YS = App.YearlyService;

  (async () => {
    const y = await YS.get(year);
    if (!y) { App.UI.toast.error('سال یافت نشد'); return; }

    const row = y.rows.find(r => r.month === monthName);
    if (!row) { App.UI.toast.error('ماه یافت نشد'); return; }

    const numField = (id, label, value, hint = '') => `
      <div class="field">
        <label for="yf-${id}">${U.esc(label)}</label>
        <input id="yf-${id}" type="number" value="${U.num(value)}" step="1000"
               style="width:100%;padding:9px 11px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit">
        ${hint ? `<div class="field-hint">${U.esc(hint)}</div>` : ''}
      </div>`;

    App.UI.openModal(`
      <h3 style="margin:0 0 6px;text-align:center">✏️ ویرایش ${U.esc(monthName)} — سال ${U.toFa(year)}</h3>
      <p style="text-align:center;color:var(--muted);font-size:12.5px;margin:0 0 18px">
        مقادیر را ویرایش کن و ذخیره بزن.
      </p>

      <form id="yRowForm" style="max-width:600px;margin:0 auto">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${numField('available', 'موجودی', row.available)}
          ${numField('balance', 'مانده', row.balance)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${numField('loanAmt', 'مبلغ هر وام', row.loanAmt)}
          ${numField('loansPaid', 'وام پرداختی', row.loansPaid)}
        </div>

        <div class="field">
          <label for="yf-name">نام وام‌گیرنده</label>
          <input id="yf-name" type="text" value="${U.esc(row.name || '')}"
                 style="width:100%;padding:9px 11px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${numField('instAmt', 'مبلغ هر قسط', row.instAmt)}
          ${numField('totalReceived', 'کل دریافتی', row.totalReceived)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${numField('capitalReceived', 'دریافت سرمایه', row.capitalReceived)}
          ${numField('installmentsReceived', 'اقساط دریافتی', row.installmentsReceived)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${numField('share', 'سهام', row.share)}
          ${numField('capitalPerMember', 'سرمایه هر عضو', row.capitalPerMember)}
        </div>

        <div id="yRowAlert" style="text-align:center;margin-top:10px;color:var(--kpi-danger);font-size:12.5px"></div>

        <div style="display:flex;gap:8px;justify-content:center;margin-top:20px">
          <button type="button" class="btn plain" id="yRowCancel">انصراف</button>
          <button type="submit" class="btn solid">💾 ذخیره</button>
        </div>
      </form>
    `);

    document.getElementById('yRowCancel').onclick = () => App.UI.closeModal();

    document.getElementById('yRowForm').onsubmit = async (e) => {
      e.preventDefault();
      const alertBox = document.getElementById('yRowAlert');
      alertBox.textContent = '';

      const patch = {
        available:            Number(document.getElementById('yf-available').value) || 0,
        balance:              Number(document.getElementById('yf-balance').value) || 0,
        loanAmt:              Number(document.getElementById('yf-loanAmt').value) || 0,
        loansPaid:            Number(document.getElementById('yf-loansPaid').value) || 0,
        name:                 document.getElementById('yf-name').value.trim() || null,
        instAmt:              Number(document.getElementById('yf-instAmt').value) || 0,
        totalReceived:        Number(document.getElementById('yf-totalReceived').value) || 0,
        capitalReceived:      Number(document.getElementById('yf-capitalReceived').value) || 0,
        installmentsReceived: Number(document.getElementById('yf-installmentsReceived').value) || 0,
        share:                Number(document.getElementById('yf-share').value) || 0,
        capitalPerMember:     Number(document.getElementById('yf-capitalPerMember').value) || 0
      };

      try {
        await YS.updateRow(year, monthName, patch);
        App.UI.closeModal();
        App.UI.toast.success('تغییرات ذخیره شد');
        App.Views.yearly(el, state);
      } catch (err) {
        alertBox.textContent = err.message;
      }
    };
  })();
}

/* ═══════════════════════════════════════════════════════════
   مودال ویرایش دسته‌جمعی اعضای یک ماه
   ═══════════════════════════════════════════════════════════ */
function openMemberBatchEditor(year, monthName, el, state) {
  const U = App.Utils;
  const YS = App.YearlyService;

  (async () => {
    const y = await YS.get(year);
    if (!y) { App.UI.toast.error('سال یافت نشد'); return; }

    const row = y.rows.find(r => r.month === monthName);
    if (!row) { App.UI.toast.error('ماه یافت نشد'); return; }

    const members = row.members || [];

    App.UI.openModal(`
      <h3 style="margin:0 0 6px;text-align:center">✏️ ویرایش اقساط ${U.esc(monthName)} — ${U.toFa(year)}</h3>
      <p style="text-align:center;color:var(--muted);font-size:12.5px;margin:0 0 18px">
        مبلغ قسط دریافتی از هر عضو را ویرایش کن.
      </p>

      <form id="yMemberForm" style="max-width:560px;margin:0 auto">
        ${members.map((m, i) => `
          <div class="field" style="display:grid;grid-template-columns:1fr 160px;gap:10px;align-items:center">
            <label style="margin:0">${U.esc(m.name || 'عضو ' + (i+1))}</label>
            <input type="number" id="ym-${i}" value="${U.num(m.value)}" step="1000"
                   style="padding:9px 11px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit">
          </div>
        `).join('')}

        <div id="yMemberAlert" style="text-align:center;margin-top:12px;color:var(--kpi-danger);font-size:12.5px"></div>

        <div style="display:flex;gap:8px;justify-content:center;margin-top:20px">
          <button type="button" class="btn plain" id="yMemberCancel">انصراف</button>
          <button type="submit" class="btn solid">💾 ذخیره همه</button>
        </div>
      </form>
    `);

    document.getElementById('yMemberCancel').onclick = () => App.UI.closeModal();

    document.getElementById('yMemberForm').onsubmit = async (e) => {
      e.preventDefault();
      const alertBox = document.getElementById('yMemberAlert');
      alertBox.textContent = '';

      try {
        for (let i = 0; i < members.length; i++) {
          const val = Number(document.getElementById('ym-' + i).value) || 0;
          await YS.updateMemberValue(year, monthName, i, val);
        }
        App.UI.closeModal();
        App.UI.toast.success('همه ذخیره شدند');
        App.Views.yearly(el, state);
      } catch (err) {
        alertBox.textContent = err.message;
      }
    };
  })();
}