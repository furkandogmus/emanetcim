// Emanetçi Service Worker — PWA ikon/manifest; sayfa ve Next.js iç yollarına müdahale etme.
// (ngrok ara sayfası / RSC / OAuth için navigasyon ve _next cache'lenmez.)
const CACHE_NAME = 'emanetci-v4';
const ASSETS_TO_CACHE = ['/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png'];

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

  // Tüm doküman geçişleri: yalnızca ağ (HTML/ngrok/Auth.js için önbellek yok)
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Diğer istekler: önce önbellek (sabit ikon vb.)
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
