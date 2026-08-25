"use client"

import * as React from "react"

export function useServiceWorker() {
  React.useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").then(
        (registration) => {
          console.log("Service Worker registered with scope:", registration.scope)
        },
        (error) => {
          console.error("Service Worker registration failed:", error)
        }
      )
    }
  }, [])
}
