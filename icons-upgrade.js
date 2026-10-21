/* =========================================================
   icons-upgrade.js — ارتقای تمام آیکون‌های برنامه به SVG مدرن
   ========================================================= */
(function() {
  if (window._iconsUpgradeApplied) return;
  window._iconsUpgradeApplied = true;

  console.log('🎨 [Icons] در حال ارتقای آیکون‌های برنامه...');

  // تزریق استایل برای آیکون‌های SVG
  const style = document.createElement('style');
  style.innerHTML = `
    .app-svg-icon {
      width: 1.15em;
      height: 1.15em;
      display: inline-block;
      vertical-align: -0.15em;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      margin: 0 0.1em;
    }
    /* اصلاح چیدمان دکمه‌هایی که آیکون دارند */
    .btn .app-svg-icon, .sidebar-item .app-svg-icon, .icon-btn .app-svg-icon {
      margin: 0;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);

  // دیکشنری تبدیل ایموجی به آیکون SVG
  const ICON_MAP = {
    // سایدبار
    '📊': `<rect x="18" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="2" y="13" width="4" height="8" rx="1"/>`,
    '🔮': `<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/>`,
    '🔔': `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
    '👥': `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
    '💳': `<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>`,
    '📅': `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
    '📈': `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>`,
    '📄': `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
    '💾': `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>`,
    '⚙️': `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
    '📋': `<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/>`,
    '🗄️': `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>`,
    '👤': `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
    
    // نوار بالا و عمومی
    '📂': `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`,
    '🖨️': `<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>`,
    '🌗': `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`,
    '🔄': `<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`,
    '➕': `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
    '⬇️': `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
    '⬆️': `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`,
    '✏️': `<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`,
    '🗑️': `<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>`,
    '👁️': `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
    '💵': `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
    '💰': `<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>`,
    '❌': `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
    '✅': `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
    '⚠️': `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    'ℹ️': `<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`,
    '🔐': `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
    '🔑': `<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>`,
    '🚪': `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`,
    '←': `<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>`,
    '⛔': `<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>`,
    '📭': `<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>`
  };

  // تابع بازگشتی برای پیدا کردن و جایگزینی متن‌ها
  function replaceEmojis(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue;
      let replaced = false;
      
      for (const [emoji, svgPath] of Object.entries(ICON_MAP)) {
        if (text.includes(emoji)) {
          // اگر متن دقیقاً همان ایموجی بود (حالت معمول در دکمه‌ها)
          if (text.trim() === emoji) {
            const span = document.createElement('span');
            span.innerHTML = `<svg class="app-svg-icon" viewBox="0 0 24 24">${svgPath}</svg>`;
            node.parentNode.replaceChild(span, node);
            return; // توقف پردازش این گره
          } else {
            // اگر ایموجی درون یک متن طولانی‌تر بود
            const span = document.createElement('span');
            span.innerHTML = `<svg class="app-svg-icon" viewBox="0 0 24 24">${svgPath}</svg>`;
            const parts = text.split(emoji);
            const frag = document.createDocumentFragment();
            parts.forEach((part, i) => {
              if (part) frag.appendChild(document.createTextNode(part));
              if (i < parts.length - 1) frag.appendChild(span.cloneNode(true));
            });
            node.parentNode.replaceChild(frag, node);
            return;
          }
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // جلوگیری از پردازش داخل تگ‌های ورودی، متن و اسکریپت
      if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SVG'].includes(node.tagName)) return;
      
      // ایجاد یک کپی از فرزندان برای جلوگیری از خطای تغییر طول آرایه در حین پیمایش
      const children = Array.from(node.childNodes);
      children.forEach(replaceEmojis);
    }
  }

  // اجرای اولیه روی کل صفحه
  const initIcons = () => {
    replaceEmojis(document.body);
  };

  // راه‌اندازی MutationObserver برای تغییرات پویا (زمانی که صفحات لود می‌شوند)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
          replaceEmojis(node);
        }
      });
    });
  });

  // اجرای برنامه
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initIcons();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    initIcons();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // نمایش لاگ موفقیت پس از کمی تاخیر
  setTimeout(() => console.log('✨ [Icons] تمام آیکون‌های برنامه با موفقیت به SVG تبدیل شدند.'), 1000);
})();