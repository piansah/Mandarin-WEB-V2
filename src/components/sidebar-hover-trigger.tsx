"use client"

import { useSidebar } from "@/components/ui/sidebar"
import { useEffect } from "react"

const EDGE_TRIGGER_PX = 24

/**
 * Invisible helper that watches the mouse position and reveals the sidebar
 * whenever the cursor rests near the left edge of the screen. Hiding it
 * again once the cursor moves away is handled by the sidebar's own
 * onMouseLeave (see app-sidebar.tsx), so this component only ever opens it.
 */
export function SidebarHoverTrigger() {
  const { setOpen, isMobile, open, pinned } = useSidebar()

  useEffect(() => {
    if (isMobile || pinned) return

    const handleMouseMove = (e: MouseEvent) => {
      // Only trigger if sidebar is closed
      if (!open && e.clientX <= EDGE_TRIGGER_PX) {
        setOpen(true)
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [setOpen, isMobile, open, pinned])

  return null
}
