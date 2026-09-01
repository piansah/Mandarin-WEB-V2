"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Search, Camera, Loader2, Clock, X, Volume2, ChevronDown, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OCRScanner } from "@/components/ocr-scanner"
import { GlobalWord, SegmentedWord, performSmartSearch, segmentText, initGlobalSearchCache, getWordDetailPath } from "@/lib/hanzi-segmentation"
import { TonePinyin } from "@/components/tone-pinyin"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { speakMandarin } from "@/lib/tts"
import { HskBadge } from "@/components/hsk-badge"

const HISTORY_KEY = "hanzi_search_history"
const HISTORY_LIMIT = 8

function isSentenceQuery(raw: string) {
  const hanziMatches = raw.match(/[\u4e00-\u9fff]/g) ?? []
  return hanziMatches.length > 1
}

export function VocabularyTabs({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = React.useState("deck")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="deck">
          <BookOpen className="h-4 w-4 mr-2" />
          Deck
        </TabsTrigger>
        <TabsTrigger value="search">
          <Search className="h-4 w-4 mr-2" />
          Cari Kosakata
        </TabsTrigger>
      </TabsList>
      <TabsContent value="deck" className="mt-6">
        {activeTab === "deck" && children}
      </TabsContent>
      <TabsContent value="search" className="mt-6">
        {activeTab === "search" && <VocabularySearch />}
      </TabsContent>
    </Tabs>
  )
}

