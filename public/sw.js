// Service Worker básico para permitir instalação PWA
const CACHE_NAME = 'restaurante-app-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Online-first: apenas repassa a requisição
  // Necessário estar presente para ser instalável
  event.respondWith(fetch(event.request));
});
