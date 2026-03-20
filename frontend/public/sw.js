const STATIC_CACHE = 'campus-connect-static-v1';
const API_CACHE = 'campus-connect-api-v1';
const API_CACHE_TTL_MS = 60 * 1000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const isApiGetRequest = (request) => {
  if (request.method !== 'GET') return false;
  try {
    const requestUrl = new URL(request.url);
    return requestUrl.pathname.startsWith('/api/');
  } catch {
    return false;
  }
};

const cacheFirstStatic = async (request) => {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
};

const staleWhileRevalidateApi = async (request) => {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        const headers = new Headers(networkResponse.headers);
        headers.set('x-sw-cached-at', Date.now().toString());

        const buffered = await networkResponse.clone().arrayBuffer();
        const wrappedResponse = new Response(buffered, {
          status: networkResponse.status,
          statusText: networkResponse.statusText,
          headers
        });

        await cache.put(request, wrappedResponse);
      }

      return networkResponse;
    })
    .catch(() => null);

  if (cached) {
    const cachedAt = Number(cached.headers.get('x-sw-cached-at') || 0);
    const isTooOld = cachedAt && Date.now() - cachedAt > API_CACHE_TTL_MS;

    if (!isTooOld) {
      networkPromise.catch(() => null);
      return cached;
    }
  }

  const networkResponse = await networkPromise;
  return networkResponse || cached || fetch(request);
};

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (isApiGetRequest(request)) {
    event.respondWith(staleWhileRevalidateApi(request));
    return;
  }

  if (request.method === 'GET') {
    event.respondWith(cacheFirstStatic(request));
  }
});
