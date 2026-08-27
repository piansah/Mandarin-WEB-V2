"use client"

import * as React from "react"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
  prompt(): Promise<void>
}

export type PwaInstallStatus =
  | "loading"       // Masih menunggu event browser
  | "installable"   // Browser mendukung & prompt tersedia
  | "ios"           // iOS Safari — perlu instruksi manual
  | "installed"     // Sudah berjalan sebagai PWA / sudah diinstall
  | "unsupported"   // Browser tidak mendukung PWA install

export function usePwaInstall() {
  const [status, setStatus] = React.useState<PwaInstallStatus>("loading")
  const [installing, setInstalling] = React.useState(false)
  const promptRef = React.useRef<BeforeInstallPromptEvent | null>(null)

  React.useEffect(() => {
    // Cek apakah sudah running sebagai standalone (installed)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true

    if (isStandalone) {
      setStatus("installed")
      return
    }

    // Deteksi iOS
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream
    if (isIos) {
      setStatus("ios")
      return
    }

    // Tangkap beforeinstallprompt (Android / Desktop Chrome/Edge)
    const handler = (e: Event) => {
      e.preventDefault()
      promptRef.current = e as BeforeInstallPromptEvent
      setStatus("installable")
    }

    window.addEventListener("beforeinstallprompt", handler)

    // Jika setelah 3 detik tidak ada event → unsupported (Firefox, Safari desktop, dll)
    const timer = setTimeout(() => {
      if (!promptRef.current) setStatus("unsupported")
    }, 3000)

    // Tangkap event setelah berhasil diinstall
    const installedHandler = () => setStatus("installed")
    window.addEventListener("appinstalled", installedHandler)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      window.removeEventListener("appinstalled", installedHandler)
      clearTimeout(timer)
    }
  }, [])

  const installPwa = React.useCallback(async () => {
    if (!promptRef.current) return
    setInstalling(true)
    try {
      await promptRef.current.prompt()
      const { outcome } = await promptRef.current.userChoice
      if (outcome === "accepted") {
        setStatus("installed")
        promptRef.current = null
      }
    } catch {
      // User dismissed atau error
    } finally {
      setInstalling(false)
    }
  }, [])

  return { status, installing, installPwa }
}
