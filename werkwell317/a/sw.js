/* Offline support: network first, falling back to what was cached. */
var CACHE = 'werkwell-a-v2';
var CORE = ['./', './index.html', './styles.css', './app.js', './content.js', './brand.js', './legal.js', './consent.js', './theme.js', './intro/intro.css', './intro/intro.js', './manifest.webmanifest', './img/icon-192.png', './img/icon-512.png', './fonts/zodiak-100.woff2', './fonts/zodiak-300.woff2', './fonts/hanken-grotesk.woff2'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return r; }).catch(function () { return caches.match(e.request); }));
});
