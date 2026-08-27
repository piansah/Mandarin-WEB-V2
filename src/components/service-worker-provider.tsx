"use client"

import { useEffect, type ReactNode } from "react"
import { useServiceWorker } from "@/hooks/use-service-worker"
import { initPwaInstallCapture } from "@/hooks/use-pwa-install"

export function ServiceWorkerProvider({ children }: { children: ReactNode }) {
  useServiceWorker()
  useEffect(() => {
    initPwaInstallCapture()
  }, [])
  return <>{children}</>
}
