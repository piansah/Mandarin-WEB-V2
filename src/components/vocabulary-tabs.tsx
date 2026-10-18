"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BookOpen, Search, Camera, Loader2, Clock, X, Volume2, Sparkles, ChevronDown, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"

const OCRScanner = dynamic(() => import("@/components/ocr-scanner").then(mod => mod.OCRScanner), {
  ssr: false,
  loading: () => <div className="p-10 flex justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
})
import { GlobalWord, SegmentedWord, performSmartSearch, segmentText, initGlobalSearchCache, getCachedSearchData, getWordDetailPath } from "@/lib/hanzi-segmentation"
import { TonePinyin } from "@/components/tone-pinyin"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { speakMandarin } from "@/lib/tts"
import { HskBadge } from "@/components/hsk-badge"
import { createClient } from "@/lib/supabase/browser"

const HISTORY_KEY = "hanzi_search_history"
const HISTORY_LIMIT = 8

function isSentenceQuery(raw: string) {
  const hanziMatches = raw.match(/[\u4e00-\u9fff]/g) ?? []
  return hanziMatches.length > 1
}

type RadicalEntry = { character: string; definition: string | null; etymology_hint: string | null; pinyin: unknown; matches: unknown }
const RADICAL_ALIASES: Record<string, string[]> = {
  "氵": ["水"], "冫": ["水"], "忄": ["心"], "扌": ["手"], "艹": ["艸"], "⺮": ["竹"],
  "钅": ["金"], "刂": ["刀"], "讠": ["言"], "纟": ["糸"], "犭": ["犬"], "辶": ["辵"], "灬": ["火"],
}

