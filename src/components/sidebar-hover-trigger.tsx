"use client"

import { useSidebar } from "@/components/ui/sidebar"
import { useEffect } from "react"

export function SidebarHoverTrigger() {
  const { setOpen } = useSidebar()

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Open sidebar when mouse is near left edge (within 20px)
      if (e.clientX <= 20) {
        setOpen(true)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [setOpen])

  return null
}
