// FRISCHPLANT service worker
// Cél: a statikus app-héj offline elérése + verziófrissítés (skipWaiting üzenetre).
// Élő adat (Supabase, Open-Meteo) mindig hálózatról; CDN/betűk gyorsítótárból.
const CACHE_NAME = 'frischplant-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './frischplant-icon-180.png',
  './frischplant-icon-192.png',
  './frischplant-icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
  // skipWaiting szándékosan kihagyva: az új verzió "waiting" marad,
  // amíg a "Frissítés elérhető" sávra rá nem koppintanak.
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Élő adat: mindig hálózatról, sosem gyorsítótárból
  if (url.includes('supabase.co') || url.includes('open-meteo.com')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // CDN (betűk, jsPDF, Supabase kliens): cache-first, hálózati feltöltéssel
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com') ||
      url.includes('cdnjs.cloudflare.com') || url.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      }).catch(() => cached))
    );
    return;
  }

  // Statikus app-fájlok: cache-first, hálózati fallback
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
