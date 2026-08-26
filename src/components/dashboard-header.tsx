"use client"

import { useSidebar } from "@/components/ui/sidebar"
import { PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export function DashboardHeader({ className }: { className?: string }) {
  const { pinned, togglePinned } = useSidebar()

  return (
    <header className={cn("flex items-center gap-2 border-b px-4 py-3", className)}>
      <button
        type="button"
        onClick={togglePinned}
        className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted"
        aria-label={pinned ? "Lepas kunci sidebar" : "Kunci sidebar tetap terbuka"}
        aria-pressed={pinned}
        title={pinned ? "Lepas kunci sidebar" : "Kunci sidebar tetap terbuka"}
      >
        <PanelLeft className="h-5 w-5" />
      </button>
    </header>
  )
}
