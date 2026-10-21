/* =========================================================
   phase2-features.js — پورتال اعضا و چاپ رسید (فاز ۲)
   ========================================================= */
(function() {
  if (window._phase2FeaturesApplied) return;
  window._phase2FeaturesApplied = true;

  console.log('🚀 [Phase 2] در حال فعال‌سازی پورتال اعضا و رسیدهای چاپی...');

  const U = App.Utils;
  const Auth = App.AuthService;

  // ═══════════════════════════════════════════════════════════
  // ۱. استایل‌های مربوط به پورتال و رسید
  // ═══════════════════════════════════════════════════════════
  const style = document.createElement('style');
  style.innerHTML = `
    /* استایل‌های پورتال عضو */
    .member-portal-header {
      background: linear-gradient(135deg, var(--brand-500), var(--accent-500));
      color: #fff; padding: 30px; border-radius: var(--radius-xl);
      margin-bottom: 20px; box-shadow: var(--shadow-md);
    }
    .member-portal-header h1 { margin: 0 0 8px; font-size: 24px; }
    .member-portal-header p { margin: 0; opacity: 0.9; font-size: 14px; }
    
    /* استایل رسید چاپی */
    .receipt-modal-body { background: #f8fafc; padding: 20px; border-radius: var(--radius); color: #000; }
    .receipt-box {
      background: #fff; border: 1px solid #cbd5e1; border-radius: 8px;
      padding: 30px; max-width: 600px; margin: 0 auto; font-family: 'Vazirmatn', Tahoma, sans-serif;
    }
    .receipt-header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 20px; }
    .receipt-header h2 { margin: 0 0 10px; color: #0f172a; }
    .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .receipt-row span:first-child { color: #64748b; }
    .receipt-row span:last-child { font-weight: bold; color: #0f172a; }
    .receipt-footer { text-align: center; margin-top: 30px; font-size: 12px; color: #64748b; }
    .receipt-signature { display: flex; justify-content: space-between; margin-top: 40px; }
    .receipt-signature div { border-top: 1px dashed #94a3b8; width: 40%; text-align: center; padding-top: 10px; color: #475569; }
    
    @media print {
      body * { visibility: hidden; }
      .receipt-box, .receipt-box * { visibility: visible; }
      .receipt-box { position: absolute; left: 0; top: 0; width: 100%; border: none; }
    }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════════════════
  // ۲. تغییر سایدبار برای کاربران با نقش «عضو»
  // ═══════════════════════════════════════════════════════════
  const origRenderTabs = App.UI.renderTabs;
  App.UI.renderTabs = function(state, onTab) {
    const user = Auth.getCurrentUser();
    if (user && user.role === 'member') {
      const inner = document.getElementById('sidebarInner');
      if (inner) {
        inner.innerHTML = `
          <div class="sidebar-group">
            <div class="sidebar-group-title">پورتال شخصی</div>
            <button class="sidebar-item active" data-tab="member-portal">
              <span class="si-icon">👤</span>
              <span class="si-label">کارنامه من</span>
            </button>
          </div>`;
        inner.querySelectorAll('.sidebar-item').forEach(b => {
          b.onclick = () => {
            onTab('member-portal');
            if (window.innerWidth <= 900) {
              document.getElementById('sidebar')?.classList.remove('open');
              document.getElementById('sidebarBackdrop')?.classList.remove('open');
            }
          };
        });
      }
      return; // جلوگیری از رندر منوی مدیر
    }
    return origRenderTabs.call(this, state, onTab);
  };

  // ═══════════════════════════════════════════════════════════
  // ۳. هدایت خودکار کاربر «عضو» به پورتال خودش
  // ═══════════════════════════════════════════════════════════
  const origRender = App.Boot.render;
  App.Boot.render = function() {
    const user = Auth.getCurrentUser();
    if (user && user.role === 'member' && App.State.state && !App.State.isEmpty()) {
      const state = App.State.state;
      if (state.tab !== 'member-portal') {
        state.tab = 'member-portal';
        App.UI.renderTabs(state, App.Boot.switchTab);
      }
      const view = document.getElementById('view');
      view.innerHTML = '';
      App.Views.memberPortal(view, state);
      return;
    }
    return origRender.call(this);
  };

  // ═══════════════════════════════════════════════════════════
  // ۴. طراحی صفحه پورتال عضو (Member Portal)
  // ═══════════════════════════════════════════════════════════
  App.Views.memberPortal = function(root, state) {
    const user = Auth.getCurrentUser();
    const member = state.members.get(user.memberCode);

    if (!member) {
      root.innerHTML = `<div class="card"><div class="empty" style="color:var(--danger-500)">
        ⛔ حساب کاربری شما به هیچ عضوی در صندوق متصل نیست.<br>
        لطفاً با مدیر سیستم تماس بگیرید تا کد عضویت شما را در تنظیمات کاربران ثبت کند.
      </div></div>`;
      return;
    }

    const lastSnap = member.last || {};
    const activeLoan = member.activeLoan;
    const loans = (member.loans || []).slice().reverse();

    root.innerHTML = `
      <div class="member-portal-header">
        <h1>سلام ${U.esc(member.name)} 👋</h1>
        <p>به پورتال اختصاصی خود خوش آمدید. در اینجا می‌توانید وضعیت مالی و اقساط خود را مشاهده کنید.</p>
      </div>

      <div class="grid kpis">
        <div class="kpi">
          <div class="lbl">سرمایه کل شما</div>
          <div class="val">${U.fmt(lastSnap.totalCap || 0)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="kpi g">
          <div class="lbl">جمع واریزی‌ها</div>
          <div class="val">${U.fmt(member.totalDeposit || 0)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="kpi o">
          <div class="lbl">جمع اقساط پرداخت‌شده</div>
          <div class="val">${U.fmt(member.totalPaid || 0)}</div>
          <div class="sub">تومان</div>
        </div>
        <div class="kpi r">
          <div class="lbl">باقیمانده وام جاری</div>
          <div class="val">${activeLoan ? U.fmt(activeLoan.remaining) : '—'}</div>
          <div class="sub">${activeLoan ? `${U.toFa(activeLoan.paid || 0)} از ۲۰ قسط` : 'بدون وام'}</div>
        </div>
      </div>

      <div class="card">
        <h3><span class="dot"></span> سابقه وام‌ها</h3>
        ${loans.length ? `
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr>
                <th>شروع وام</th><th>مبلغ</th><th>قسط ماهانه</th>
                <th>پرداخت‌شده</th><th>باقیمانده</th><th>وضعیت</th>
              </tr></thead>
              <tbody>
                ${loans.map(l => `<tr>
                  <td>${U.esc(l.startPeriodKey)}</td>
                  <td class="num">${U.fmt(l.amount)}</td>
                  <td class="num">${U.fmt(l.installment)}</td>
                  <td class="num">${U.toFa(l.paid || 0)} از ۲۰</td>
                  <td class="num">${U.fmt(l.remaining)}</td>
                  <td>${l.status === 'active' ? '<span class="badge warn">جاری</span>' : '<span class="badge ok">تسویه‌شده</span>'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty">هیچ وامی ثبت نشده است.</div>'}
      </div>

      <div class="card">
        <h3><span class="dot" style="background:var(--warn-500)"></span> کارنامه ماه‌به‌ماه</h3>
        <div class="tbl-wrap" style="max-height:400px">
          <table class="tbl">
            <thead><tr>
              <th>دوره</th><th>واریز</th><th>قسط</th><th>پرداخت‌شده</th><th>باقیمانده</th><th>سرمایه کل</th>
            </tr></thead>
            <tbody>
              ${(member.history || []).slice().reverse().map(h => `<tr>
                <td>${U.esc(h.monthKey)}</td>
                <td class="num">${U.fmt(h.deposit)}</td>
                <td class="num">${h.installment ? U.fmt(h.installment) : '—'}</td>
                <td class="num">${h.paidCount != null ? U.toFa(h.paidCount) : '—'}</td>
                <td class="num">${U.fmt(h.remaining)}</td>
                <td class="num"><b>${U.fmt(h.totalCap)}</b></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // ═══════════════════════════════════════════════════════════
  // ۵. اضافه کردن دکمه چاپ رسید به صفحه جزئیات وام
  // ═══════════════════════════════════════════════════════════
  const origLoanDetail = App.Views.loanDetail;
  App.Views.loanDetail = function(root, state, opts) {
    origLoanDetail.call(this, root, state, opts);
    
    // بعد از اینکه صفحه رندر شد، دکمه را اضافه می‌کنیم
    setTimeout(() => {
      const btnMember = root.querySelector('#memberBtn');
      if (!btnMember || root.querySelector('#btnPrintReceipt')) return;

      const printBtn = document.createElement('button');
      printBtn.id = 'btnPrintReceipt';
      printBtn.className = 'btn plain';
      printBtn.innerHTML = '🧾 چاپ رسید پرداخت';
      printBtn.style.marginRight = '8px';
      
      printBtn.onclick = () => {
        // دریافت اطلاعات وام از دیتابیس
        App.LoanService.get(opts.id).then(loan => {
          if (!loan) return;
          showReceiptModal(loan);
        });
      };
      
      // قرار دادن دکمه در نوار بالا
      btnMember.parentNode.insertBefore(printBtn, btnMember);
    }, 150);
  };

  // تابع نمایش و چاپ رسید
  function showReceiptModal(loan) {
    const member = App.State.state.members.get(loan.memberCode);
    const dateStr = App.Jalali.format(new Date());
    
    // محاسبه مبلغ پرداخت‌شده
    const paidAmount = (loan.paid || 0) * loan.installment;
    
    const html = `
      <div class="receipt-modal-body">
        <div class="receipt-box" id="printableReceipt">
          <div class="receipt-header">
            <h2>صندوق قرض‌الحسنه</h2>
            <p style="margin:0; color:#64748b">رسید پرداخت اقساط</p>
          </div>
          
          <div class="receipt-row">
            <span>شماره رسید:</span>
            <span>${Date.now().toString().slice(-6)}</span>
          </div>
          <div class="receipt-row">
            <span>تاریخ صدور:</span>
            <span>${dateStr}</span>
          </div>
          <div class="receipt-row">
            <span>نام عضو:</span>
            <span>${U.esc(member?.name || loan.name)}</span>
          </div>
          <div class="receipt-row">
            <span>کد عضویت:</span>
            <span>${U.esc(loan.memberCode)}</span>
          </div>
          
          <div style="margin: 20px 0; padding: 15px; background: #f1f5f9; border-radius: 8px;">
            <div class="receipt-row">
              <span>مبلغ کل وام:</span>
              <span>${U.fmt(loan.amount)} تومان</span>
            </div>
            <div class="receipt-row">
              <span>تعداد اقساط پرداخت‌شده:</span>
              <span>${U.toFa(loan.paid || 0)} از ۲۰ قسط</span>
            </div>
            <div class="receipt-row">
              <span>مبلغ کل پرداخت‌شده تاکنون:</span>
              <span style="color:#15803d; font-size:16px">${U.fmt(paidAmount)} تومان</span>
            </div>
            <div class="receipt-row" style="border-bottom:none">
              <span>مانده بدهی:</span>
              <span style="color:#dc2626">${U.fmt(loan.remaining)} تومان</span>
            </div>
          </div>
          
          <div class="receipt-footer">
            این رسید به صورت خودکار توسط سامانه صندوق صادر شده است و فاقد مهر دستی می‌باشد.
          </div>
          
          <div class="receipt-signature">
            <div>امضای خزانه‌دار</div>
            <div>امضای عضو</div>
          </div>
        </div>
        
        <div style="display:flex; gap:10px; justify-content:center; margin-top:20px">
          <button class="btn plain" onclick="App.UI.closeModal()">انصراف</button>
          <button class="btn solid" onclick="window.print()">🖨️ چاپ رسید</button>
        </div>
      </div>
    `;
    
    App.UI.openModal(html);
  }

  console.log('✅ [Phase 2] پورتال اعضا و سیستم چاپ رسید فعال شد.');
})();