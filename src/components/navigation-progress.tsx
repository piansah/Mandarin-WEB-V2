"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

export function NavigationProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = React.useState(0)
  const [visible, setVisible] = React.useState(false)
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    const clearTimers = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!(event.target instanceof Element)) return

      const link = event.target.closest<HTMLAnchorElement>("a[href]")
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return

      const destination = new URL(link.href, window.location.href)
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return

      clearTimers()
      setVisible(true)
      setProgress(12)
      intervalRef.current = setInterval(() => {
        setProgress((current) => Math.min(current + Math.max(2, (90 - current) * 0.12), 90))
      }, 120)
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 12000)
    }

    document.addEventListener("click", handleClick, true)
    return () => {
      document.removeEventListener("click", handleClick, true)
      clearTimers()
    }
  }, [])

  React.useEffect(() => {
    if (!visible) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    setProgress(100)
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 220)
  }, [pathname])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5" aria-hidden="true">
      <div
        className={`h-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)] transition-[width,opacity] duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
