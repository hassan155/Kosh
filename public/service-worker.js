const CACHE_NAME = 'kosh-offline-shell-v2'
const CORE_ASSETS = ['./', './manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('kosh-offline-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put('./', response.clone()))
      return response
    }).catch(async () => (await caches.match(request)) || (await caches.match('./')) || new Response('Kosh has not been opened online on this device yet.', { status: 503 })))
    return
  }
  event.respondWith(caches.match(request).then(async (cached) => {
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
    return response
  }))
})
