/* =========================================================
   views/report-viewer.js — نمایش و چاپ گزارش
   ========================================================= */
window.App = window.App || {};
App.Views = App.Views || {};

App.Views.reportViewer = function (root, state, opts = {}) {
  const U = App.Utils;
  const RS = App.ReportService;
  const { type, params } = opts;

  root.innerHTML = '<div class="card"><div class="empty">⏳ در حال آماده‌سازی گزارش…</div></div>';

  (async () => {
    let report;
    try {
      report = await RS.build(type, params);
    } catch (err) {
      console.error(err);
      root.innerHTML = `
        <div class="card">
          <div class="empty" style="color:var(--danger)">
            ❌ خطا در ساخت گزارش: ${U.esc(err.message)}
            <br>
            <button class="btn plain" onclick="App.Boot.switchTab('reports')" style="margin-top:12px">
              ← بازگشت به مرکز گزارش‌ها
            </button>
          </div>
        </div>`;
      return;
    }

    root.innerHTML = `
      <div class="report-toolbar no-print">
        <button class="btn plain" id="btnBack">← بازگشت به مرکز گزارش‌ها</button>
        <span class="spacer"></span>
        <button class="btn plain" id="btnExcel">📊 خروجی Excel</button>
        <button class="btn plain" id="btnCSV">📄 خروجی CSV</button>
        <button class="btn solid" id="btnPrint">🖨️ چاپ / PDF</button>
      </div>

      <div class="report-page" id="reportPage">
        ${report.html}
      </div>`;

    root.querySelector('#btnBack').onclick  = () => App.Boot.switchTab('reports');
    root.querySelector('#btnPrint').onclick = () => RS.print();

    root.querySelector('#btnExcel').onclick = () => {
      try {
        RS.exportExcel(report);
        App.UI.toast.success('فایل Excel دانلود شد');
      } catch (e) {
        App.UI.toast.error('خطا در خروجی Excel: ' + e.message);
      }
    };

    root.querySelector('#btnCSV').onclick = () => {
      try {
        RS.exportCSV(report);
        App.UI.toast.success('فایل CSV دانلود شد');
      } catch (e) {
        App.UI.toast.error('خطا در خروجی CSV: ' + e.message);
      }
    };

    /* اسکرول به بالا */
    window.scrollTo({ top: 0, behavior: 'smooth' });
  })();
};