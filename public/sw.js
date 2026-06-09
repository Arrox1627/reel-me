const CACHE_NAME = 'reel-me-v1'
const OFFLINE_URL = '/offline'

const PRECACHE = [
  '/',
  '/camera',
  '/reel',
  '/settings',
  '/offline',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL)))
  )
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const title = data.title || 'REEL ME'
  const options = {
    body: data.body || "Time for today's frame 📸",
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'daily-reminder',
    renotify: true,
    data: { url: data.url || '/camera' },
    actions: [
      { action: 'capture', title: '📸 Capture now' },
      { action: 'dismiss', title: 'Later' },
    ],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return

  const url = event.notification.data?.url || '/camera'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin))
        if (existing) {
          existing.focus()
          existing.navigate(url)
        } else {
          self.clients.openWindow(url)
        }
      })
  )
})
