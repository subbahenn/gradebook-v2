
const CACHE = 'noten-cache-v1';
const ASSETS = [
  '', 'index.html',
  'src/app.css','src/app.js',
  'src/ui/header.js','src/ui/tabs.js',
  'src/ui/grade-dialog.js','src/ui/student-tile.js',
  'src/ui/seatplan-view.js','src/ui/seatplan-editor.js',
  'src/ui/admin.js','src/ui/overview.js',
  'src/data/db.js','src/data/crypto.js',
  'src/logic/grades.js','src/logic/export.js',
  'manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => r))
  );
});
