// The Slow Tide 官网 Service Worker - 简易离线缓存
const CACHE = 'tst-cache-v2';
const CORE = ['/', '/index.html', '/profile.html', '/tool.html', '/admin.html', '/manifest.json', '/logo.jpg', '/ad1.jpg', '/ad2.jpg', '/ad3.jpg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // API 不缓存
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        fetch(req).then((fresh) => {
          if (fresh && fresh.ok) caches.put(req, fresh);
        }).catch(() => {});
        return hit;
      }
      return fetch(req).then((res) => {
        const copy = res.clone();
        if (res.ok) caches.put(req, copy);
        return res;
      }).catch(() => caches.match('/'));
    })
  );
});
