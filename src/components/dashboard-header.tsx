"use client"

import { Search, Bell, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DashboardThemeToggle } from "@/components/dashboard-theme-toggle"

export function DashboardHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari..."
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DashboardThemeToggle />
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Globe className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
