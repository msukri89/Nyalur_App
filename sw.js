const CACHE_NAME = 'nyalur-cache-v1';

// Daftar file yang harus disimpan untuk penggunaan offline
const ASSETS_TO_CACHE = [
  '/Nyalur/',
  '/Nyalur/index.html',
  '/Nyalur/style.css',
  '/Nyalur/app.js',
  '/Nyalur/manifest.json',
  '/Nyalur/icon.png',
  '/Nyalur/lib/history-db.js',
  '/Nyalur/lib/peer-manager.js',
  '/Nyalur/lib/transfer-engine.js',
  '/Nyalur/lib/utils.js'
];

// 1. Proses Install: Menyimpan semua file penting ke dalam Cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Menyimpan cache offline...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Memaksa SW baru untuk langsung aktif
});

// 2. Proses Activate: Membersihkan cache versi lama jika ada pembaruan
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Menghapus cache lama:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Proses Fetch: Mencegat permintaan internet
self.addEventListener('fetch', (event) => {
  event.respondWith(
    // Mencoba mengambil dari internet terlebih dahulu (Network First)
    fetch(event.request)
      .then((networkResponse) => {
        // Jika berhasil (online), perbarui cache agar selalu uptodate
        if (event.request.method === 'GET' && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Jika gagal (offline / tidak ada kuota), ambil dari cache
        return caches.match(event.request);
      })
  );
});
