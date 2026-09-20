// Offline support: the app shell is precached on install, everything else is cached as it loads.
const VERSION = 'atelier-v3'
const scope = new URL(self.registration.scope)
const core = ['', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']
  .map((p) => new URL(p, scope).href)

/** The build hashes its asset names, so read them out of the shell instead of hard-coding them. */
async function shellAssets() {
  try {
    const res = await fetch(new URL('index.html', scope).href, { cache: 'reload' })
    const html = await res.text()
    const urls = new Set()
    for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const u = new URL(m[1], scope)
      if (u.origin === self.location.origin) urls.add(u.href)
    }
    return [...urls]
  } catch { return [] }
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION)
    const list = [...core, ...(await shellAssets())]
    await Promise.allSettled(list.map((u) => c.add(new Request(u, { cache: 'reload' }))))
    self.skipWaiting()
  })())
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k)
    await self.clients.claim()
  })())
})

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting() })

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return
  // navigations: network first, falling back to the cached shell so the app opens offline
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req)
        const c = await caches.open(VERSION)
        c.put(new URL('index.html', scope).href, res.clone())
        return res
      } catch {
        const c = await caches.open(VERSION)
        return (await c.match(new URL('index.html', scope).href, { ignoreVary: true })) || (await c.match(scope.href, { ignoreVary: true })) || Response.error()
      }
    })())
    return
  }
  // assets: cache first, refreshed in the background
  e.respondWith((async () => {
    const c = await caches.open(VERSION)
    const hit = await c.match(req, { ignoreVary: true })
    const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res }).catch(() => null)
    return hit || (await net) || Response.error()
  })())
})