export function VocabularyTabs({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'search' ? 'search' : 'deck'
  const [activeTab, setActiveTab] = React.useState(initialTab)

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    const url = new URL(window.location.href)
    if (value === 'search') {
      url.searchParams.set('tab', 'search')
    } else {
      url.searchParams.delete('tab')
    }
    router.replace(url.toString())
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false)
  const [searchFilter, setSearchFilter] = React.useState<"all" | "hsk" | "common" | "native">("all")
  const [searchType, setSearchType] = React.useState<"all" | "hanzi" | "pinyin" | "arti">("all")
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [searchHistory, setSearchHistory] = React.useState<string[]>([])
  const [hskLevel, setHskLevel] = React.useState<number | null>(null)
  const [radical, setRadical] = React.useState("")
  const [radicalGroup, setRadicalGroup] = React.useState("Populer")
  const [strokeRange, setStrokeRange] = React.useState("")
  const [radicalQuery, setRadicalQuery] = React.useState("")
  const [radicalEntries, setRadicalEntries] = React.useState<RadicalEntry[] | null>(null)
  const [component, setComponent] = React.useState("")
  const [componentCharacters, setComponentCharacters] = React.useState<string[] | null>(null)
  const [cacheReady, setCacheReady] = React.useState(false)
  const historyRef = React.useRef<HTMLDivElement>(null)
  const supabase = React.useMemo(() => createClient(), [])

  React.useEffect(() => {
    let cancelled = false
    void initGlobalSearchCache().then(() => { if (!cancelled) setCacheReady(true) })
    return () => { cancelled = true }
  }, [supabase])

  React.useEffect(() => {
    let cancelled = false
    if (!radical) { setRadicalEntries(null); return }
    setRadicalEntries(null)
    const canonicalRadicals = [...new Set([radical, ...(RADICAL_ALIASES[radical] ?? [])])]
    Promise.all([
      supabase.from("characters").select("character, definition, etymology_hint, pinyin, matches").in("radical", canonicalRadicals),
      supabase.from("characters").select("character, definition, etymology_hint, pinyin, matches").eq("character", radical).maybeSingle(),
    ]).then(([matchesResult, detailResult]) => {
      if (cancelled) return
      if (matchesResult.error) { setRadicalEntries([]); return }
      const entries = [...(matchesResult.data ?? [])]
      if (detailResult.data && !entries.some(entry => entry.character === radical)) entries.push(detailResult.data)
      setRadicalEntries(entries)
    })
    return () => { cancelled = true }
  }, [radical, supabase])

  React.useEffect(() => {
    let cancelled = false
    if (!component) { setComponentCharacters(null); return }
    supabase.from("character_components").select("character").eq("component", component).then(({ data, error }) => {
      if (cancelled) return
      setComponentCharacters(error ? [] : [...new Set((data ?? []).map(row => row.character))])
    })
    return () => { cancelled = true }
  }, [component, supabase])

  const radicalCharacters = React.useMemo(() => {
    if (!radicalEntries) return null
    if (!strokeRange) return radicalEntries.map(entry => entry.character)
    return radicalEntries.filter(entry => {
      const count = Array.isArray(entry.matches) ? entry.matches.length : 0
      if (strokeRange === "1-5") return count >= 1 && count <= 5
      if (strokeRange === "6-9") return count >= 6 && count <= 9
      if (strokeRange === "10-14") return count >= 10 && count <= 14
      return count >= 15
    }).map(entry => entry.character)
  }, [radicalEntries, strokeRange])
  const activeFacets = Boolean(hskLevel || radical || strokeRange || component || searchFilter !== "all")
  const filtersLoading = (activeFacets && !cacheReady) || (Boolean(radical) && radicalEntries === null) || (Boolean(component) && componentCharacters === null)
  const visibleResults = React.useMemo(() => {
    const source = results.length || query.trim() ? results : (activeFacets && cacheReady ? getCachedSearchData() : [])
    return source.filter(word => {
      if (hskLevel && word.hsk_level !== hskLevel) return false
      if (searchFilter === "hsk" && word.source !== "hsk") return false
      if (searchFilter === "common" && word.badge !== "common") return false
      if (searchFilter === "native" && !(word.badge === "native" || (word.source === "compound" && !word.badge))) return false
      const chars = [...word.hanzi]
      if (radical && radicalCharacters && !chars.some(char => radicalCharacters.includes(char))) return false
      if (component && componentCharacters && !chars.some(char => componentCharacters.includes(char))) return false
      return true
    })
  }, [activeFacets, cacheReady, component, componentCharacters, hskLevel, query, radical, radicalCharacters, results, searchFilter])

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

  const radicalGroups = [
    { label: "Populer", items: ["一", "丨", "丶", "丿", "乙", "亅", "二", "十", "八", "人", "口", "亻", "木", "心", "日", "水", "女", "手"] },
    { label: "Manusia & tubuh", items: ["人", "亻", "儿", "大", "女", "子", "尸", "心", "小", "忄", "手", "扌", "又", "寸", "比", "毛", "民", "父", "母", "口", "牙", "目", "见", "皮", "而", "耳", "肉", "月", "臣", "自", "舌", "血", "立", "疒", "老", "身", "足", "面", "首", "页", "骨", "鼻", "门", "巴", "士"] },
    { label: "Air, api & langit", items: ["水", "氵", "冫", "冰", "雨", "风", "日", "月", "夕", "川", "火", "灬", "气"] },
    { label: "Tumbuhan & alam", items: ["木", "艹", "竹", "⺮", "禾", "米", "麦", "麻", "瓜", "豆", "生", "田", "土", "山", "石", "里"] },
    { label: "Hewan", items: ["牛", "犬", "犭", "马", "羊", "鸟", "隹", "鱼", "虫", "豕", "鹿", "虎", "角", "鼠", "龙", "羽"] },
    { label: "Gerakan & arah", items: ["辶", "走", "彳", "行", "止", "入", "夂", "攵", "支", "女", "廴", "之", "至"] },
    { label: "Benda & bangunan", items: ["金", "钅", "玉", "王", "贝", "厂", "刀", "刂", "斤", "戈", "矛", "矢", "弓", "父", "户", "门", "宀", "广", "高", "口", "山", "瓦", "缶", "白", "片", "巾", "糸", "纟", "网", "皿", "舟", "车", "酉"] },
    { label: "Bahasa, angka & garis", items: ["言", "讠", "音", "文", "日", "一", "二", "十", "八", "丶", "丨", "丿", "亅", "卜"] },
    { label: "Abstrak & lainnya", items: ["力", "厶", "卜", "厂", "小", "心", "己", "巳", "幺", "曰", "彡", "支", "无", "尤", "夕", "玄", "文", "甘", "白", "示", "礻", "肉", "艮", "色", "西", "面", "采", "辛", "青", "非", "食", "香", "鬼", "黄", "黑", "齐", "乙", "七", "长"] },
  ]
  const currentRadicalGroup = radicalGroups.find(group => group.label === radicalGroup) ?? radicalGroups[0]
  const allDummyRadicals = [...new Set(radicalGroups.flatMap(group => group.items))]
  const filteredRadicals = allDummyRadicals.filter(item => {
    const matchesGroup = radicalQuery.trim() || currentRadicalGroup.items.includes(item)
    return matchesGroup && (!radicalQuery || item.includes(radicalQuery.trim()))
  })
  const setRadicalValue = (value: string) => {
    setRadical(value)
    setComponent("")
    setRadicalQuery("")
  }
  const selectedRadicalEntry = radicalEntries?.find(entry => entry.character === radical)
  const selectedRadicalPinyin = Array.isArray(selectedRadicalEntry?.pinyin)
    ? selectedRadicalEntry.pinyin.filter((value): value is string => typeof value === "string").join(", ")
    : ""
  const filterLabel = searchFilter === "all" ? "Semua" : searchFilter === "hsk" ? "HSK" : searchFilter === "common" ? "Common" : "Native"
  const typeLabel = searchType === "all" ? "Semua tipe" : searchType === "hanzi" ? "Hanzi" : searchType === "pinyin" ? "Pinyin" : "Arti"
  const levelLabel = hskLevel === null ? "Semua" : `HSK ${hskLevel}`
  const activeFilterCount = [hskLevel !== null, searchFilter !== "all", searchType !== "all", Boolean(radical), Boolean(strokeRange), Boolean(component)].filter(Boolean).length
  const filterPanel = (
    <div className="space-y-5">
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Level HSK</h2>
          <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8 min-w-28 justify-between gap-2" />}>{levelLabel}<ChevronDown className="h-3.5 w-3.5" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setHskLevel(null)}>Semua level</DropdownMenuItem>{[1, 2, 3, 4, 5, 6].map(level => <DropdownMenuItem key={level} onClick={() => setHskLevel(level)}>HSK {level}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
        </div>
        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Sumber kosakata</h2>
          <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8 min-w-28 justify-between gap-2" />}>{filterLabel}<ChevronDown className="h-3.5 w-3.5" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => handleFilterChange("all")}>Semua</DropdownMenuItem><DropdownMenuItem onClick={() => handleFilterChange("hsk")}>HSK</DropdownMenuItem><DropdownMenuItem onClick={() => handleFilterChange("common")}>Common</DropdownMenuItem><DropdownMenuItem onClick={() => handleFilterChange("native")}>Native</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Cari berdasarkan</h2>
          <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8 min-w-28 justify-between gap-2" />}>{typeLabel}<ChevronDown className="h-3.5 w-3.5" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => handleSearchTypeChange("all")}>Semua tipe</DropdownMenuItem><DropdownMenuItem onClick={() => handleSearchTypeChange("hanzi")}>Hanzi</DropdownMenuItem><DropdownMenuItem onClick={() => handleSearchTypeChange("pinyin")}>Pinyin</DropdownMenuItem><DropdownMenuItem onClick={() => handleSearchTypeChange("arti")}>Arti</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </section>
      <section className="border-t border-border/70 pt-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Filter lanjutan</h2>{activeFilterCount > 0 && <button type="button" onClick={() => { setHskLevel(null); setRadical(""); setStrokeRange(""); setComponent(""); setRadicalQuery(""); setSearchFilter("all"); setSearchType("all") }} className="text-xs text-primary hover:underline">Reset</button>}</div>
        <label htmlFor="radical-search" className="mb-2 block text-sm font-medium">Radikal</label>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="radical-search" value={radicalQuery} onChange={event => setRadicalQuery(event.target.value)} placeholder="Cari radikal karakter" className="h-10 rounded-xl pl-9" /></div>
        <div className="mt-3 flex flex-wrap gap-2">{radicalGroups.map(group => <button type="button" key={group.label} onClick={() => { setRadicalGroup(group.label); setRadicalQuery("") }} className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${radicalGroup === group.label ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>{group.label}</button>)}</div>
        <div className="mt-3 grid grid-cols-6 gap-1.5">{filteredRadicals.slice(0, 48).map(item => <button type="button" key={item} title={`Pilih radikal ${item}`} aria-pressed={radical === item} onClick={() => { setRadicalValue(radical === item ? "" : item); setStrokeRange("") }} className={`aspect-square rounded-lg text-lg transition-colors ${radical === item ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-primary/10"}`}>{item}</button>)}</div>
        {filteredRadicals.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Radikal tidak ditemukan pada kategori ini.</p>}
        {radical && selectedRadicalEntry && <div className="mt-3 rounded-xl border border-border/70 bg-background/70 p-3"><div className="flex items-center gap-2"><span className="font-hanzi text-3xl">{radical}</span><span className="text-sm font-semibold">{selectedRadicalPinyin}</span><span className="text-sm text-muted-foreground">{selectedRadicalEntry.definition ?? "Radikal"}</span></div>{selectedRadicalEntry.etymology_hint && <p className="mt-2 text-xs text-muted-foreground">{selectedRadicalEntry.etymology_hint}</p>}</div>}
        <div className="mt-4"><h3 className="mb-2 text-sm font-medium">Jumlah goresan</h3><div className="grid grid-cols-4 gap-1.5">{["1-5", "6-9", "10-14", "15+"].map(range => <button type="button" key={range} disabled={!radical} aria-pressed={strokeRange === range} onClick={() => setStrokeRange(strokeRange === range ? "" : range)} className={`rounded-lg px-2 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${strokeRange === range ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-primary/10"}`}>{range}</button>)}</div></div>
        <label htmlFor="component-search" className="mb-2 mt-5 block text-sm font-medium">Komponen karakter</label>
        <Input id="component-search" value={component} onChange={event => { setComponent(event.target.value.trim()); if (event.target.value) setRadical("") }} placeholder="Ketik 1 komponen, cth: 人 口 木" className="h-10 rounded-xl" maxLength={1} />
      </section>
    </div>
  )

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-background">
          <OCRScanner
            onClose={() => setShowScanner(false)}
            onScanComplete={(text) => {
              // Close scanner and set text to search bar
              setShowScanner(false)
              setQuery(text)
              saveHistory(text)
              handleSearch(text, searchFilter, searchType)
            }}
          />
        </div>
      )}

      <aside className="sticky top-4 hidden rounded-2xl border border-border/70 bg-card p-4 shadow-sm lg:block">
        {filterPanel}
      </aside>

      <main className="flex min-w-0 flex-col gap-4">
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
            className="h-12 rounded-full bg-card px-11 pr-24 text-base shadow-sm"
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
        {(radical || strokeRange) && <div className="flex flex-wrap gap-2">
          {radical && <button type="button" onClick={() => { setRadical(""); setStrokeRange("") }} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15">Radikal {radical}{selectedRadicalEntry?.definition ? ` · ${selectedRadicalEntry.definition}` : ""}<X className="h-3 w-3" /></button>}
          {strokeRange && <button type="button" onClick={() => setStrokeRange("")} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15">Goresan {strokeRange}<X className="h-3 w-3" /></button>}
        </div>}
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <Button type="button" variant="outline" className="w-fit gap-2 lg:hidden" onClick={() => setMobileFiltersOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground">{activeFilterCount}</span>}
          </Button>
          <SheetContent side="bottom" showCloseButton className="max-h-[88dvh] gap-0 rounded-t-2xl bg-card p-0 lg:hidden">
            <SheetHeader className="border-b border-border/70 pr-12">
              <SheetTitle>Filter pencarian</SheetTitle>
              <SheetDescription>Atur level, sumber kosakata, atau filter karakter.</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{filterPanel}</div>
            <SheetFooter className="border-t border-border/70 bg-card">
              <Button type="button" className="w-full" onClick={() => setMobileFiltersOpen(false)}>Terapkan filter</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Loading State */}
      {(isSearching || filtersLoading) && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!isSearching && !filtersLoading && !query && visibleResults.length === 0 && segmented.length === 0 && (
        <div className="flex flex-col gap-3">
          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Cari arti kata</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ketik Hanzi, pinyin dengan atau tanpa nada, atau arti Indonesia. Pilih level untuk melihat kosakata yang tersedia.</p>
            <div className="mt-3 flex flex-wrap gap-2">{["你好", "wo", "makan", "谢谢", "jia"].map(example => <button type="button" key={example} onClick={() => { setQuery(example); saveHistory(example); handleSearch(example, searchFilter, searchType) }} className="rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5">{example}</button>)}</div>
          </section>
          {!activeFacets && <div className="flex min-h-40 flex-col items-center justify-center py-8 text-center"><Sparkles className="mb-3 h-9 w-9 text-muted-foreground/70" /><p className="text-sm text-muted-foreground">Mulai dengan kata contoh atau buka filter untuk menyaring kosakata</p></div>}
        </div>
      )}

      {!isSearching && !filtersLoading && activeFacets && visibleResults.length === 0 && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Tidak ada kosakata yang cocok dengan filter ini.</div>}

      {/* Results */}
      {!isSearching && !filtersLoading && (visibleResults.length > 0 || segmented.length > 0) && (
        <div className="flex flex-col gap-2">
          {isSentenceMode ? (
            <div className="text-sm text-muted-foreground mb-2">
              Hasil segmentasi kalimat:
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mb-2">
              {visibleResults.length} hasil ditemukan
            </div>
          )}

          {(isSentenceMode ? segmented : visibleResults).map((item, i) => {
            const hskLevel = 'hsk_level' in item ? (item.hsk_level ?? null) : ('hsk' in item ? (item.hsk ?? null) : null)
            const arti = 'arti' in item ? (item.arti ?? null) : null
            return (
              <VocabularyRow
                key={i}
                item={item}
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
      </main>
    </div>
  )
}

function VocabularyRow({ item, hskLevel, arti, onOpen }: { item: GlobalWord | SegmentedWord; hskLevel: number | null; arti: string | null; onOpen: () => void }) {
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
