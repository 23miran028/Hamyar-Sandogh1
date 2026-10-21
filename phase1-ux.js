/* =========================================================
   phase1-ux.js — ارتقای تجربه کاربری (میانبر، اسکلتون، اعتبارسنجی)
   ========================================================= */
(function() {
  if (window._phase1UXApplied) return;
  window._phase1UXApplied = true;

  console.log('✨ [Phase 1] در حال اعمال ارتقاهای UX...');

  // ═══════════════════════════════════════════════════════════
  // ۱. تزریق استایل‌های مورد نیاز (اسکلتون و اعتبارسنجی)
  // ═══════════════════════════════════════════════════════════
  const style = document.createElement('style');
  style.innerHTML = `
    /* انیمیشن لودینگ اسکلتی (Skeleton) */
    @keyframes skeleton-pulse {
      0% { background-color: var(--line-soft); opacity: 0.6; }
      50% { background-color: var(--line); opacity: 1; }
      100% { background-color: var(--line-soft); opacity: 0.6; }
    }
    .skeleton-box {
      animation: skeleton-pulse 1.5s infinite ease-in-out;
      border-radius: var(--radius-sm);
      height: 1em;
      display: inline-block;
      width: 100%;
    }
    .skeleton-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: 20px;
      margin-bottom: 20px;
    }

    /* اعتبارسنجی زنده فرم‌ها */
    .field input.is-valid, .field select.is-valid { border-color: var(--ok-500) !important; }
    .field input.is-invalid, .field select.is-invalid { border-color: var(--danger-500) !important; }
    
    .kbd-shortcut {
      background: var(--bg-soft);
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 10px;
      color: var(--muted);
      margin-right: 8px;
      font-family: monospace;
    }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════════════════
  // ۲. میانبرهای صفحه‌کلید (Keyboard Shortcuts)
  // ═══════════════════════════════════════════════════════════
  document.addEventListener('keydown', (e) => {
    // Ctrl+K یا Cmd+K → جستجوی سراسری
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('globalSearch');
      if (searchInput) searchInput.focus();
    }

    // Ctrl+S یا Cmd+S → ذخیره فرم فعال
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      const activeForm = document.querySelector('form:not([style*="display: none"])');
      if (activeForm) {
        const submitBtn = activeForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      }
    }
    
    // Esc → بستن مودال
    if (e.key === 'Escape') {
      if (App.UI && App.UI.closeModal) App.UI.closeModal();
      const dropdown = document.getElementById('userDropdown');
      if (dropdown) dropdown.classList.remove('open');
    }
  });

  // اضافه کردن نشانه‌ی میانبر (Ctrl+K) به جستجو
  setTimeout(() => {
    const searchWrap = document.querySelector('.global-search');
    if (searchWrap && !searchWrap.querySelector('.kbd-shortcut')) {
      const kbd = document.createElement('span');
      kbd.className = 'kbd-shortcut';
      kbd.textContent = 'Ctrl+K';
      kbd.style.position = 'absolute';
      kbd.style.left = '12px';
      kbd.style.top = '50%';
      kbd.style.transform = 'translateY(-50%)';
      kbd.style.pointerEvents = 'none';
      searchWrap.appendChild(kbd);
    }
  }, 1000);

  // ═══════════════════════════════════════════════════════════
  // ۳. تبدیل خودکار اعداد فارسی/عربی به انگلیسی در همه فرم‌ها
  // ═══════════════════════════════════════════════════════════
  const toEnDigits = (str) => {
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
              .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  };

  document.body.addEventListener('input', (e) => {
    const target = e.target;
    if (target.matches('input[type="text"], input[type="number"], input[type="tel"]')) {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const originalVal = target.value;
      const convertedVal = toEnDigits(originalVal);
      
      // اگر تغییری کرد، مقدار را جایگزین کن و مکان کرسر را حفظ کن
      if (originalVal !== convertedVal) {
        target.value = convertedVal;
        target.setSelectionRange(start, end);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  // ۴. اعتبارسنجی زنده فرم‌ها (Live Validation)
  // ═══════════════════════════════════════════════════════════
  document.body.addEventListener('input', (e) => {
    const input = e.target;
    if (!input.matches('input[required], select[required]')) return;

    if (input.value.trim() === '') {
      input.classList.remove('is-valid', 'is-invalid');
      return;
    }

    if (input.checkValidity()) {
      input.classList.remove('is-invalid');
      input.classList.add('is-valid');
    } else {
      input.classList.remove('is-valid');
      input.classList.add('is-invalid');
    }
  });

  // ═══════════════════════════════════════════════════════════
  // ۵. لودینگ اسکلتی (Skeleton Loading) به جای متن‌های انتظار
  // ═══════════════════════════════════════════════════════════
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // پیدا کردن متن‌های لودینگ
          const empties = node.querySelectorAll ? node.querySelectorAll('.empty') : [];
          empties.forEach(el => {
            if (el.textContent.includes('در حال بارگذاری') || el.textContent.includes('در حال پردازش') || el.textContent.includes('در حال محاسبه')) {
              el.innerHTML = `
                <div class="skeleton-card" style="width:100%;max-width:600px;margin:0 auto">
                  <div class="skeleton-box" style="width:40%;margin-bottom:12px"></div>
                  <div class="skeleton-box" style="width:100%;height:80px;margin-bottom:12px"></div>
                  <div class="skeleton-box" style="width:100%;height:40px"></div>
                </div>
              `;
            }
          });
        }
      });
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }));
  } else {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  console.log('✅ [Phase 1] ارتقاهای UX با موفقیت اعمال شد.');
})();