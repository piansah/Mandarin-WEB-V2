"use client"

import * as React from "react"
import { Search, Camera, ChevronLeft, Loader2, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OCRScanner } from "@/components/ocr-scanner"
import { GlobalWord, performSmartSearch, initGlobalSearchCache } from "@/lib/hanzi-segmentation"
import { TonePinyin } from "@/components/tone-pinyin"

export default function HanziPage() {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<GlobalWord[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [showScanner, setShowScanner] = React.useState(false)
  const [selectedWord, setSelectedWord] = React.useState<GlobalWord | null>(null)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [searchHistory, setSearchHistory] = React.useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = window.localStorage.getItem("hanzi_search_history")
      const parsed = stored ? JSON.parse(stored) : []
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string").slice(0, 8) : []
    } catch {
      return []
    }
  })
  
  React.useEffect(() => {
    initGlobalSearchCache()
  }, [])

  const handleSearch = React.useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setIsSearching(true)
    try {
      const data = await performSmartSearch(q)
      setResults(data)
    } catch (e) {
      console.error(e)
    } finally {
      setIsSearching(false)
    }
  }, [])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(query)
      const clean = query.trim()
      if (clean.length >= 2) {
        setSearchHistory((current) => {
          const next = [clean, ...current.filter((item) => item !== clean)].slice(0, 8)
          window.localStorage.setItem("hanzi_search_history", JSON.stringify(next))
          return next
        })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, handleSearch])

  const openWord = (hanzi: string) => {
    // If it's a string from OCR
    if (hanzi) {
      handleSearch(hanzi).then(() => {
        // Just let it show in results, or set query
        setQuery(hanzi)
      })
    }
  }

  if (selectedWord) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-background">
        <div className="flex items-center gap-4 p-4 border-b border-border/40">
          <Button variant="ghost" size="icon" onClick={() => setSelectedWord(null)}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="font-bold text-lg">Detail Kamus</div>
        </div>
        <div className="flex flex-col items-center justify-center p-12 text-center border-b border-border/40 bg-muted/10">
          <div className="text-7xl font-bold mb-6">{selectedWord.hanzi}</div>
          <div className="text-2xl font-semibold mb-2">
            <TonePinyin text={selectedWord.pinyin || ""} />
          </div>
          <div className="text-lg text-primary max-w-sm">{selectedWord.arti}</div>
          
          <div className="flex gap-2 mt-6">
            {selectedWord.hsk_level && (
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase border border-primary/20">
                HSK {selectedWord.hsk_level}
              </span>
            )}
            {selectedWord.badge && (
              <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-xs font-bold uppercase border border-orange-500/20">
                {selectedWord.badge}
              </span>
            )}
          </div>
        </div>
        
        <div className="p-6">
          <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Informasi Tambahan</div>
          <div className="p-4 rounded-xl border border-border/50 bg-card text-sm text-muted-foreground">
            Fitur detail (Stroke, Komponen, Kalimat) akan segera diintegrasikan.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/40 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Cari hanzi, pinyin, atau arti..." 
              className="w-full h-12 pl-10 pr-12 rounded-2xl bg-muted/50 border border-border/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              aria-label="Riwayat pencarian"
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              onClick={() => setHistoryOpen((open) => !open)}
            >
              <History className="h-4 w-4" />
            </button>
            {historyOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-full max-w-sm overflow-hidden rounded-xl border border-border/70 bg-card p-1 shadow-xl shadow-black/20">
                {searchHistory.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Belum ada riwayat pencarian.</div>
                ) : (
                  searchHistory.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      onClick={() => {
                        setQuery(item)
                        setHistoryOpen(false)
                      }}
                    >
                      {item}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 pb-28 flex flex-col gap-3">
        {isSearching && (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <span className="text-sm">Mencari...</span>
          </div>
        )}

        {!isSearching && query.trim() !== "" && results.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-sm">Tidak ditemukan kata yang cocok dengan &quot;{query}&quot;</p>
          </div>
        )}

        {!isSearching && results.map((word, i) => (
          <div 
            key={`${word.hanzi}-${i}`}
            className="flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:border-primary/50 cursor-pointer transition-all"
            onClick={() => setSelectedWord(word)}
          >
            <div className="text-4xl font-bold min-w-[3.5rem]">{word.hanzi}</div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="text-base font-semibold">
                <TonePinyin text={word.pinyin || ""} />
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {word.arti}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {word.hsk_level && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase border border-primary/20">
                  HSK {word.hsk_level}
                </span>
              )}
              {word.badge && (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase border border-orange-500/20">
                  {word.badge}
                </span>
              )}
            </div>
          </div>
        ))}
        
        {!isSearching && query.trim() === "" && (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground opacity-50 mt-10">
            <Search className="h-12 w-12 mb-4" />
            <p className="text-sm max-w-[200px]">Cari Hanzi, Pinyin, atau arti Bahasa Indonesia</p>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full border-primary/50 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 md:hidden"
        onClick={() => setShowScanner(true)}
        aria-label="Buka kamera OCR"
      >
        <Camera className="h-6 w-6" />
      </Button>

      {showScanner && (
        <OCRScanner 
          onClose={() => setShowScanner(false)} 
          onWordClick={openWord} 
        />
      )}
    </div>
  )
}
