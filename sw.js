// Service worker: cache-first untuk semua fail statik, supaya game boleh dibuka tanpa internet.
// Senarai fail dijana oleh tools/stamp.py (jalankan semula setiap kali fail berubah).
const VERSION = 'maani-31073c0be1';
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./css/style.css", "./fonts/amiri-arabic-400-normal.woff2", "./fonts/amiri-arabic-700-normal.woff2", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./js/character.js", "./js/config.js", "./js/data.js", "./js/entities.js", "./js/main.js", "./js/net.js", "./js/quiz.js", "./js/world.js", "./vendor/supabase.js", "./vendor/three/three.core.js", "./vendor/three/three.module.js"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) =>
      hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
    )
  );
});
