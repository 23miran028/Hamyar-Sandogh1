/* =========================================================
   views/period-manage.js — نسخه مقاوم (ظاهری + رفع باگ)
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.periodManage = function (root, state) {
  const U = App.Utils;
  const PS = App.PeriodService;
  const Auth = App.AuthService;

  if (!Auth.hasRole('admin')) {
    root.innerHTML = '<div class="card"><div class="empty">⛔ فقط مدیر می‌تواند دوره‌ها را مدیریت کند.</div></div>';
    return;
  }

  (async () => {
    root.innerHTML = '<div class="card"><div class="empty">⏳ در حال بارگذاری دوره‌ها…</div></div>';

    let periods = [];
    let last = null;
    try {
      periods = await PS.list();
      last = periods[periods.length - 1] || null;
    } catch (e) {
      console.error('list failed:', e);
      root.innerHTML = `<div class="card"><div class="empty" style="color:var(--danger)">
        ❌ خطا در خواندن دوره‌ها: ${U.esc(e.message)}</div></div>`;
      return;
    }

    /* دوره بعدی پیشنهادی */
    let nextYear = 0, nextIdx = 0, nextName = '—';
    if (last) {
      nextYear = last.year;
      nextIdx = last.idx + 1;
      if (nextIdx > 11) { nextIdx = 0; nextYear += 1; }
      nextName = `${U.MONTHS[nextIdx]} ${nextYear}`;
    }

    let suggestedRate = 200000;
    try {
      suggestedRate = await PS.suggestNextRate();
    } catch (e) {
      console.warn('suggestNextRate failed:', e);
    }

    /* ========== HTML ========== */
    root.innerHTML = `
      <div class="card">
        <div class="controls">
          <button class="btn plain" id="backBtn">← بازگشت به پیش‌بینی</button>
          <span class="spacer"></span>
          <h3 style="margin:0">📅 مدیریت دوره‌ها</h3>
        </div>
      </div>

      <div class="card">
        <h3><span class="dot" style="background:var(--accent-500)"></span> افزودن دوره‌ی بعدی</h3>
        <p style="color:var(--muted);font-size:13px;margin:-4px 0 12px">
          دوره‌ی بعدی: <b>${U.esc(nextName)}</b> — برای همه اعضای فعال، به‌طور خودکار یک رکورد ماهانه ساخته می‌شود
          و اقساط وام‌های جاری یک قدم جلو می‌رود.
        </p>

        <div class="field" style="max-width:520px">
          <label for="af-rate">نرخ واریز ثابت این دوره (تومان)</label>
          <input type="number" id="af-rate" value="${suggestedRate}" min="0" step="50000">
          <div class="field-hint">
            پیشنهاد بر اساس آخرین دوره: <b>${U.fmt(suggestedRate)}</b> تومان
          </div>
        </div>

        <div id="afAlert" style="max-width:520px;margin:12px 0"></div>

        <div style="display:flex;gap:8px;justify-content:flex-start;margin-top:12px">
          <button type="button" class="btn solid" id="btnCreatePeriod">
            ➕ ساخت دوره «${U.esc(nextName)}»
          </button>
        </div>
      </div>

      <div class="card">
        <h3><span class="dot"></span> فهرست دوره‌ها (${U.toFa(periods.length)})</h3>
        <div class="tbl-wrap" style="max-height:60vh">
          <table class="tbl">
            <thead><tr>
              <th>#</th><th>دوره</th><th>نرخ واریز</th>
              <th>سرمایه کل</th><th>اقساط دریافتی</th><th>باقیمانده وام‌ها</th>
              <th>عملیات</th>
            </tr></thead>
            <tbody>
              ${periods.slice().reverse().map((p, revIdx) => {
                const realIdx = periods.length - 1 - revIdx;
                const isLast = realIdx === periods.length - 1;
                return `<tr>
                  <td class="num">${U.toFa(realIdx + 1)}</td>
                  <td><b>${U.esc(p.key)}</b></td>
                  <td class="num">
                    <input type="number" value="${p.depositRate || 0}"
                           data-period="${U.esc(p.key)}"
                           class="js-rate-input"
                           min="0" step="50000"
                           style="width:130px;padding:6px 8px;font-size:13px">
                  </td>
                  <td class="num">${U.fmt(p.totals?.totalCap)}</td>
                  <td class="num">${U.fmt(p.totals?.installment)}</td>
                  <td class="num">${U.fmt(p.totals?.remaining)}</td>
                  <td class="actions">
                    <button class="btn plain sm js-save" data-period="${U.esc(p.key)}" title="ذخیره نرخ">💾</button>
                    ${isLast
  ? `<button class="btn plain sm js-del" data-period="${U.esc(p.key)}" title="حذف دوره" style="color:var(--danger)">🗑️</button>
     <button class="btn plain sm js-force-del" data-period="${U.esc(p.key)}" title="حذف با بازگردانی وام‌ها" style="color:var(--danger)">🗑️⚡</button>`
  : ''}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    /* ========== رویدادها ========== */
    root.querySelector('#backBtn').onclick = () => App.Boot.switchTab('forecast');

    const alertBox = root.querySelector('#afAlert');
    const rateInput = root.querySelector('#af-rate');
    const createBtn = root.querySelector('#btnCreatePeriod');

    createBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      alertBox.innerHTML = '';

      const rate = Number(rateInput.value) || suggestedRate || 200000;

      console.log('[period-manage] کلیک ثبت شد. rate =', rate);

      /* اگر toast/confirm نیست، بدون تأیید انجام بده */
      let ok = true;
      try {
        if (App.UI?.confirm?.ask) {
          ok = await App.UI.confirm.ask({
            title: 'افزودن دوره جدید',
            message: `دوره «${nextName}» با نرخ واریز ${U.fmt(rate)} تومان ساخته شود؟`,
            details: 'برای همه اعضای فعال یک رکورد ماهانه ساخته می‌شود و اقساط وام‌های جاری یک قدم جلو می‌رود.',
            confirmText: 'بله، بساز'
          });
        } else {
          console.warn('[period-manage] App.UI.confirm موجود نیست، بدون تأیید ادامه می‌دهیم');
        }
      } catch (err) {
        console.error('confirm failed:', err);
      }
      if (!ok) return;

      createBtn.disabled = true;
      const origText = createBtn.textContent;
      createBtn.textContent = '⏳ در حال ساخت…';

      try {
        console.log('[period-manage] فراخوانی addNext…');
        const p = await PS.addNext({ depositRate: rate });
        console.log('[period-manage] موفق:', p);

        if (App.UI?.toast?.success) {
          App.UI.toast.success(`دوره «${nextName}» ساخته شد`);
        } else {
          alert(`✅ دوره «${nextName}» ساخته شد`);
        }
        setTimeout(() => App.Views.periodManage(root, state), 400);
      } catch (err) {
        console.error('[period-manage] خطا در addNext:', err);
        const msg = err?.message || String(err);
        alertBox.innerHTML = `<div class="form-alert danger">❌ ${U.esc(msg)}</div>`;
        if (App.UI?.toast?.error) App.UI.toast.error(msg);
        createBtn.disabled = false;
        createBtn.textContent = origText;
      }
    });

    /* ذخیره نرخ دوره‌ها */
    root.querySelectorAll('.js-save').forEach(b => {
      b.onclick = async () => {
        const key = b.dataset.period;
        const input = root.querySelector(`input[data-period="${CSS.escape(key)}"]`);
        const rate = Number(input.value) || 0;

        let apply = false;
        try {
          if (App.UI?.confirm?.ask) {
            apply = await App.UI.confirm.ask({
              title: 'ذخیره نرخ واریز',
              message: `نرخ واریز دوره «${key}» به ${U.fmt(rate)} تومان تغییر کند؟`,
              details: 'آیا مبالغ واریز همه اعضا در این دوره هم به‌روز شود؟',
              confirmText: 'ذخیره و به‌روزرسانی اعضا',
              cancelText: 'فقط نرخ دوره'
            });
          }
        } catch (e) {}

        try {
          await PS.update(key, { depositRate: rate, applyToSnapshots: apply });
          if (App.UI?.toast?.success) App.UI.toast.success('نرخ ذخیره شد');
          App.Views.periodManage(root, state);
        } catch (err) {
          if (App.UI?.toast?.error) App.UI.toast.error(err.message);
        }
      };
    });

    /* حذف دوره آخر */
    root.querySelectorAll('.js-del').forEach(b => {
      b.onclick = async () => {
        const key = b.dataset.period;
        let ok = false;
        try {
          if (App.UI?.confirm?.danger) {
            ok = await App.UI.confirm.danger(
              `دوره «${key}» حذف شود؟ فقط اگر خالی باشد حذف می‌شود.`,
              { title: 'حذف دوره' }
            );
          } else {
            ok = confirm(`دوره «${key}» حذف شود؟`);
          }
        } catch (e) {}
        if (!ok) return;
        try {
          await PS.remove(key);
          if (App.UI?.toast?.success) App.UI.toast.success('دوره حذف شد');
          App.Views.periodManage(root, state);
        } catch (err) {
          if (App.UI?.toast?.error) App.UI.toast.error(err.message);
        }
      };
    });
    /* حذف با بازگردانی (force) */
root.querySelectorAll('.js-force-del').forEach(b => {
  b.onclick = async () => {
    const key = b.dataset.period;
    const ok = await App.UI.confirm.danger(
      `دوره «${key}» با بازگردانی وام‌ها حذف شود؟`,
      {
        title: '⚠️ حذف با بازگردانی',
        details: 'اقساط پرداخت‌شده‌ی این دوره برگردانده می‌شوند و وام‌ها به حالت قبل برمی‌گردند.',
        confirmText: 'بله، حذف کن'
      }
    );
    if (!ok) return;
    try {
      await PS.remove(key, { force: true });
      App.UI.toast.success('دوره با بازگردانی حذف شد');
      App.Views.periodManage(root, state);
    } catch (err) {
      App.UI.toast.error(err.message);
    }
  };
});
  })();
};