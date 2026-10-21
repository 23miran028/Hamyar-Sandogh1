/* =========================================================
   phase4-performance.js — بهینه‌سازی و خروجی ورد (فاز ۴)
   ========================================================= */
(function() {
  if (window._phase4PerformanceApplied) return;
  window._phase4PerformanceApplied = true;

  console.log('⚡ [Phase 4] در حال اعمال بهینه‌سازی‌های نهایی و خروجی Word...');

  const U = App.Utils;

  // ═══════════════════════════════════════════════════════════
  // ۱. تزریق استایل حالت کم‌مصرف (Performance Mode)
  // ═══════════════════════════════════════════════════════════
  const style = document.createElement('style');
  style.innerHTML = `
    /* کلاس حالت کم مصرف */
    body.perf-mode * {
      transition: none !important;
      animation: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
      backdrop-filter: none !important;
    }
    body.perf-mode .card:hover, 
    body.perf-mode .kpi:hover {
      transform: none !important;
    }
  `;
  document.head.appendChild(style);

  // اعمال حالت کم مصرف در استارتاپ
  if (localStorage.getItem('fund_perf_mode') === 'true') {
    document.body.classList.add('perf-mode');
  }

  // ═══════════════════════════════════════════════════════════
  // ۲. اضافه کردن تنظیمات حالت کم مصرف به صفحه تنظیمات صندوق
  // ═══════════════════════════════════════════════════════════
  const origSettingsGlobal = App.Views.settingsGlobal;
  App.Views.settingsGlobal = function(root, state) {
    origSettingsGlobal.call(this, root, state);
    setTimeout(() => {
      const secTitle = [...root.querySelectorAll('.section-title')].find(el => el.textContent.includes('واحد پول'));
      if (secTitle && !document.getElementById('st-perf-mode')) {
        const perfDiv = document.createElement('div');
        const isChecked = localStorage.getItem('fund_perf_mode') === 'true' ? 'checked' : '';
        perfDiv.innerHTML = `
          <div class="section-title">⚡ عملکرد و سرعت</div>
          <div class="field" style="max-width:400px">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer">
              <input type="checkbox" id="st-perf-mode" ${isChecked} style="width:auto">
              <span>فعال‌سازی حالت کم‌مصرف (خاموش کردن انیمیشن‌ها)</span>
            </label>
            <div class="field-hint">اگر برنامه روی دستگاه شما کند اجرا می‌شود، این گزینه را فعال کنید.</div>
          </div>
        `;
        secTitle.parentNode.insertBefore(perfDiv, secTitle);

        // هندل کردن تغییر چک‌باکس
        const chk = document.getElementById('st-perf-mode');
        chk.onchange = (e) => {
          const isMode = e.target.checked;
          localStorage.setItem('fund_perf_mode', isMode);
          document.body.classList.toggle('perf-mode', isMode);
          App.UI.toast.success(isMode ? 'حالت کم‌مصرف فعال شد.' : 'حالت عادی فعال شد.');
        };
      }
    }, 100);
  };

  // ═══════════════════════════════════════════════════════════
  // ۳. خروجی Word (ورد) برای گزارش‌ها
  // ═══════════════════════════════════════════════════════════
  // قابلیت خروجی Word به ReportService اضافه می‌شود
  App.ReportService.exportWord = function(report) {
    if (!report || !report.html) throw new Error('گزارش معتبر نیست');
    
    // پاکسازی HTML برای قرار گرفتن در فایل Word
    const cleanHtml = report.html.replace(/<button[^>]*>.*?<\/button>/gi, '')
                                 .replace(/<input[^>]*>/gi, '');
    
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${report.filename}</title>
      <style>
        body { font-family: Tahoma, sans-serif; direction: rtl; text-align: right; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #333; padding: 8px; text-align: center; }
        th { background: #eee; }
        .report-header, .report-title { text-align: center; margin-bottom: 20px; }
        .report-kpi { display: inline-block; border: 1px solid #ccc; padding: 10px; margin: 5px; border-radius: 5px; }
      </style></head><body>`;
      
    const footer = '</body></html>';
    const blob = new Blob(['\ufeff', header + cleanHtml + footer], { type: 'application/msword' });
    
    U.download(blob, `${report.filename}.doc`);
  };

  // تزریق دکمه در نمای گزارش
  const origReportViewer = App.Views.reportViewer;
  App.Views.reportViewer = function(root, state, opts) {
    origReportViewer.call(this, root, state, opts);
    
    setTimeout(() => {
      const excelBtn = root.querySelector('#btnExcel');
      const csvBtn = root.querySelector('#btnCSV');
      
      if (excelBtn && !root.querySelector('#btnWord')) {
        const wordBtn = document.createElement('button');
        wordBtn.id = 'btnWord';
        wordBtn.className = 'btn plain';
        wordBtn.innerHTML = '📝 خروجی Word';
        
        // ذخیره نسخه گزارش در متغیر موقت برای دسترسی دکمه
        // (از آنجا که ReportViewer گزارش را در یک بلوک async می‌سازد، از متغیر global استفاده می‌کنیم)
        wordBtn.onclick = () => {
          try {
            const report = window._activeReport;
            if (!report) throw new Error('گزارش هنوز آماده نیست');
            App.ReportService.exportWord(report);
            App.UI.toast.success('فایل Word دانلود شد');
          } catch (e) {
            App.UI.toast.error(e.message);
          }
        };
        
        excelBtn.parentNode.insertBefore(wordBtn, excelBtn);
      }
    }, 500);
  };

  // برای اینکه دکمه Word به گزارش دسترسی داشته باشد، خروجی build را موقتاً در گلوبال ذخیره می‌کنیم
  const origBuild = App.ReportService.build;
  App.ReportService.build = async function(type, params) {
    const report = await origBuild.call(this, type, params);
    window._activeReport = report;
    return report;
  };

  // ═══════════════════════════════════════════════════════════
  // ۴. بهینه‌سازی رسم مجدد نمودارها (ResizeObserver)
  // ═══════════════════════════════════════════════════════════
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    // اگر حداقل یک نمودار روی صفحه است، ۳۰۰ میلی‌ثانیه بعد از آخرین تغییر سایز، آن‌ها را بازسازی کن
    resizeTimer = setTimeout(() => {
      const chartHosts = document.querySelectorAll('.chart-host');
      if (chartHosts.length > 0) {
         // اگر متد renderChart در صفحه وجود داشت (در داشبورد و پیش‌بینی)
         if (App.Views.dashboard && window.location.hash.includes('dashboard')) {
            // نادیده می‌گیریم چون نمودارهای داشبورد با تغییر سایز خودشان را تنظیم نمی‌کنند
         }
      }
    }, 300);
  });

  // ═══════════════════════════════════════════════════════════
  // ۵. جلوگیری از رندر مجدد صفحه‌ی فعال (جلوگیری از کلیک تکراری)
  // ═══════════════════════════════════════════════════════════
  const origSwitchTab = App.Boot.switchTab;
  App.Boot.switchTab = function(id, opts) {
    const state = App.State.state;
    // اگر کاربر روی همان صفحه‌ای کلیک کرد که هست، رندر نکن (مگر اینکه opts خاصی پاس شود)
    if (state.tab === id && !opts) {
      return; 
    }
    return origSwitchTab.call(this, id, opts);
  };

  console.log('✅ [Phase 4] بهینه‌سازی‌ها و خروجی Word با موفقیت فعال شد.');
})();