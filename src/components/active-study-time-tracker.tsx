"use client"

import * as React from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { localDateString } from "@/lib/local-date"

const IDLE_TIMEOUT_MS = 60_000
const HEARTBEAT_MS = 15_000
const MAX_HEARTBEAT_SECONDS = 30
const EXCLUDED_PREFIXES = [
  "/dashboard/statistik",
  "/dashboard/settings",
  "/dashboard/profile",
  "/dashboard/admin",
]

/** Counts visible, recently active time in the learning app, not idle tab time. */
export function ActiveStudyTimeTracker({ pathname }: { pathname: string | null }) {
  const supa = useSupabase()
  const pathnameRef = React.useRef(pathname)

  React.useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  React.useEffect(() => {
    let lastActivityAt = 0
    let lastActivityPath: string | null = null
    let lastTickAt = Date.now()
    let pendingMilliseconds = 0
    let sessionReady = false
    let requestInFlight = false
    let wasVisible = document.visibilityState === "visible"

    void supa.auth.getSession().then(({ data }) => {
      sessionReady = Boolean(data.session?.user)
    })

    const isLearningPage = () => {
      const currentPath = pathnameRef.current
      return Boolean(currentPath?.startsWith("/dashboard")) &&
        !EXCLUDED_PREFIXES.some((prefix) => currentPath?.startsWith(prefix))
    }

    const flush = async (force = false) => {
      if (!sessionReady || requestInFlight || (!force && pendingMilliseconds < HEARTBEAT_MS)) return
      const seconds = Math.min(MAX_HEARTBEAT_SECONDS, Math.floor(pendingMilliseconds / 1000))
      if (seconds < 1) return

      pendingMilliseconds -= seconds * 1000
      requestInFlight = true
      const { error } = await supa.rpc("record_study_time", {
        p_seconds: seconds,
        p_study_date: localDateString(),
      })
      if (error) {
        pendingMilliseconds += seconds * 1000
        console.warn("Gagal menyimpan durasi belajar aktif:", error.message)
      }
      requestInFlight = false
    }

    const tick = () => {
      const now = Date.now()
      const visible = document.visibilityState === "visible"
      const elapsed = Math.min(Math.max(0, now - lastTickAt), HEARTBEAT_MS * 2)

      if (
        wasVisible &&
        visible &&
        isLearningPage() &&
        lastActivityAt > 0 &&
        lastActivityPath === pathnameRef.current &&
        now - lastActivityAt <= IDLE_TIMEOUT_MS
      ) {
        pendingMilliseconds += elapsed
      }

      lastTickAt = now
      wasVisible = visible
      void flush()
    }

    const markActivity = () => {
      if (document.visibilityState === "visible" && isLearningPage()) {
        lastActivityAt = Date.now()
        lastActivityPath = pathnameRef.current
      }
    }

    const handleVisibilityChange = () => {
      tick()
      if (document.visibilityState === "hidden") void flush(true)
    }

    const timer = window.setInterval(tick, HEARTBEAT_MS)
    const activityEvents: (keyof WindowEventMap)[] = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel"]
    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }))
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(timer)
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity))
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      tick()
      void flush(true)
    }
  }, [supa])

  return null
}
