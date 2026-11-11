const CACHE_NAME = 'kosh-offline-shell-v1'
const APP_SHELL = ['/', '/index.html']

const serviceWorkerScope = globalThis as unknown as {
  addEventListener: (type: string, listener: (event: any) => void) => void
  skipWaiting: () => Promise<void>
  clients: {
    claim: () => Promise<void>
    matchAll: (options?: { type?: string; includeUncontrolled?: boolean }) => Promise<
      Array<{ postMessage: (message: unknown) => void }>
    >
  }
}

function isSameOrigin(request: Request): boolean {
  try {
    return new URL(request.url).origin === self.location.origin
  } catch {
    return false
  }
}

function isNavigationRequest(request: Request): boolean {
  return request.method === 'GET' && request.mode === 'navigate'
}

function isCacheableResponse(response: Response): boolean {
  return response.ok && (response.type === 'basic' || response.type === 'default')
}

async function notifyClients(message: unknown): Promise<void> {
  const clients = await serviceWorkerScope.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })

  for (const client of clients) client.postMessage(message)
}

serviceWorkerScope.addEventListener('install', (event: { waitUntil: (promise: Promise<unknown>) => void }) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await Promise.allSettled(
          APP_SHELL.map(async (path) => {
            const response = await fetch(path, { cache: 'reload' })
            if (isCacheableResponse(response)) await cache.put(path, response)
          }),
        )
      })
      .then(() => serviceWorkerScope.skipWaiting()),
  )
})

serviceWorkerScope.addEventListener('activate', (event: { waitUntil: (promise: Promise<unknown>) => void }) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('kosh-offline-shell-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => serviceWorkerScope.clients.claim())
      .then(() => notifyClients({ type: 'KOSH_OFFLINE_READY' })),
  )
})

serviceWorkerScope.addEventListener(
  'fetch',
  (event: {
    request: Request
    respondWith: (response: Promise<Response>) => void
    waitUntil?: (promise: Promise<unknown>) => void
  }) => {
    const request = event.request
    if (request.method !== 'GET' || !isSameOrigin(request)) return

    if (isNavigationRequest(request)) {
      event.respondWith(
        fetch(request)
          .then(async (response) => {
            if (isCacheableResponse(response)) {
              const cache = await caches.open(CACHE_NAME)
              await cache.put('/index.html', response.clone())
              await cache.put('/', response.clone())
            }
            return response
          })
          .catch(async () => {
            const cache = await caches.open(CACHE_NAME)
            return (
              (await cache.match(request)) ??
              (await cache.match('/index.html')) ??
              (await cache.match('/'))
            ) ??
              new Response('Kosh is not available offline yet. Open it once while connected, then try again.', {
                status: 503,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
              })
          }),
      )
      return
    }

    const url = new URL(request.url)
    if (url.pathname.includes('/api/') || url.pathname.includes('/auth/')) return

    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) return cached

        const response = await fetch(request)
        if (isCacheableResponse(response)) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(request, response.clone())
        }
        return response
      }),
    )
  },
)