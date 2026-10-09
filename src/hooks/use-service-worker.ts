"use client"

import * as React from "react"

export function useServiceWorker() {
  React.useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(
        (error) => {
          console.error("Service Worker registration failed:", error)
        }
      )
    }
  }, [])
}
