"use client"

import { useSidebar } from "@/components/ui/sidebar"
import { PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Small fixed button used ONLY on mobile to open the sidebar sheet, since
 * touch devices have no hover to reveal it and no room for it to live
 * inside the (currently closed) sidebar. On desktop this renders nothing —
 * the sidebar reveals itself on hover near the left edge, and its own
 * in-header button (see app-sidebar.tsx) handles pin/close, so it hides
 * along with the sidebar as requested.
 */
export function SidebarMobileOpenButton({ className }: { className?: string }) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar()

  if (!isMobile || openMobile) return null

  return (
    <button
      type="button"
      onClick={() => setOpenMobile(true)}
      className={cn(
        "fixed left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90",
        className
      )}
      aria-label="Buka sidebar"
      title="Buka sidebar"
    >
      <PanelLeft className="h-5 w-5" />
    </button>
  )
}
