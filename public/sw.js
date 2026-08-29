const CACHE_NAME = "mandarin-journey-v2" // dinaikkan dari v1 supaya cache lama yang mungkin masih menyimpan entry basi otomatis dibuang lewat 'activate' di bawah
const urlsToCache = [
  // "/" SENGAJA tidak dimasukkan — dia selalu redirect ke "/dashboard",
  // dan cache.add()/cache.put() SELALU throw untuk response hasil
  // redirect. Precache di bawah cukup aset statis yang benar-benar 200.
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache setiap aset satu-satu (bukan cache.addAll) supaya satu
      // aset yang gagal (404/network error) tidak bikin SELURUH proses
      // install reject — ini penyebab
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
  const { request } = event

  // Non-GET (POST/PUT/dst, mis. auth & mutasi Supabase) dibiarkan lewat
  // langsung ke network tanpa campur tangan SW sama sekali.
  if (request.method !== "GET") return

  // Request navigasi (buka halaman langsung, reload, atau redirect
  // seperti "/" -> "/dashboard") SENGAJA tidak di-intercept sama sekali
  // — dengan tidak memanggil respondWith(), browser menangani request
  // ini 100% native, termasuk redirect server-side, tanpa risiko SW
  // salah menangani response redirect (yang sebelumnya menyebabkan
  // ERR_FAILED di "/"). App ini butuh network buat Supabase, jadi
  // offline-navigasi bukan use-case penting untuk dikorbankan di sini.
  if (request.mode === "navigate") return

  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response
      }
      return fetch(request).catch(() => {
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