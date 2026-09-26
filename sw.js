// The Slow Tide 官网 Service Worker - 已停用
// 说明：原离线缓存逻辑会在子页面（admin.html 等）被 Cloudflare 308 重定向时引发 ERR_FAILED，
// 故停用缓存拦截，所有请求直连网络；同时清空历史缓存。
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
// 无 fetch 拦截：所有请求直连网络
