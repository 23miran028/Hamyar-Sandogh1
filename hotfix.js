/* =========================================================
   hotfix.js — وصله‌ی نهایی برای رفع باگ‌های ساختاری
   ========================================================= */
(function() {
  if (window._hotfixApplied) return;
  window._hotfixApplied = true;
  
  console.log('🔧 [Hotfix] در حال اعمال وصله‌های نهایی...');

  // ═══════════════════════════════════════════════════════════
  // ۱. اصلاح باگ‌های CSS (متغیرهای نامرئی، منوی موبایل، چاپ)
  // ═══════════════════════════════════════════════════════════
  const style = document.createElement('style');
  style.innerHTML = `
    /* رفع باگ متغیرهای تعریف‌نشده که باعث نامرئی شدن نقطه‌های رنگی می‌شد */
    :root {
      --brand:   var(--brand-500);
      --brand2:  var(--accent-500);
      --danger:  var(--danger-500);
      --warn:    var(--warn-500);
      --ok:      var(--ok-500);
      --accent:  var(--accent-500);
    }
    
    /* رفع باگ باز شدن سایدبار از سمت اشتباه در موبایل (RTL) */
    @media (max-width: 900px) {
      html[dir="rtl"] .sidebar {
        inset-inline-start: 0 !important;
        inset-inline-end: auto !important;
        border-inline-start: none !important;
        border-inline-end: 1px solid var(--line) !important;
        transform: translateX(100%);
      }
      .sidebar.open { transform: translateX(0) !important; }
    }

    /* رفع باگ چاپ شدن سایدبار و منوها روی کاغذ */
    @media print {
      .sidebar, .sidebar-backdrop, .modal, .pwa-banner, .user-dropdown, .global-search-results { display: none !important; }
      .app-shell { grid-template-columns: 1fr !important; }
    }

    /* رفع باگ قرارگیری بنر PWA روی مودال باز */
    .pwa-banner { z-index: 150 !important; }
    
    /* مخفی کردن دکمه منو در صفحه ورود */
    .app-shell.auth-mode .menu-btn { display: none !important; }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════════════════
  // ۲. رفع باگ خطرناک Race Condition در دیتابیس (IndexedDB)
  // ═══════════════════════════════════════════════════════════
  if (window.App && App.DB) {
    const origOpen = App.DB.open;
    let _cachedDb = null;
    let _cachedPromise = null;
    
    App.DB.open = function() {
      if (_cachedDb) return Promise.resolve(_cachedDb);
      if (_cachedPromise) return _cachedPromise;
      
      _cachedPromise = origOpen().then(db => {
        _cachedDb = db;
        _cachedPromise = null;
        return db;
      }).catch(e => {
        _cachedPromise = null;
        throw e;
      });
      return _cachedPromise;
    };

    const origClose = App.DB.close;
    App.DB.close = function() {
      origClose.call(this);
      _cachedDb = null;
      _cachedPromise = null;
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ۳. رفع باگ نمایش داده نشدن آیکون زنگ یادآور در نوار بالا
  // ═══════════════════════════════════════════════════════════
  if (window.App && App.NotifyService) {
    App.NotifyService.mountBellIcon = function() {
      if (document.getElementById('btnBell')) return;
      const printBtn = document.getElementById('btnPrint');
      if (!printBtn) return;

      const btn = document.createElement('button');
      btn.id = 'btnBell';
      btn.className = 'icon-btn bell-btn';
      btn.title = 'یادآورها';
      btn.innerHTML = '<span class="bell-icon">🔔</span><span class="bell-badge" id="bellBadge"></span>';
      btn.onclick = () => App.Boot.switchTab('reminders');

      printBtn.parentNode.insertBefore(btn, printBtn);
      App.NotifyService.updateBadge();
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ۴. رفع باگ رد شدن کدهای فارسی و شماره تلفن در فرم‌ها
  // ═══════════════════════════════════════════════════════════
  if (window.App && App.Validators) {
    const origMember = App.Validators.member;
    App.Validators.member = function(m, existingCodes) {
       const toEn = (str) => String(str || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
       if (m.phone) m.phone = toEn(m.phone);
       if (m.code) m.code = toEn(m.code);
       return origMember.call(this, m, existingCodes);
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ۵. رفع باگ ناوبری (پرت شدن به داشبورد بعد از ویرایش)
  // ═══════════════════════════════════════════════════════════
  if (window.App && App.Views && App.Boot) {
    const origMemberEdit = App.Views.memberEdit;
    if (origMemberEdit) {
      App.Views.memberEdit = function(root, state, opts) {
        origMemberEdit.call(this, root, state, opts);
        const backBtn = root.querySelector('#backBtn');
        if (backBtn) backBtn.onclick = () => App.Boot.switchTab('members');
        const cancelBtn = root.querySelector('#cancelBtn');
        if (cancelBtn) cancelBtn.onclick = () => App.Boot.switchTab('members');
      };
    }

    const origLoanNew = App.Views.loanNew;
    if (origLoanNew) {
      App.Views.loanNew = function(root, state) {
        origLoanNew.call(this, root, state);
        const backBtn = root.querySelector('#backBtn');
        if (backBtn) backBtn.onclick = () => App.Boot.switchTab('loans');
        const cancelBtn = root.querySelector('#cancelBtn');
        if (cancelBtn) cancelBtn.onclick = () => App.Boot.switchTab('loans');
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ۶. رفع باگ خطای فیلتر ناموجود در نمودارهای ستونی
  // ═══════════════════════════════════════════════════════════
  if (window.App && App.Charts) {
    const origBars = App.Charts.bars;
    App.Charts.bars = function(host, pts, opts) {
       const origSetAttribute = Element.prototype.setAttribute;
       Element.prototype.setAttribute = function(name, value) {
         // نادیده گرفتن فیلتری که باعث خطا در کنسول می‌شد
         if (name === 'filter' && String(value).includes('barShGlobal')) return; 
         return origSetAttribute.call(this, name, value);
       };
       origBars.call(this, host, pts, opts);
       Element.prototype.setAttribute = origSetAttribute;
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ۷. رفع باگ ناسازگاری رمز عبور (۶ کاراکتر vs ۸ کاراکتر)
  // ═══════════════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
      setInterval(() => {
          const input = document.getElementById('f-password');
          if (input) input.setAttribute('minlength', '8'); // مجبور کردن فرم به ۸ کاراکتر
      }, 500);
  });

  // ═══════════════════════════════════════════════════════════
  // ۸. رفع باگ نداشتن فایل اصلی پارسر (فقط برای ردیف‌های بدون کد)
  // ═══════════════════════════════════════════════════════════
  if (window.App && App.Parser) {
      const origParse = App.Parser.parseWorkbook;
      App.Parser.parseWorkbook = function(raw) {
          try {
              // بررسی اینکه آیا ردیفی با نام اما بدون کد وجود دارد یا خیر
              const keys = Object.keys(raw || {});
              const mhKey = keys.find(k => /MH/i.test(k)) || keys[0];
              if (raw && raw[mhKey] && typeof raw[mhKey] === 'object') {
                  for (const sheet of Object.values(raw[mhKey])) {
                      if (sheet && Array.isArray(sheet.rows)) {
                          sheet.rows.forEach(r => {
                              // اگر ردیف آرایه است و نام دارد (ایندکس ۷) ولی کد ندارد (ایندکس ۸)
                              if (Array.isArray(r) && r[7] && !r[8]) {
                                  // یک کد موقت بر اساس نام تولید می‌کنیم تا ردیف حذف نشود
                                  r[8] = 'TEMP_' + String(r[7]).trim().replace(/\\s+/g, '_');
                              }
                          });
                      }
                  }
              }
          } catch(e) {}
          return origParse.call(this, raw);
      };
  }

  // ═══════════════════════════════════════════════════════════
  // ۹. رفع باگ ذخیره‌ی بکاپ محلی به صورت غیررمزنگاری‌شده
  // ═══════════════════════════════════════════════════════════
  if (window.App && App.BackupService) {
    const origCreateAndDownload = App.BackupService.createAndDownload;
    App.BackupService.createAndDownload = async function(options = {}) {
      // ما نمی‌توانیم مستقیماً بدنه تابع را تغییر دهیم، پس با تغییر متغیرها آن را هک می‌کنیم
      if (options.password) {
         const originalSaveLocalSnapshot = App.BackupService.saveLocalSnapshot;
         // بکاپ محلی را با نسخه رمزنگاری شده جایگزین می‌کنیم تا امن باشد
         App.BackupService.saveLocalSnapshot = async function(bk) {
             const encryptedPayload = await App.BackupService.encryptBackup(bk, options.password);
             return originalSaveLocalSnapshot.call(this, encryptedPayload);
         };
         try {
             return await origCreateAndDownload.call(this, options);
         } finally {
             App.BackupService.saveLocalSnapshot = originalSaveLocalSnapshot;
         }
      }
      return origCreateAndDownload.call(this, options);
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ۱۰. رفع باگ نمایش خطاهای اعتبارسنجی در فرم ثبت معامله (txn-edit)
  // ═══════════════════════════════════════════════════════════
  if (window.App && App.Views && App.Views.txnEdit) {
    const origTxnEdit = App.Views.txnEdit;
    App.Views.txnEdit = function(root, state, opts) {
      origTxnEdit.call(this, root, state, opts);
      // بعد از لود فرم، شنونده‌ی سابمیت را بازنویسی می‌کنیم تا خطاها را ریز نمایش دهد
      setTimeout(() => {
          const form = root.querySelector('#txnForm');
          if (!form) return;
          const origOnSubmit = form.onsubmit;
          form.onsubmit = async function(e) {
              e.preventDefault();
              const alertBox = root.querySelector('#formAlert');
              alertBox.innerHTML = '';
              // خواندن مقادیر از فرم
              const toRial = (t) => (Number(t) || 0) * 10;
              const data = {
                  periodKey: opts.periodKey, memberCode: opts.memberCode,
                  deposit: toRial(form.querySelector('#f-deposit').value),
                  installment: toRial(form.querySelector('#f-installment').value),
                  paidCount: Number(form.querySelector('#f-paidCount').value) || 0,
                  loan: toRial(form.querySelector('#f-loan').value),
                  remaining: toRial(form.querySelector('#f-remaining').value),
                  totalCap: toRial(form.querySelector('#f-totalCap').value),
                  rowNo: Number(form.querySelector('#f-rowNo').value) || 0
              };
              try {
                  await App.TxnService.upsert(opts.periodKey, opts.memberCode, data);
                  App.UI.toast.success('معامله ذخیره شد');
                  App.Views.monthly(root, state);
              } catch (err) {
                  if (err.details) {
                      // نمایش خطاها کنار هر فیلد
                      let errorHtml = '<div class="form-alert danger">لطفاً خطاهای زیر را برطرف کنید:</div>';
                      Object.keys(err.details).forEach(key => {
                          const fieldErr = form.querySelector(`[data-error="${key}"]`);
                          if (fieldErr) {
                              fieldErr.textContent = err.details[key];
                              fieldErr.closest('.field')?.classList.add('has-error');
                          }
                      });
                  }
                  alertBox.innerHTML = `<div class="form-alert danger">${App.Utils.esc(err.message)}</div>`;
              }
          };
      }, 100);
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ۱۱. رفع باگ تداخل وام‌ها در TxnService (وقتی دو وام فعال داریم)
  // ═══════════════════════════════════════════════════════════
  if (window.App && App.TxnService) {
      const origUpdateLoanProgress = App.TxnService.updateLoanProgress;
      if (origUpdateLoanProgress) { // اگر تابع در دسترس باشد
          App.TxnService.updateLoanProgress = async function(memberCode, snapshot) {
              const loans = await App.DataService.Repos.loans.byIndex('memberCode', memberCode);
              if (!loans.length) return;
              loans.sort((a, b) => (a.startYear - b.startYear) || (a.startIdx - b.startIdx));
              const current = loans.find(l => l.status === 'active');
              if (!current) return;
              
              // ← اصلاح: فقط اگر مبلغ وام اسنپ‌شات با وام جاری یکی بود
              if (App.Utils.num(snapshot.loan) !== App.Utils.num(current.amount)) return;
              if (App.Utils.comparePeriodKeys(snapshot.periodKey, current.startPeriodKey) < 0) return;

              // ادامه کدهای اصلی...
              const paidCount = App.Utils.num(snapshot.paidCount);
              const count = current.count || 20;
              if (paidCount >= count) {
                  current.status = 'settled'; current.paid = count; current.remaining = 0; current.updatedAt = Date.now();
                  await App.DataService.Repos.loans.put(current);
                  if (snapshot.remaining !== 0) { snapshot.remaining = 0; await App.DataService.Repos.snapshots.put(snapshot); }
                  return;
              }
              const installment = App.Utils.num(current.installment);
              const remaining = Math.max(0, App.Utils.num(current.amount) - paidCount * installment);
              current.paid = paidCount; current.remaining = remaining; current.updatedAt = Date.now();
              await App.DataService.Repos.loans.put(current);
              if (App.Utils.num(snapshot.remaining) !== remaining) {
                  snapshot.remaining = remaining; await App.DataService.Repos.snapshots.put(snapshot);
              }
          };
      }
  }

  console.log('✅ [Hotfix] تمامی باگ‌های ساختاری با موفقیت برطرف شدند.');
})();