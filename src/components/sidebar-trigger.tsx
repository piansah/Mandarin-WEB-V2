"use client"

import { useSidebar } from "@/components/ui/sidebar"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Fixed burger button that lets the user permanently pin the sidebar open
 * (ignoring the hover auto-hide behavior) or hide it again, going back to
 * "auto show on hover near the left edge" mode. On mobile it opens/closes
 * the slide-in sheet instead.
 */
export function SidebarBurgerTrigger({ className }: { className?: string }) {
  const { isMobile, openMobile, setOpenMobile, pinned, togglePinned, open } =
    useSidebar()

  const isActive = isMobile ? openMobile : pinned
  const isVisiblyOpen = isMobile ? openMobile : open

  function handleClick() {
    if (isMobile) {
      setOpenMobile(!openMobile)
    } else {
      togglePinned()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "fixed top-3 z-50 flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-md transition-[left,background-color] duration-200 ease-linear hover:bg-primary/90",
        isVisiblyOpen && !isMobile ? "left-[calc(var(--sidebar-width,16rem)+0.75rem)]" : "left-3",
        className
      )}
      aria-label={isActive ? "Sembunyikan sidebar" : "Tampilkan sidebar"}
      aria-pressed={isActive}
      title={isActive ? "Sembunyikan sidebar" : "Kunci sidebar tetap terbuka"}
    >
      {isActive ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  )
}
