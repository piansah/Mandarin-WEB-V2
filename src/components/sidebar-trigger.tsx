"use client"

import { useSidebar } from "@/components/ui/sidebar"
import { Menu } from "lucide-react"

export function SidebarTrigger() {
  const { open, setOpen } = useSidebar()

  return (
    <button
      type="button"
      onClick={() => {
        setOpen(!open)
        // Set a custom event to notify AppSidebar to toggle manuallyOpened
        window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: !open }))
      }}
      className="fixed left-0 top-12 z-50 p-2 bg-primary text-primary-foreground rounded-r-md hover:bg-primary/90 transition-colors"
      aria-label="Toggle sidebar"
    >
      <Menu className="h-5 w-5" />
    </button>
  )
}
