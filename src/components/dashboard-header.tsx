"use client"

import { Search, Bell, Moon, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export function DashboardHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari modul, vocab..."
            className="pl-9 h-9 pr-16"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
          <Moon className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full relative">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px]">
            •
          </Badge>
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
          <span className="text-sm font-medium">Aa</span>
        </Button>
        <Button variant="outline" size="sm" className="h-9 gap-1 rounded-full">
          <span className="text-sm font-medium">EN</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
    </header>
  )
}
