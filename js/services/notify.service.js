/* =========================================================
   services/notify.service.js — یادآورها و اعلان‌ها
   ========================================================= */
window.App = window.App || {};

App.NotifyService = (function () {
  const U = App.Utils;
  const J = App.Jalali;
  const Bus = App.Bus;
  const Repos = App.DataService.Repos;

  const SETTINGS_KEY = 'notifications';
  const DEFAULT_SETTINGS = {
    enabled: true,
    nativeEnabled: true,
    notifyOverdue: true,
    notifyPeriodMissing: true,
    notifyLoanSettled: true,
    notifyLoanEligible: true,
    schedulerMinutes: 15,
    lastCheckedAt: null,
    lastNotifiedAt: null
  };

  let settings = { ...DEFAULT_SETTINGS };
  let currentReminders = [];
  let checkTimer = null;

  /* ---------- تنظیمات ---------- */
  async function loadSettings() {
    try {
      const rec = await Repos.settings.get(SETTINGS_KEY);
      settings = { ...DEFAULT_SETTINGS, ...(rec?.value || {}) };
    } catch {
      settings = { ...DEFAULT_SETTINGS };
    }
    return settings;
  }

  async function saveSettings(patch) {
    settings = { ...settings, ...patch };
    await Repos.settings.put({
      key: SETTINGS_KEY,
      value: settings,
      updatedAt: Date.now()
    });
    Bus.emit('notify:settings-changed', settings);
    return settings;
  }

  const getSettings = () => ({ ...settings });

  /* ---------- مجوز مرورگر ---------- */
  const isSupported = () => typeof Notification !== 'undefined';
  const getPermission = () => isSupported() ? Notification.permission : 'unsupported';

  async function requestPermission() {
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
      const r = await Notification.requestPermission();
      return r;
    } catch { return 'denied'; }
  }

  /* ---------- محاسبه‌ی همه یادآورها ---------- */
  async function computeReminders() {
    const state = App.State.state;
    if (!state.months.length) {
      currentReminders = [];
      return [];
    }

    const reminders = [];
    const j = J.toJalali(new Date());
    const todayKey = `${J.monthNames[j.jm - 1]} ${j.jy}`;

    /* ۱) اقساط معوق */
    if (settings.notifyOverdue) {
      try {
        const overdue = await computeOverdue();
        overdue.forEach(o => reminders.push(o));
      } catch (e) { console.warn('overdue calc failed:', e); }
    }

    /* ۲) دوره‌ی جاری ثبت نشده */
    if (settings.notifyPeriodMissing) {
      const hasCurrentPeriod = state.months.some(m => m.key === todayKey);
      if (!hasCurrentPeriod && j.jd > 3) {
        reminders.push({
          kind: 'period-missing',
          severity: 'info',
          icon: '📅',
          title: 'دوره جدید ثبت نشده',
          message: `دوره «${todayKey}» هنوز ساخته نشده است.`,
          action: { label: 'افزودن دوره', route: 'period-manage' },
          key: `period-missing-${todayKey}`
        });
      }
    }

    /* ۳) وام‌های تسویه‌شده‌ی اخیر */
    if (settings.notifyLoanSettled) {
      const recentWindow = 7 * 24 * 60 * 60 * 1000;
      (state.loans || []).forEach(l => {
        if (l.status !== 'settled' || !l.updatedAt) return;
        if (Date.now() - l.updatedAt > recentWindow) return;
        reminders.push({
          kind: 'loan-settled',
          severity: 'success',
          icon: '✅',
          title: 'وام تسویه شد',
          message: `وام «${l.name || l.memberCode}» به مبلغ ${U.fmt(l.amount)} تومان تسویه شد.`,
          action: { label: 'مشاهده', route: 'loan-detail', params: { id: l.id } },
          key: `loan-settled-${l.id}`
        });
      });
    }

    /* ۴) اعضای واجد شرایط وام */
    if (settings.notifyLoanEligible) {
      try {
        const eligible = [...state.members.values()]
          .filter(m => m.status === 'active' && !m.activeLoan);
        const activeLoansCount = (state.loans || []).filter(l => l.status === 'active').length;
        if (eligible.length > 0 && activeLoansCount < 4) {
          reminders.push({
            kind: 'loan-eligible',
            severity: 'info',
            icon: '💡',
            title: 'اعضای واجد شرایط وام',
            message: `${U.toFa(eligible.length)} عضو آماده دریافت وام هستند.`,
            action: { label: 'پیش‌بینی', route: 'forecast' },
            key: 'loan-eligible'
          });
        }
      } catch {}
    }

    /* مرتب‌سازی: danger → warn → info → success */
    const order = { danger: 0, warn: 1, info: 2, success: 3 };
    reminders.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

    currentReminders = reminders;
    Bus.emit('notify:updated', { reminders: reminders.slice() });
    return reminders;
  }

  async function computeOverdue() {
    const state = App.State.state;
    const periods = state.months;
    if (!periods.length) return [];

    const loans = (state.loans || []).filter(l => l.status === 'active');
    if (!loans.length) return [];

    const order = new Map(periods.map((p, i) => [p.key, i]));
    const currentIdx = periods.length - 1;
    const items = [];

    for (const loan of loans) {
      const startIdx = order.get(loan.startPeriodKey);
      if (startIdx == null) continue;

      const paid = U.num(loan.paid);
      const installment = U.num(loan.installment);
      const member = state.members.get(loan.memberCode);
      const memberName = member?.name || loan.name || loan.memberCode;

      for (let k = 1; k <= 20; k++) {
        const dueIdx = startIdx + k;
        if (dueIdx > currentIdx) break;
        if (k <= paid) continue;

        const period = periods[dueIdx];
        if (!period) continue;
        const monthsLate = currentIdx - dueIdx;
        if (monthsLate < 1) continue;

        items.push({
          kind: 'installment-overdue',
          severity: monthsLate >= 3 ? 'danger' : 'warn',
          icon: '💳',
          title: `قسط معوق — ${memberName}`,
          message: `قسط شماره ${U.toFa(k)} دوره «${period.key}» (${U.toFa(monthsLate)} ماه تأخیر) به مبلغ ${U.fmt(installment)} تومان.`,
          action: { label: 'مشاهده وام', route: 'loan-detail', params: { id: loan.id } },
          key: `overdue-${loan.id}-${k}`,
          meta: { memberCode: loan.memberCode, loanId: loan.id, installmentNumber: k, monthsLate, amount: installment }
        });
      }
    }

    return items;
  }

  /* ---------- اعلان مرورگر ---------- */
  async function showNativeNotification(title, body, tag) {
  if (!settings.enabled || !settings.nativeEnabled) return false;
  if (!isSupported() || Notification.permission !== 'granted') return false;
  try {
    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#4338ca"/>
          <stop offset="100%" stop-color="#14b8a6"/>
        </linearGradient>
        <linearGradient id="wood" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ca8a04"/>
          <stop offset="100%" stop-color="#854d0e"/>
        </linearGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fde68a"/>
          <stop offset="100%" stop-color="#d97706"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#bg)"/>
      <path d="M 12 26 Q 12 20 20 19 L 44 19 Q 52 20 52 26 L 52 28 L 12 28 Z" fill="url(#wood)"/>
      <rect x="14" y="28" width="36" height="22" rx="1.5" fill="url(#wood)"/>
      <rect x="14" y="37" width="36" height="2.5" fill="#fbbf24"/>
      <rect x="27" y="25" width="10" height="11" rx="2" fill="url(#gold)" stroke="#78350f" stroke-width="0.8"/>
      <circle cx="32" cy="29" r="1.3" fill="#78350f"/>
      <path d="M 31 31 L 31 33 L 33 33 L 33 31 Z" fill="#78350f"/>
      <path d="M 29 25 L 29 23 Q 29 20 32 20 Q 35 20 35 23 L 35 25" fill="none" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
    const iconUri = 'data:image/svg+xml;utf8,' + encodeURIComponent(iconSvg);

    const n = new Notification(title, {
      body,
      tag: tag || 'fund-reminder',
      dir: 'rtl',
      lang: 'fa',
      icon: iconUri,
      badge: iconUri
    });
    n.onclick = () => { window.focus(); };
    return true;
  } catch (e) {
    console.warn('native notification error:', e);
    return false;
  }
}

  /* ---------- زمان‌بند ---------- */
  function startScheduler() {
    stopScheduler();
    if (!settings.enabled) return;

    const interval = Math.max(5, settings.schedulerMinutes || 15) * 60 * 1000;

    /* بررسی اولیه بعد از ۱۰ ثانیه */
    setTimeout(() => { runCheck().catch(() => {}); }, 10 * 1000);

    /* بررسی دوره‌ای */
    checkTimer = setInterval(() => { runCheck().catch(() => {}); }, interval);
  }

  function stopScheduler() {
    if (checkTimer) { clearInterval(checkTimer); checkTimer = null; }
  }

  async function runCheck() {
    if (!App.AuthService.isLoggedIn()) return;
    if (!settings.enabled) return;

    await computeReminders();
    updateBadge();

    /* اگر یادآور خطرناک داشتیم و ۶ ساعت گذشته، اعلان بفرست */
    const critical = currentReminders.filter(r => r.severity === 'danger');
    if (critical.length > 0) {
      const last = settings.lastNotifiedAt || 0;
      if (Date.now() - last > 6 * 60 * 60 * 1000) {
        const ok = await showNativeNotification(
          '⚠️ اقساط معوق',
          `${U.toFa(critical.length)} قسط معوق نیاز به پیگیری دارد.`,
          'overdue-batch'
        );
        if (ok) await saveSettings({ lastNotifiedAt: Date.now() });
      }
    }

    await saveSettings({ lastCheckedAt: Date.now() });
  }

  /* ---------- آیکون زنگ در نوار بالا ---------- */
  function mountBellIcon() {
    const actions = document.querySelector('.topbar .actions');
    if (!actions || document.getElementById('btnBell')) return;

    const btn = document.createElement('button');
    btn.id = 'btnBell';
    btn.className = 'btn ghost bell-btn';
    btn.title = 'یادآورها';
    btn.innerHTML = '<span class="bell-icon">🔔</span><span class="bell-badge" id="bellBadge"></span>';
    btn.onclick = () => App.Boot.switchTab('reminders');

    /* قبل از دکمه‌ی تم، یا در ابتدای actions */
    actions.insertBefore(btn, actions.firstChild);
    updateBadge();
  }

  function unmountBellIcon() {
    document.getElementById('btnBell')?.remove();
  }

  function updateBadge() {
    const badge = document.getElementById('bellBadge');
    if (!badge) return;
    const n = getBadgeCount();
    if (n === 0) {
      badge.style.display = 'none';
      return;
    }
    badge.style.display = '';
    badge.textContent = U.toFa(n);
    badge.classList.toggle('is-danger',
      currentReminders.some(r => r.severity === 'danger'));
  }

  function getCurrent() { return currentReminders.slice(); }

  function getBadgeCount() {
    return currentReminders.filter(r =>
      r.severity === 'danger' || r.severity === 'warn').length;
  }

  function countBySeverity() {
    return {
      danger: currentReminders.filter(r => r.severity === 'danger').length,
      warn:   currentReminders.filter(r => r.severity === 'warn').length,
      info:   currentReminders.filter(r => r.severity === 'info').length,
      success:currentReminders.filter(r => r.severity === 'success').length,
      total:  currentReminders.length
    };
  }

  return {
    DEFAULT_SETTINGS,
    loadSettings, saveSettings, getSettings,
    isSupported, getPermission, requestPermission,
    computeReminders,
    showNativeNotification,
    startScheduler, stopScheduler, runCheck,
    mountBellIcon, unmountBellIcon, updateBadge,
    getCurrent, getBadgeCount, countBySeverity
  };
})();