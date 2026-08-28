const CACHE_NAME = "mandarin-journey-v1"
const urlsToCache = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache setiap aset satu-satu (bukan cache.addAll) supaya satu
      // aset yang gagal (404/network error) tidak bikin SELURUH proses
      // install reject — sebelumnya ini penyebab
      // "Uncaught (in promise) TypeError: Failed to fetch" di console,
      // karena addAll() menolak semuanya begitu satu URL saja gagal.
      return Promise.all(
        urlsToCache.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("SW: gagal precache", url, err)
          })
        )
      )
    })
  )
  self.skipWaiting()
})

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response
      }
      return fetch(event.request).catch(() => {
        // Kalau offline & tidak ada di cache, biarkan request gagal
        // secara wajar alih-alih melempar unhandled rejection.
        return new Response("", { status: 504, statusText: "Offline" })
      })
    })
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})
