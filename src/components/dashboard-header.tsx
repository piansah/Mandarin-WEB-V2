"use client"

import { useSidebar } from "@/components/ui/sidebar"
import { Menu } from "lucide-react"

export function DashboardHeader() {
  const { open, setOpen } = useSidebar()

  return (
    <div className="flex items-center gap-2 p-4 border-b">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-2 hover:bg-muted rounded-md"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>
    </div>
  )
}
