"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, Camera, Loader2, Clock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OCRScanner } from "@/components/ocr-scanner"
import { GlobalWord, SegmentedWord, performSmartSearch, segmentText, initGlobalSearchCache, getWordDetailPath } from "@/lib/hanzi-segmentation"
import { TonePinyin } from "@/components/tone-pinyin"
import { HskBadge } from "@/components/hsk-badge"
import { speakMandarin } from "@/lib/tts"

const HISTORY_KEY = "hanzi_search_history"
const HISTORY_LIMIT = 8

function isSentenceQuery(raw: string) {
  const hanziMatches = raw.match(/[\u4e00-\u9fff]/g) ?? []
  return hanziMatches.length > 1
}

export default function HanziPage() {
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

  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(query, searchFilter)
      const clean = query.trim()
      if (clean.length > 0) saveHistory(clean)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, searchFilter, handleSearch, saveHistory])

  const openWord = (hanzi: string) => {
    // If it's a string from OCR
    if (hanzi) {
      handleSearch(hanzi, searchFilter).then(() => {
        // Just let it show in results, or set query
        setQuery(hanzi)
      })
    }
  }

  const openWordDetail = (word: { id?: string | number; set_id?: number; source?: "hsk" | "compound" }) => {
    const path = getWordDetailPath(word)
    if (path) router.push(path)
  }

  const hasQuery = query.trim() !== ""

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/40 p-4">
        <div className="flex items-center gap-3">
          <div ref={historyRef} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari Hanzi, Pinyin, atau Arti..."
              className="w-full h-12 pl-10 pr-12 rounded-2xl bg-muted/50 border border-border/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (!hasQuery) setHistoryOpen(true) }}
            />
            {!hasQuery ? (
              <button
                type="button"
                aria-label="Riwayat pencarian"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                onClick={() => setHistoryOpen((open) => !open)}
              >
                <Clock className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Bersihkan pencarian"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                onClick={() => { setQuery(""); setHistoryOpen(false) }}
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {historyOpen && !hasQuery && searchHistory.length > 0 && (
              <div className="absolute right-0 top-full z-30 mt-2 w-full overflow-hidden rounded-xl border border-border/70 bg-card p-1 shadow-xl shadow-black/20">
                <div className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-primary/70">
                  Pencarian Terakhir
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {searchHistory.map((item) => (
                    <div
                      key={item}
                      role="button"
                      tabIndex={0}
                      className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      onClick={() => {
                        setQuery(item)
                        setHistoryOpen(false)
                      }}
                    >
                      <Clock className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                      <span className="flex-1 truncate">{item}</span>
                      <button
                        type="button"
                        aria-label={`Hapus riwayat ${item}`}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeHistoryItem(item)
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <button 
            onClick={() => setSearchFilter("all")} 
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${searchFilter === "all" ? "bg-[#FDE047] text-black" : "bg-muted/50 text-muted-foreground border border-border/50 hover:bg-muted/80"}`}
          >
            Semua
          </button>
          <button 
            onClick={() => setSearchFilter("hsk")} 
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${searchFilter === "hsk" ? "bg-[#FDE047] text-black" : "bg-muted/50 text-muted-foreground border border-border/50 hover:bg-muted/80"}`}
          >
            HSK
          </button>
          <button 
            onClick={() => setSearchFilter("common")} 
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${searchFilter === "common" ? "bg-[#FDE047] text-black" : "bg-muted/50 text-muted-foreground border border-border/50 hover:bg-muted/80"}`}
          >
            Common
          </button>
          <button 
            onClick={() => setSearchFilter("native")} 
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${searchFilter === "native" ? "bg-[#FDE047] text-black" : "bg-muted/50 text-muted-foreground border border-border/50 hover:bg-muted/80"}`}
          >
            Native
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 pb-28 flex flex-col gap-3">
        {isSearching && (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <span className="text-sm">Mencari...</span>
          </div>
        )}

        {!isSearching && isSentenceMode && (
          segmented.length > 0 ? (
            <>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="text-[11px] font-bold uppercase tracking-widest text-amber-500/80">
                  Konteks Kalimat
                </div>
                <div className="font-hanzi mt-1 text-xl text-amber-400">{query.trim()}</div>
              </div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Kosakata Ditemukan:
              </div>
              {segmented.map((word, i) => (
                <div
                  key={`${word.hanzi}-${i}`}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:border-primary/50 cursor-pointer transition-all"
                  onClick={() => openWordDetail(word)}
                >
                  <div className="font-hanzi min-w-[3.5rem] text-4xl">{word.hanzi}</div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-base font-semibold">
                      <TonePinyin text={word.pinyin || ""} />
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{word.arti}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <HskBadge hskLevel={word.hsk} badge={word.badge} />
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-sm">Tidak ditemukan kosakata pada kalimat ini.</p>
            </div>
          )
        )}

        {!isSearching && !isSentenceMode && hasQuery && results.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-sm">Tidak ditemukan kata yang cocok dengan &quot;{query}&quot;</p>
          </div>
        )}

        {!isSearching && !isSentenceMode && results.map((word, i) => (
          <div
            key={`${word.hanzi}-${i}`}
            className="flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:border-primary/50 cursor-pointer transition-all"
            onClick={() => openWordDetail(word)}
          >
            <div className="font-hanzi min-w-[3.5rem] text-4xl">{word.hanzi}</div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="text-base font-semibold">
                <TonePinyin text={word.pinyin || ""} />
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {word.arti}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); speakMandarin(word.hanzi) }}
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Dengar"
              >
                <Search className="h-3.5 w-3.5 hidden" />
                <span className="text-sm">🔊</span>
              </button>
              <HskBadge hskLevel={word.hsk_level} badge={word.badge} />
            </div>
          </div>
        ))}

        {!isSearching && !hasQuery && (
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