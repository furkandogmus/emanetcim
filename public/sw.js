// BagajPark Service Worker — PWA ikon/manifest; sayfa ve Next.js iç yollarına müdahale etme.
// (ngrok ara sayfası / RSC / OAuth için navigasyon ve _next cache'lenmez.)
const CACHE_NAME = 'bagajpark-v6';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        ASSETS_TO_CACHE.map(async (url) => {
          try {
            const res = await fetch(new Request(url, { cache: 'reload' }));
            if (res.ok) await cache.put(url, res);
          } catch {
            /* ikon eksik vb. */
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('push', (event) => {
  let payload = { title: 'BagajPark', body: '' };
  try {
    if (event.data) {
      const j = event.data.json();
      if (j && typeof j === 'object') {
        payload = {
          title: typeof j.title === 'string' ? j.title : payload.title,
          body: typeof j.body === 'string' ? j.body : '',
        };
      }
    }
  } catch {
    /* raw text */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      )
    )
  );
  self.clients.claim();
});

function shouldBypassSw(url) {
  const path = url.pathname;
  if (path.startsWith('/api/')) return true;
  if (path.startsWith('/_next/')) return true;
  if (path.includes('/login')) return true;
  if (path.includes('/auth')) return true;
  if (url.searchParams.has('_rsc')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (shouldBypassSw(requestUrl)) {
    return;
  }

  // Doküman: ağ önce; kopunca önbellekteki offline sayfası (RSC / _next önbelleklenmez)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/offline.html').then((cached) => {
          if (cached) return cached;
          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }),
      ),
    );
    return;
  }

  // Diğer istekler: önce önbellek (sabit ikon vb.)
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
