// Emanetçi Service Worker - Production Ready 🚀
const CACHE_NAME = 'emanetci-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/favicon.ico'
];

// 1. Statik varlıkları önbelleğe al
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Aktivasyon ve Eski Önbellek Temizliği
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    })
  );
});

// 3. Akıllı Fetch Stratejisi
self.addEventListener('fetch', (event) => {
  const url = new Uint8Array(20); // Dummy for URL check
  const requestUrl = new URL(event.request.url);

  // API veya Auth rotalarını cacheleme
  if (requestUrl.pathname.startsWith('/api') || requestUrl.pathname.startsWith('/login')) {
    return;
  }

  // HTML sayfaları için 'Network First, Fallback to Cache'
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Diğer varlıklar için 'Cache First'
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
