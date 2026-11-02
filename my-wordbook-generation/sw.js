/* 单词书 · 离线缓存 */
const CACHE = 'wordbook-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './css/tokens.css',
  './css/app.css',
  './js/data/wordbank.js',
  './js/core/store.js',
  './js/core/srs.js',
  './js/core/words.js',
  './js/core/session.js',
  './js/core/export.js',
  './js/core/speech.js',
  './js/ui/common.js',
  './js/ui/onboarding.js',
  './js/ui/today.js',
  './js/ui/learn.js',
  './js/ui/review.js',
  './js/ui/notebook.js',
  './js/ui/stats.js',
  './js/ui/settings.js',
  './js/main.js',
  './vendor/xlsx.full.min.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (hit) {
      const network = fetch(event.request).then(function (response) {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      }).catch(function () {
        return hit || caches.match('./index.html');
      });
      return hit || network;
    })
  );
});
