/* =========================================================
   views/data.js — مدیریت داده‌ها
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.data = function (el, state) {
  const U = App.Utils;
  const DS = App.DataService;

  (async () => {
    const st = await DS.status();
    state.dbStatus = st;

    el.innerHTML = `
      <div class="card">
        <h3><span class="dot"></span> وضعیت پایگاه داده (IndexedDB)</h3>
        <div class="grid kpis" style="margin-bottom:16px">
          <div class="kpi"><div class="lbl">اعضا</div><div class="val">${U.toFa(st.members)}</div></div>
          <div class="kpi g"><div class="lbl">دوره‌ها</div><div class="val">${U.toFa(st.periods)}</div></div>
          <div class="kpi o"><div class="lbl">اسنپ‌شات‌ها</div><div class="val">${U.toFa(st.snapshots)}</div></div>
          <div class="kpi"><div class="lbl">وام‌ها</div><div class="val">${U.toFa(st.loans)}</div></div>
          <div class="kpi g"><div class="lbl">جداول سالانه</div><div class="val">${U.toFa(st.yearly)}</div></div>
        </div>
        <table class="tbl">
          <tbody>
            <tr><td style="color:var(--muted);width:220px">نسخه Schema</td>
                <td>${U.toFa(st.schemaVersion || 0)}</td></tr>
            <tr><td style="color:var(--muted)">آخرین بارگذاری</td>
                <td>${st.importedAt ? new Date(st.importedAt).toLocaleString('fa-IR') : '—'}</td></tr>
            <tr><td style="color:var(--muted)">نام فایل مبدأ</td>
                <td>${U.esc(st.sourceFile || '—')}</td></tr>
            <tr><td style="color:var(--muted)">نسخه خام ذخیره‌شده</td>
                <td>${st.hasRaw ? '<span class="badge ok">دارد</span>' : '<span class="badge mut">ندارد</span>'}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3><span class="dot"></span> مدیریت داده</h3>
        <div class="controls">
          <button class="btn plain" id="reload">📂 بارگذاری فایل جدید</button>
          <button class="btn plain" id="expJson">⬇️ دانلود پشتیبان JSON</button>
          <button class="btn plain" id="wipe" style="color:var(--danger)">🗑️ حذف تمام داده‌ها</button>
        </div>
      </div>

      <div class="card">
        <h3><span class="dot"></span> اعضای شناسایی‌شده</h3>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>کد</th><th>نام</th><th>اولین دوره</th>
              <th>آخرین دوره</th><th>تعداد دوره</th><th>تعداد وام</th><th>وضعیت</th></tr></thead>
            <tbody>
              ${[...state.members.values()]
                .sort((a, b) => String(a.code).localeCompare(String(b.code)))
                .map(m => `<tr>
                  <td><span class="badge b">${U.esc(m.code)}</span></td>
                  <td>${U.esc(m.name)}</td>
                  <td>${m.first ? U.toFa(m.first.year) + '/' + U.toFa(m.first.idx + 1) : '—'}</td>
                  <td>${m.last ? U.toFa(m.last.year) + '/' + U.toFa(m.last.idx + 1) : '—'}</td>
                  <td class="num">${U.toFa(m.history.length)}</td>
                  <td class="num">${U.toFa(m.loans.length)}</td>
                  <td>${m.status === 'active'
                    ? '<span class="badge ok">فعال</span>'
                    : '<span class="badge mut">غیرفعال</span>'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    el.querySelector('#reload').onclick = () => document.getElementById('fileInput').click();
    el.querySelector('#expJson').onclick = async () => {
      const raw = await DS.exportRaw();
      const blob = new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' });
      U.download(blob, `backup-${new Date().toISOString().slice(0, 10)}.json`);
    };
    el.querySelector('#wipe').onclick = async () => {
      const ok = await App.UI.confirm.danger(
        'تمام داده‌های صندوق (اعضا، دوره‌ها، رکوردها، وام‌ها) حذف می‌شوند. ' +
        'حساب‌های کاربری، لاگ حسابرسی و بکاپ‌های محلی حفظ خواهند شد. ' +
        'این عمل بازگشت‌پذیر نیست.',
        { confirmText: 'بله، حذف کن' }
      );
      if (!ok) return;
      await DS.clearAll();
      App.State.reset();
      if (App.Boot && typeof App.Boot.start === 'function') {
        App.Boot.start();
      } else {
        location.reload();
      }
    };
  })();
};