const CACHE_NAME = 'financeiro-v4.3';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './fonts/material-symbols.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/db.js',
  './js/config.js',
  './js/dashboard.js',
  './js/transacoes.js',
  './js/app.js',
  'https://unpkg.com/dexie@3/dist/dexie.js'
];

// Instalação e Cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('✅ PWA: Arquivos cacheados');
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Se o nome do cache mudou, deleta o antigo
          if (cacheName !== CACHE_NAME) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Estratégia: Tenta Rede, se falhar, vai no Cache
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});