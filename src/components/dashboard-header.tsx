"use client"

import { Search, Bell, PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DashboardThemeToggle } from "@/components/dashboard-theme-toggle"
import { useSidebar } from "@/components/ui/sidebar"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"

export function DashboardHeader() {
  const { pinned, togglePinned } = useSidebar()
  const { language, setLanguage, t } = useLanguage()

  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
      <Button
        type="button"
        onClick={togglePinned}
        className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted"
        aria-label={pinned ? t('header.toggleSidebarUnpin') : t('header.toggleSidebarPin')}
        aria-pressed={pinned}
        title={pinned ? t('header.toggleSidebarUnpin') : t('header.toggleSidebarPin')}
      >
        <PanelLeft className={cn("h-5 w-5", pinned && "text-primary")} />
      </Button>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('header.searchPlaceholder')}
            className="pl-9 h-9 pr-16 w-64"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
        <DashboardThemeToggle />
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full relative">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px]">
            •
          </Badge>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1 rounded-full"
          onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
        >
          <span className="text-sm font-medium">{language.toUpperCase()}</span>
        </Button>
      </div>
    </header>
  )
}
