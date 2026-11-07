/* 心晴岛 · Service Worker（仅 Web 版，http/https 下注册）
   目标：平板/电脑装成应用后，断网也能打开；所有资源都是同源静态文件。
   发版时请同步修改 CACHE 里的版本号——文件内容一变，浏览器才会安装新的 SW 并重新取资源。 */
'use strict';

var CACHE = 'sunny-isles-1.2.0';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles.css',
  './src/data/curriculum.js',
  './src/core/utils.js',
  './src/core/audio.js',
  './src/core/state.js',
  './src/core/screentime.js',
  './src/ui/art.js',
  './src/ui/components.js',
  './src/ui/calm.js',
  './src/ui/games.js',
  './src/ui/expression.js',
  './src/ui/screens.js',
  './src/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(ASSETS); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  /* 页面导航：先联网拿最新 HTML，断网再回缓存（避免装成应用后永远停在旧版本） */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) { return hit || caches.match('./'); });
      })
    );
    return;
  }

  /* 静态资源：缓存优先，命中就不再发请求，离线可用 */
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
