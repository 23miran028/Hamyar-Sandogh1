const CACHE_VERSION = 'qarz-fund-v4-2026-10';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_RUNTIME = `${CACHE_VERSION}-runtime`;

const STATIC_ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css', './css/print.css',
  './assets/icons/favicon.svg', './assets/icons/apple-touch-icon.png', // اصلاح
  // ✅ کدهای جدید را جایگزین کنید
'./assets/icons/favicon.png',
'./assets/icons/apple-touch-icon.png',
'./assets/icons/icon-192.png',
'./assets/icons/icon-512.png', // اصلاح
  './assets/fonts/Vazirmatn-Regular.woff2', './assets/fonts/Vazirmatn-Medium.woff2',
  './assets/fonts/Vazirmatn-Bold.woff2', './assets/fonts/Vazirmatn-ExtraBold.woff2',
  './js/utils.js', './js/parser.js', './js/state.js', './js/charts.js', './js/ui.js', './js/app.js',
  './js/core/errors.js', './js/core/event-bus.js', './js/core/jalali.js',
  './js/domain/models.js', './js/domain/validators.js', './js/domain/loan.engine.js',
  './js/infra/db.js', './js/infra/repo.js', './js/infra/crypto.js',
  './js/services/data.service.js', './js/services/auth.service.js', './js/services/member.service.js', './js/services/edit.service.js', './js/services/txn.service.js', './js/services/loan.service.js', './js/services/period.service.js', './js/services/yearly.service.js', './js/services/forecast.service.js', './js/services/report.service.js', './js/services/backup.service.js', './js/services/notify.service.js', './js/services/pwa.service.js',
  './js/views/dashboard.js', './js/views/members.js', './js/views/member-detail.js', './js/views/member-edit.js', './js/views/loans.js', './js/views/loan-new.js', './js/views/loan-detail.js', './js/views/loan-edit.js', './js/views/monthly.js', './js/views/txn-edit.js', './js/views/yearly.js', './js/views/data.js', './js/views/login.js', './js/views/settings.js', './js/views/settings-global.js', './js/views/audit-log.js', './js/views/forecast.js', './js/views/period-manage.js', './js/views/reports.js', './js/views/report-viewer.js', './js/views/reminders.js', './js/views/backup.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('qarz-fund-') && k !== CACHE_STATIC && k !== CACHE_RUNTIME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // ← مهم: فقط GET کش می‌شود
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(networkFirst(req)); return;
  }
  if (['script','style','font','image'].includes(req.destination)) {
    event.respondWith(cacheFirst(req)); return;
  }
  event.respondWith(staleWhileRevalidate(req));
});

function offlineResponse() {
  return new Response('آفلاین', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); // ← اصلاح کرش
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) { const cache = await caches.open(CACHE_STATIC); cache.put(req, res.clone()); }
    return res;
  } catch (e) { return offlineResponse(); }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) { const cache = await caches.open(CACHE_STATIC); cache.put(req, res.clone()); }
    return res;
  } catch (e) {
    const cached = (await caches.match(req)) || (await caches.match('./index.html')) || (await caches.match('./'));
    return cached || offlineResponse();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_RUNTIME);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  if (cached) return cached;
  const fresh = await fetchPromise;
  return fresh || offlineResponse();
}