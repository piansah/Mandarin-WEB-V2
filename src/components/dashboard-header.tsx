"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, Bell, PanelLeft, BookOpen, Languages, FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DashboardThemeToggle } from "@/components/dashboard-theme-toggle"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { performSmartSearch, initGlobalSearchCache, getWordDetailPath } from "@/lib/hanzi-segmentation"
import { createClient } from "@/lib/supabase/browser"

type SearchResult = {
  type: 'module' | 'vocabulary' | 'grammar' | 'hanzi' | 'quiz'
  title: string
  description?: string
  url: string
  icon: React.ReactNode
}

export function DashboardHeader() {
  const { pinned, togglePinned } = useSidebar()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const searchRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    initGlobalSearchCache()
  }, [])

  React.useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearchOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsidePress)
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress)
  }, [])

  const handleSearch = React.useCallback(async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results: SearchResult[] = []

      // Search vocabulary/hanzi
      await initGlobalSearchCache()
      const hanziResults = await performSmartSearch(query, "all")
      hanziResults.slice(0, 10).forEach(word => {
        const path = getWordDetailPath(word)
        if (path) {
          results.push({
            type: 'hanzi',
            title: word.hanzi,
            description: word.arti || '',
            url: path,
            icon: <Languages className="h-4 w-4" />
          })
        }
      })

      setSearchResults(results)
    } catch (e) {
      console.error(e)
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleResultClick = (result: SearchResult) => {
    setSearchOpen(false)
    setSearchQuery("")
    setSearchResults([])
    router.push(result.url)
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
      <Button
        type="button"
        onClick={togglePinned}
        variant="ghost"
        className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted"
        aria-label={pinned ? "Lepas kunci sidebar" : "Kunci sidebar tetap terbuka"}
        aria-pressed={pinned}
        title={pinned ? "Lepas kunci sidebar" : "Kunci sidebar tetap terbuka"}
      >
        <PanelLeft className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari modul, vocab..."
            value={searchQuery}
            onChange={(e) => {
              handleSearch(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            className="pl-9 h-9 pr-16 w-64"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("")
                setSearchResults([])
              }}
              className="absolute right-10 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>

          {/* Search Results Dropdown */}
          {searchOpen && (searchResults.length > 0 || isSearching) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-md shadow-lg z-50 max-h-96 overflow-auto">
              {isSearching ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Mencari...
                </div>
              ) : (
                <div className="p-2">
                  {searchResults.map((result, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleResultClick(result)}
                      className="w-full text-left p-3 hover:bg-muted rounded-md flex items-start gap-3 transition-colors"
                    >
                      <div className="mt-0.5 text-muted-foreground">
                        {result.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{result.title}</div>
                        {result.description && (
                          <div className="text-sm text-muted-foreground truncate">{result.description}</div>
                        )}
                      </div>
                    </button>
                  ))}
                  {searchResults.length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Tidak ada hasil ditemukan
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <DashboardThemeToggle />
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full relative">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px]">
            •
          </Badge>
        </Button>
      </div>
    </header>
  )
}
