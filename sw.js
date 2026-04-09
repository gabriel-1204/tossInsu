const CACHE_NAME = 'toss-insu-v2';
const ASSETS = [
  '/index.html',
  '/exam.html',
  '/result.html',
  '/css/style.css',
  '/js/app.js',
  '/js/exam.js',
  '/js/result.js',
  '/data/questions.js',
  '/data/keywords.js',
  '/data/category_map.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('generativelanguage.googleapis.com')) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        if (!response.ok || response.type === 'opaqueredirect' || response.redirected) {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});
