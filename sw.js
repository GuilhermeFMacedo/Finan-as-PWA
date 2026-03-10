const CACHE_NAME = 'financeiro-v2'; // Mudei para v2 para forçar atualização
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

// Estratégia: Tenta Rede, se falhar, vai no Cache
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});