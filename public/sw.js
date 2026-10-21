// HABA Service Worker
// Estrategia Network-First estricta para navegaciones y APIs.
// Cache-First únicamente para assets estáticos inmutables.
// skipWaiting y clientsClaim activos para actualización inmediata sin bloqueos.

const CACHE_NAME = 'haba-cache-v7';

// Solo activos estáticos esenciales (NUNCA '/' ni documentos HTML)
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/manifest.json',
  '/LogoHaba.png',
  '/LogoHaba.png?v=2',
  '/logo.png',
  '/splash.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png'
];

// 1. Install: Pre-cachear solo iconos e imágenes fijas y activar inmediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Fallo no crítico en pre-cache:', err);
      });
    })
  );
});

// 2. Activate: Limpiar todas las cachés viejas y tomar control inmediato de los clientes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Purgando caché obsoleta:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Listener de mensajes para skipWaiting o vaciado forzado de caché
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(keys.map((k) => caches.delete(k)));
      })
    );
  }
});

// 4. Fetch: Estrategias de caché diferenciadas
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Ignorar métodos que no sean GET
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Ignorar esquemas no HTTP/HTTPS (extensiones de Chrome, etc.)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  const isNavigation =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  // --- ESTRATEGIA A: Documentos HTML / Navegaciones (ESTRICTO NETWORK-FIRST) ---
  // Nunca entregar HTML viejo de caché si hay conexión. Solo usar caché si la red falla (offline real).
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si no hay red ni caché, retornar mensaje limpio offline
          return new Response(
            '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>HABA — Modo sin conexión</title><style>body{font-family:sans-serif;text-align:center;padding:40px;background:#F6F7F2;color:#2B2B2B}h1{color:#1F7A4C}button{background:#3BB578;color:#fff;border:none;padding:12px 24px;border-radius:12px;font-size:16px;cursor:pointer;font-weight:bold;margin-top:20px}</style></head><body><h1>Estás sin conexión a internet</h1><p>Verificá tu conexión Wi-Fi o datos móviles para continuar navegando.</p><button onclick="window.location.reload()">Reintentar conexión</button></body></html>',
            {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
    );
    return;
  }

  // --- ESTRATEGIA B: APIs y Supabase (ESTRICTO NETWORK-FIRST) ---
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/auth/v1/')
  ) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        return new Response(
          JSON.stringify({ error: 'offline', message: 'Sin conexión a internet' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // --- ESTRATEGIA C: Chunks estáticos inmutables de Next.js (/_next/static/) ---
  // Los chunks de Next.js llevan hash en su URL.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch((err) => {
            // No retornar una respuesta rota que dispare ERR_FAILED
            console.warn('[SW] Error al cargar chunk estático:', request.url, err);
            return new Response('', { status: 404, statusText: 'Not Found' });
          });
      })
    );
    return;
  }

  // --- ESTRATEGIA D: Resto de recursos estáticos (imágenes, fuentes) ---
  const isImageOrFont = url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf)$/i);
  if (isImageOrFont) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // Por defecto: Red directa
  event.respondWith(fetch(request));
});
