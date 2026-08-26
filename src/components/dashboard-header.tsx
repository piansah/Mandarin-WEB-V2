"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, Bell, PanelLeft, BookOpen, Languages, FileText, X, Home, Layers, BookText, Trophy, Star, User, Settings, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DashboardThemeToggle } from "@/components/dashboard-theme-toggle"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type SearchResult = {
  type: 'page'
  title: string
  description?: string
  url: string
  icon: React.ReactNode
}

const menuItems: SearchResult[] = [
  { type: 'page', title: 'Dashboard', description: 'Halaman utama dashboard', url: '/dashboard', icon: <Home className="h-4 w-4" /> },
  { type: 'page', title: 'Modul', description: 'Daftar modul pembelajaran', url: '/dashboard/modul', icon: <BookOpen className="h-4 w-4" /> },
  { type: 'page', title: 'Grammar', description: 'Materi tata bahasa Mandarin', url: '/dashboard/grammar', icon: <FileText className="h-4 w-4" /> },
  { type: 'page', title: 'Daftar Kata', description: 'Flashcard kosakata', url: '/dashboard/flashcard', icon: <Layers className="h-4 w-4" /> },
  { type: 'page', title: 'Quiz Harian', description: 'Quiz setiap hari', url: '/dashboard/quiz', icon: <Trophy className="h-4 w-4" /> },
  { type: 'page', title: 'Kartu Kumulatif', description: 'Flashcard kumulatif', url: '/dashboard/flashcard/cumulative', icon: <BookText className="h-4 w-4" /> },
  { type: 'page', title: 'Quiz Kumulatif', description: 'Quiz kumulatif', url: '/dashboard/quiz/review', icon: <ClipboardList className="h-4 w-4" /> },
  { type: 'page', title: 'Baca', description: 'Baca cerita Mandarin', url: '/dashboard/cerita', icon: <BookOpen className="h-4 w-4" /> },
  { type: 'page', title: 'Favorit', description: 'Kata favorit Anda', url: '/dashboard/favorit', icon: <Star className="h-4 w-4" /> },
  { type: 'page', title: 'Profile', description: 'Profil pengguna', url: '/dashboard/profile', icon: <User className="h-4 w-4" /> },
  { type: 'page', title: 'Settings', description: 'Pengaturan aplikasi', url: '/dashboard/settings', icon: <Settings className="h-4 w-4" /> },
]

export function DashboardHeader() {
  const { pinned, togglePinned } = useSidebar()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = React.useState(false)
  const searchRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearchOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsidePress)
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress)
  }, [])

  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    const lowerQuery = query.toLowerCase()
    const filtered = menuItems.filter(item =>
      item.title.toLowerCase().includes(lowerQuery) ||
      (item.description && item.description.toLowerCase().includes(lowerQuery))
    )

    setSearchResults(filtered)
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
            placeholder="Cari menu..."
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
                setSearchOpen(false)
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
          {searchOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-md shadow-lg z-50 max-h-96 overflow-auto">
              <div className="p-2">
                {(searchResults.length > 0 ? searchResults : menuItems).map((result, i) => (
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
              </div>
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
