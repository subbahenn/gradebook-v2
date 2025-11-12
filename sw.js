// sw.js
const CACHE = 'noten-cache-v4'; // Version erhöhen!
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  // Falls Icons fehlen, vorübergehend auskommentieren oder anlegen
  // 'icons/icon-192.png', 'icons/icon-512.png',
  'src/app.css','src/app.js',
  'src/ui/header.js','src/ui/tabs.js',
  'src/ui/grade-dialog.js','src/ui/student-tile.js',
  'src/ui/seatplan-view.js','src/ui/seatplan-editor.js',
  'src/ui/admin.js','src/ui/overview.js',
  'src/data/db.js','src/data/crypto.js',
  'src/logic/grades.js','src/logic/export.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async (url) => {
      try {
        const res = await fetch(new Request(url, { cache: 'no-cache' }));
        if (res.ok) await cache.put(url, res.clone());
        else console.warn('[SW] Skip asset (status):', url, res.status);
      } catch (err) {
        console.warn('[SW] Skip asset (error):', url, err);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch { return cached || Response.error(); }
  })());
});
