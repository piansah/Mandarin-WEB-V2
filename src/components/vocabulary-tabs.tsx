"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Search, Camera, Loader2, Clock, X, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OCRScanner } from "@/components/ocr-scanner"
import { GlobalWord, SegmentedWord, performSmartSearch, segmentText, initGlobalSearchCache, getWordDetailPath } from "@/lib/hanzi-segmentation"
import { TonePinyin } from "@/components/tone-pinyin"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { speakMandarin } from "@/lib/tts"

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

  const handleSearch = React.useCallback(async (q: string, filter: "all" | "hsk" | "common" | "native") => {
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
        const data = await performSmartSearch(trimmed, filter)
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
    handleSearch(query.trim(), searchFilter)
  }

  const handleHistoryClick = (item: string) => {
    setQuery(item)
    handleSearch(item, searchFilter)
    setHistoryOpen(false)
  }

  const handleFilterChange = (filter: "all" | "hsk" | "common" | "native") => {
    setSearchFilter(filter)
    if (query.trim()) {
      handleSearch(query.trim(), filter)
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
              handleSearch(hanzi, searchFilter)
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

        {/* Filter Buttons */}
        <div className="flex gap-2">
          {[
            { value: "all", label: "Semua" },
            { value: "hsk", label: "HSK" },
            { value: "common", label: "Common" },
            { value: "native", label: "Native" },
          ].map((filter) => (
            <Button
              key={filter.value}
              type="button"
              variant={searchFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange(filter.value as any)}
            >
              {filter.label}
            </Button>
          ))}
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
        <div className="flex flex-col gap-3">
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
            const hskLevel = 'hsk_level' in item ? item.hsk_level : ('hsk' in item ? item.hsk : null)
            const arti = 'arti' in item ? item.arti : null
            return (
              <Card
                key={i}
                className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all cursor-pointer"
                onClick={() => {
                  const path = getWordDetailPath(item)
                  if (path) router.push(path)
                }}
                onPointerDown={() => {
                  if (item.pinyin && typeof item.pinyin === 'string') {
                    speakMandarin(item.pinyin)
                  }
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
                    Kata
                  </Badge>
                  {hskLevel && (
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
                      HSK {hskLevel}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-bold">{item.hanzi}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (item.pinyin && typeof item.pinyin === 'string') {
                          speakMandarin(item.pinyin)
                        }
                      }}
                      className="ml-auto h-6 w-6 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      <Volume2 className="h-3 w-3" />
                    </button>
                  </div>
                  {item.pinyin && typeof item.pinyin === 'string' && (
                    <TonePinyin text={item.pinyin} className="text-sm text-muted-foreground mb-2" />
                  )}
                  {arti && <p className="text-sm">{arti}</p>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
