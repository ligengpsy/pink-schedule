const CACHE_NAME = 'pink-schedule-v5';
const ASSETS = [
  './',
  './index.html',
  './pages/month.html',
  './pages/week.html',
  './pages/dashboard.html',
  './pages/settings.html',
  './manifest.json',
  './icon.svg',
  './assets/css/theme.css',
  './assets/js/auth.js',
  './assets/js/store.js',
  './assets/js/utils.js',
  './assets/js/ai.js',
  './assets/js/ai-panel.js',
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.1/dist/index.global.js',
  'https://unpkg.com/lucide@1.8.0/dist/umd/lucide.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      }).catch(() => cached);
    })
  );
});
