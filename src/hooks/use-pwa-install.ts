"use client"

import * as React from "react"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
  prompt(): Promise<void>
}

export type PwaInstallStatus =
  | "loading"
  | "installable"
  | "ios"
  | "installed"
  | "unsupported"

type Store = {
  status: PwaInstallStatus
  prompt: BeforeInstallPromptEvent | null
}

const store: Store = {
  status: "loading",
  prompt: null,
}

const listeners = new Set<() => void>()
let captureStarted = false
let fallbackTimer: ReturnType<typeof setTimeout> | null = null

function emit() {
  listeners.forEach((listener) => listener())
}

function setStatus(status: PwaInstallStatus) {
  if (store.status === status) return
  store.status = status
  emit()
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

function isIosSafari() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream
}

/** Daftarkan listener sekali di root app agar `beforeinstallprompt` tidak terlewat. */
export function initPwaInstallCapture() {
  if (typeof window === "undefined" || captureStarted) return
  captureStarted = true

  if (isStandalone()) {
    store.prompt = null
    setStatus("installed")
    return
  }

  if (isIosSafari()) {
    setStatus("ios")
    return
  }

  const onBeforeInstall = (event: Event) => {
    event.preventDefault()
    store.prompt = event as BeforeInstallPromptEvent
    if (fallbackTimer) {
      clearTimeout(fallbackTimer)
      fallbackTimer = null
    }
    setStatus("installable")
  }

  const onInstalled = () => {
    store.prompt = null
    setStatus("installed")
  }

  window.addEventListener("beforeinstallprompt", onBeforeInstall)
  window.addEventListener("appinstalled", onInstalled)

  fallbackTimer = setTimeout(() => {
    if (store.status === "loading") setStatus("unsupported")
  }, 2500)
}

export function usePwaInstall() {
  const [, rerender] = React.useReducer((count: number) => count + 1, 0)
  const [installing, setInstalling] = React.useState(false)

  React.useEffect(() => {
    initPwaInstallCapture()
    const onChange = () => rerender()
    listeners.add(onChange)
    return () => {
      listeners.delete(onChange)
    }
  }, [])

  const installPwa = React.useCallback(async () => {
    if (!store.prompt) return
    setInstalling(true)
    try {
      await store.prompt.prompt()
      const { outcome } = await store.prompt.userChoice
      if (outcome === "accepted") {
        store.prompt = null
        setStatus("installed")
      }
    } catch {
      // User dismissed or browser error
    } finally {
      setInstalling(false)
    }
  }, [])

  return {
    status: store.status,
    installing,
    installPwa,
    canInstall: store.status === "installable" && Boolean(store.prompt),
  }
}