function VocabularySearch() {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<GlobalWord[]>([])
  const [segmented, setSegmented] = React.useState<SegmentedWord[]>([])
  const [isSentenceMode, setIsSentenceMode] = React.useState(false)
  const [isSearching, setIsSearching] = React.useState(false)
  const [showScanner, setShowScanner] = React.useState(false)
  const [searchFilter, setSearchFilter] = React.useState<"all" | "hsk" | "common" | "native">("all")
  const [searchType, setSearchType] = React.useState<"all" | "hanzi" | "pinyin" | "arti">("all")
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [searchHistory, setSearchHistory] = React.useState<string[]>([])
  const historyRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    initGlobalSearchCache()
  }, [])

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HISTORY_KEY)
      const parsed = stored ? JSON.parse(stored) : []
      if (Array.isArray(parsed)) {
        setSearchHistory(parsed.filter((item) => typeof item === "string").slice(0, HISTORY_LIMIT))
      }
    } catch {
      setSearchHistory([])
    }
  }, [])

  React.useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) setHistoryOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsidePress)
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress)
  }, [])

  const handleSearch = React.useCallback(async (q: string, filter: "all" | "hsk" | "common" | "native", type: "all" | "hanzi" | "pinyin" | "arti") => {
    const trimmed = q.trim()
    if (!trimmed) {
      setResults([])
      setSegmented([])
      setIsSentenceMode(false)
      return
    }

    const sentenceMode = isSentenceQuery(trimmed)
    setIsSentenceMode(sentenceMode)
    setIsSearching(true)
    try {
      await initGlobalSearchCache()
      if (sentenceMode) {
        const segs = segmentText(trimmed).filter((s) => s.found)
        setSegmented(segs)
        setResults([])
      } else {
        const data = await performSmartSearch(trimmed, filter, type)
        setResults(data)
        setSegmented([])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSearching(false)
    }
  }, [])

  const saveHistory = React.useCallback((raw: string) => {
    setSearchHistory((current) => {
      const next = [raw, ...current.filter((item) => item !== raw)].slice(0, HISTORY_LIMIT)
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const removeHistoryItem = React.useCallback((raw: string) => {
    setSearchHistory((current) => {
      const next = current.filter((item) => item !== raw)
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    saveHistory(query.trim())
    handleSearch(query.trim(), searchFilter, searchType)
  }

  const handleHistoryClick = (item: string) => {
    setQuery(item)
    handleSearch(item, searchFilter, searchType)
    setHistoryOpen(false)
  }

  const handleFilterChange = (filter: "all" | "hsk" | "common" | "native") => {
    setSearchFilter(filter)
    if (query.trim()) {
      handleSearch(query.trim(), filter, searchType)
    }
  }

  const handleSearchTypeChange = (type: "all" | "hanzi" | "pinyin" | "arti") => {
    setSearchType(type)
    if (query.trim()) {
      handleSearch(query.trim(), searchFilter, type)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-background">
          <OCRScanner
            onClose={() => setShowScanner(false)}
            onWordClick={(hanzi) => {
              setShowScanner(false)
              setQuery(hanzi)
              handleSearch(hanzi, searchFilter, searchType)
            }}
          />
        </div>
      )}

      {/* Search Bar */}
      <div className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari Hanzi, Pinyin, atau Arti..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setHistoryOpen(true)}
            className="pl-9 pr-20"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setQuery("")
                  setResults([])
                  setSegmented([])
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowScanner(true)}
              title="Scan Hanzi dengan Kamera"
            >
              <Camera className="h-3 w-3" />
            </Button>
          </div>

          {/* Search History */}
          {historyOpen && searchHistory.length > 0 && (
            <div
              ref={historyRef}
              className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-md shadow-lg z-10"
            >
              <div className="p-2">
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-xs text-muted-foreground">Riwayat Pencarian</span>
                  <Clock className="h-3 w-3 text-muted-foreground" />
                </div>
                {searchHistory.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleHistoryClick(item)}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded flex items-center justify-between group"
                  >
                    <span>{item}</span>
                    <X
                      className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeHistoryItem(item)
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Filter Dropdowns */}
        <div className="flex gap-2">
          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                {searchFilter === "all" ? "Semua" : searchFilter === "hsk" ? "HSK" : searchFilter === "common" ? "Common" : "Native"}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleFilterChange("all")}>
                Semua
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterChange("hsk")}>
                HSK
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterChange("common")}>
                Common
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterChange("native")}>
                Native
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search Type Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" size="sm" className="gap-2">
                <Search className="h-4 w-4" />
                {searchType === "all" ? "Semua Tipe" : searchType === "hanzi" ? "汉字" : searchType === "pinyin" ? "Pinyin" : "Arti"}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleSearchTypeChange("all")}>
                Semua Tipe
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSearchTypeChange("hanzi")}>
                汉字 (Hanzi)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSearchTypeChange("pinyin")}>
                Pinyin
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSearchTypeChange("arti")}>
                Arti
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Loading State */}
      {isSearching && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!isSearching && !query && results.length === 0 && segmented.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Cari Hanzi, Pinyin, atau arti Bahasa Indonesia</p>
        </div>
      )}

      {/* Results */}
      {!isSearching && (results.length > 0 || segmented.length > 0) && (
        <div className="flex flex-col gap-2">
          {isSentenceMode ? (
            <div className="text-sm text-muted-foreground mb-2">
              Hasil segmentasi kalimat:
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mb-2">
              {results.length} hasil ditemukan
            </div>
          )}

          {(isSentenceMode ? segmented : results).map((item, i) => {
            const hskLevel = 'hsk_level' in item ? (item.hsk_level ?? null) : ('hsk' in item ? (item.hsk ?? null) : null)
            const arti = 'arti' in item ? (item.arti ?? null) : null
            return (
              <VocabularyRow
                key={i}
                item={item}
                index={i}
                hskLevel={hskLevel}
                arti={arti}
                onOpen={() => {
                  const path = getWordDetailPath(item)
                  if (path) router.push(`${path}?from=search`)
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function VocabularyRow({ item, index, hskLevel, arti, onOpen }: { item: GlobalWord | SegmentedWord; index: number; hskLevel: number | null; arti: string | null; onOpen: () => void }) {
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const didHold = React.useRef(false)
  const startPoint = React.useRef({ x: 0, y: 0 })
  const clearPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); pressTimer.current = null }

  React.useEffect(() => clearPress, [])

  const hanzi = item.hanzi
  const pinyin = 'pinyin' in item ? item.pinyin : null

  return <div className="flex cursor-pointer items-center gap-4 rounded-xl border border-border/40 bg-card/40 p-4 transition-colors hover:bg-muted/30" onPointerDown={event => { didHold.current = false; startPoint.current = { x: event.clientX, y: event.clientY }; pressTimer.current = setTimeout(() => { didHold.current = true; if (navigator.vibrate) navigator.vibrate(40); speakMandarin(hanzi) }, 550) }} onPointerMove={event => { const point = startPoint.current; if (Math.abs(event.clientX - point.x) > 18 || Math.abs(event.clientY - point.y) > 18) clearPress() }} onPointerUp={clearPress} onPointerCancel={clearPress} onClick={() => { if (didHold.current) { didHold.current = false; return } onOpen() }}>
    <div className="font-hanzi min-w-[3.5rem] shrink-0 whitespace-nowrap text-3xl leading-tight text-foreground">{hanzi}</div>
    <div className="flex min-w-0 flex-1 flex-col">{pinyin && typeof pinyin === 'string' && <TonePinyin text={pinyin} className="text-sm font-medium" />}{arti && <span className="truncate text-sm text-muted-foreground">{arti}</span>}</div>
    <div className="ml-1 flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); speakMandarin(hanzi) }}
        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Dengar"
      >
        <Volume2 className="h-4 w-4" />
      </button>
      <HskBadge hskLevel={hskLevel === 0 ? undefined : hskLevel} badge={hskLevel === 0 ? "common" : hskLevel === null ? "native" : undefined} />
    </div>
  </div>
}
