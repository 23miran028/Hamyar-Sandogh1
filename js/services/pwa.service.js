/* =========================================================
   services/pwa.service.js — مدیریت PWA
   ========================================================= */
window.App = window.App || {};

App.PWAService = (function () {
  const Bus = App.Bus;

  let deferredPrompt = null;
  let swRegistration = null;
  let updateReady = false;
  let isInstalled = false;
  let isOffline = !navigator.onLine;

  /* ---------- تشخیص قابلیت‌ها ---------- */
  const isSupported = () => 'serviceWorker' in navigator;
  const isSecureContext_ = () =>
    window.isSecureContext || location.protocol === 'https:' ||
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  const isFileProtocol = () => location.protocol === 'file:';

  function getStatus() {
    return {
      supported: isSupported(),
      secure: isSecureContext_(),
      fileProtocol: isFileProtocol(),
      installed: isInstalled,
      offline: isOffline,
      updateReady,
      canInstall: !!deferredPrompt,
      registration: !!swRegistration
    };
  }

  /* ---------- ثبت Service Worker ---------- */
  async function register() {
    if (!isSupported()) {
      console.warn('[PWA] Service Worker پشتیبانی نمی‌شود');
      return null;
    }
    if (!isSecureContext_()) {
      console.warn('[PWA] context امن نیست (نیاز به HTTPS یا localhost)');
      return null;
    }

    try {
      const reg = await navigator.serviceWorker.register('./sw.js', {
        scope: './'
      });
      swRegistration = reg;
      console.log('[PWA] Service Worker ثبت شد:', reg.scope);

      /* بررسی به‌روزرسانی */
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            updateReady = true;
            Bus.emit('pwa:update-ready');
            showUpdateToast();
          }
        });
      });

      /* بررسی دوره‌ای به‌روزرسانی */
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);

      return reg;
    } catch (e) {
      console.error('[PWA] خطا در ثبت:', e);
      return null;
    }
  }

  /* ---------- اعمال به‌روزرسانی ---------- */
  function applyUpdate() {
    if (!swRegistration?.waiting) return;
    swRegistration.waiting.postMessage('SKIP_WAITING');
    window.location.reload();
  }

  function showUpdateToast() {
    if (App.UI?.toast) {
      App.UI.toast.info('🔄 نسخه جدید آماده است. برای به‌روزرسانی کلیک کنید.', {
        duration: 0,
        kind: 'info'
      });
    }
  }

  /* ---------- رویداد نصب (beforeinstallprompt) ---------- */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    Bus.emit('pwa:installable');
  });

  window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferredPrompt = null;
    Bus.emit('pwa:installed');
    if (App.UI?.toast) App.UI.toast.success('✅ برنامه با موفقیت نصب شد');
  });

  /* ---------- تشخیص نصب‌بودن ---------- */
  const mq = window.matchMedia('(display-mode: standalone)');
  isInstalled = mq.matches || window.navigator.standalone === true;
  mq.addEventListener('change', (e) => {
    isInstalled = e.matches;
    Bus.emit('pwa:mode-changed', { installed: isInstalled });
  });

  /* ---------- آنلاین/آفلاین ---------- */
  window.addEventListener('online', () => {
    isOffline = false;
    Bus.emit('pwa:online');
    if (App.UI?.toast) App.UI.toast.success('🌐 اتصال برقرار شد');
  });

  window.addEventListener('offline', () => {
    isOffline = true;
    Bus.emit('pwa:offline');
    if (App.UI?.toast) App.UI.toast.warn('📵 حالت آفلاین — برنامه بدون تغییر کار می‌کند');
  });

  /* ---------- نصب ---------- */
  async function promptInstall() {
    if (!deferredPrompt) return { outcome: 'unavailable' };
    try {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        deferredPrompt = null;
      }
      return result;
    } catch (e) {
      return { outcome: 'error', error: e.message };
    }
  }

  /* ---------- بنر نصب ---------- */
  function mountInstallBanner() {
    if (isInstalled) return;
    if (!deferredPrompt) return;
    if (document.getElementById('pwaInstallBanner')) return;
    if (localStorage.getItem('pwa-banner-dismissed') === '1') return;

    const banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.className = 'pwa-banner';
    banner.innerHTML = `
      <div class="pwa-banner-icon">📱</div>
      <div class="pwa-banner-body">
        <b>نصب روی دستگاه</b>
        <div>برنامه را مثل یک اپ نصب کنید و آفلاین استفاده کنید.</div>
      </div>
      <div class="pwa-banner-actions">
        <button class="btn plain sm" id="pwaDismiss">بعداً</button>
        <button class="btn solid sm" id="pwaInstall">نصب</button>
      </div>
    `;
    document.body.appendChild(banner);

    banner.querySelector('#pwaInstall').onclick = async () => {
      const r = await promptInstall();
      if (r.outcome === 'accepted') {
        banner.remove();
      }
    };
    banner.querySelector('#pwaDismiss').onclick = () => {
      localStorage.setItem('pwa-banner-dismissed', '1');
      banner.remove();
    };
  }

  /* ---------- راه‌اندازی کامل ---------- */
  async function init() {
    const status = getStatus();
    console.log('[PWA] وضعیت:', status);

    if (isFileProtocol()) {
      console.warn(
        '%c[PWA] برنامه از طریق file:// باز شده است. ' +
        'برای فعال‌سازی کامل PWA، از http://localhost استفاده کن.',
        'color:#d97706;font-weight:bold'
      );
    }

    await register();

    Bus.on('pwa:installable', () => mountInstallBanner());
    if (deferredPrompt) mountInstallBanner();

    return status;
  }

  return {
    init,
    getStatus,
    isSupported,
    isSecureContext: isSecureContext_,
    isFileProtocol,
    promptInstall,
    applyUpdate,
    mountInstallBanner,
    isInstalled: () => isInstalled,
    isOffline: () => isOffline,
    isUpdateReady: () => updateReady
  };
})();