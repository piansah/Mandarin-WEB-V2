"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { listCards, addCard, deleteCard, type PersonalCard } from "@/lib/personal-decks"
import { listDecks, type PersonalDeck } from "@/lib/personal-decks"
import { listThemes, type PersonalTheme } from "@/lib/personal-decks"
import { Plus, Trash2, ArrowLeft, BookOpen, Search, Volume2, X, Languages, Filter, ChevronDown } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TonePinyin } from "@/components/tone-pinyin"
import { HskBadge } from "@/components/hsk-badge"
import { speakMandarin } from "@/lib/tts"
import { performSmartSearch, initGlobalSearchCache, type GlobalWord } from "@/lib/hanzi-segmentation"

type Card = {
  id: number
  hanzi: string
  pinyin: string
  arti: string
  word_class: string | null
  catatan: string | null
  created_at: string
}

export default function DeckDetailPage() {
  const params = useParams()
  const themeId = parseInt(params.themeId as string)
  const deckId = parseInt(params.deckId as string)
  const router = useRouter()
  const supa = useSupabase()

  const [theme, setTheme] = React.useState<PersonalTheme | null>(null)
  const [deck, setDeck] = React.useState<PersonalDeck | null>(null)
  const [cards, setCards] = React.useState<PersonalCard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showAddModal, setShowAddModal] = React.useState(false)

  // Search states
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<GlobalWord[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [searchFilter, setSearchFilter] = React.useState<"all" | "hsk" | "common" | "native">("all")
  const [searchType, setSearchType] = React.useState<"all" | "hanzi" | "pinyin" | "arti">("all")

  const [adding, setAdding] = React.useState(false)

  React.useEffect(() => {
    loadData()
    initGlobalSearchCache()
  }, [themeId, deckId])

  async function loadData() {
    setLoading(true)
    const [themesData, decksData, cardsData] = await Promise.all([
      listThemes(),
      listDecks(themeId),
      listCards(deckId),
    ])
    const currentTheme = themesData.find((t) => t.id === themeId)
    const currentDeck = decksData.find((d) => d.id === deckId)
    setTheme(currentTheme || null)
    setDeck(currentDeck || null)
    setCards(cardsData)
    setLoading(false)
  }

  async function handleAddCard(card: GlobalWord) {
    setAdding(true)
    const result = await addCard(deckId, {
      hanzi: card.hanzi,
      pinyin: card.pinyin || "",
      arti: card.arti || "",
      word_class: card.badge || null,
      catatan: null,
    })
    setAdding(false)
    if (!result.error) {
      setShowAddModal(false)
      setSearchQuery("")
      setSearchResults([])
      loadData()
    } else {
      alert(result.error)
    }
  }

  async function handleSearch(query: string) {
    setSearchQuery(query)

    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)

    try {
      console.log("=== Starting search ===")
      console.log("Query:", query)
      console.log("Search filter:", searchFilter)
      console.log("Search type:", searchType)

      // Use the existing search system from hanzi-segmentation
      const results = await performSmartSearch(query, searchFilter, searchType)

      console.log("Search results from performSmartSearch:", results.length)
      setSearchResults(results)
    } catch (e) {
      console.error("Search error:", e)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  async function handleDeleteCard(id: number) {
    if (!confirm("Yakin ingin menghapus kartu ini?")) return
    const result = await deleteCard(id)
    if (!result.error) {
      loadData()
    } else {
      alert(result.error)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Memuat kartu...</p>
      </div>
    )
  }

  if (!theme || !deck) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Data tidak ditemukan.</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{deck.title}</h1>
          <p className="text-sm text-muted-foreground">{theme.name} · {cards.length} kartu</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="hidden sm:flex">
          <Plus className="h-4 w-4 mr-2" />
          Tambah Kartu
        </Button>
        <Button onClick={() => setShowAddModal(true)} size="icon" className="sm:hidden">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Tambah Kartu Baru</CardTitle>
              <CardDescription>Cari dan tambahkan kosakata dari database</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari kosakata (hanzi, pinyin, atau arti)..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 pr-10"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>

              {/* Filter Dropdowns */}
              <div className="flex gap-2">
                {/* Category Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Languages className="h-4 w-4" />
                      {searchFilter === "all" ? "Semua" : searchFilter === "hsk" ? "HSK" : searchFilter === "common" ? "Common" : "Native"}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => { setSearchFilter("all"); handleSearch(searchQuery); }}>
                      Semua
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSearchFilter("hsk"); handleSearch(searchQuery); }}>
                      HSK
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSearchFilter("common"); handleSearch(searchQuery); }}>
                      Common
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSearchFilter("native"); handleSearch(searchQuery); }}>
                      Native
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Search Type Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Search className="h-4 w-4" />
                      {searchType === "all" ? "Semua Tipe" : searchType === "hanzi" ? "汉字" : searchType === "pinyin" ? "Pinyin" : "Arti"}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => { setSearchType("all"); handleSearch(searchQuery); }}>
                      Semua Tipe
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSearchType("hanzi"); handleSearch(searchQuery); }}>
                      汉字 (Hanzi)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSearchType("pinyin"); handleSearch(searchQuery); }}>
                      Pinyin
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSearchType("arti"); handleSearch(searchQuery); }}>
                      Arti
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Search Results */}
              {isSearching ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm">Mencari...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                  {searchResults.map((card, index) => (
                    <div
                      key={`${card.source}-${card.id}-${index}`}
                      className="flex cursor-pointer items-center gap-4 rounded-xl border border-border/40 bg-card/40 p-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="font-hanzi min-w-[3.5rem] shrink-0 whitespace-nowrap text-3xl leading-tight text-foreground">{card.hanzi}</div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <TonePinyin text={card.pinyin || ""} className="text-sm font-medium" />
                        <span className="truncate text-sm text-muted-foreground">{card.arti || ""}</span>
                      </div>
                      <div className="ml-1 flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); speakMandarin(card.hanzi); }}
                          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          aria-label="Dengar"
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                        {card.hsk_level && <HskBadge hskLevel={card.hsk_level} />}
                        <Button
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleAddCard(card); }}
                          disabled={adding}
                          className="h-7 w-7"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                  <span>Tidak ada hasil ditemukan</span>
                  <span className="text-xs text-muted-foreground">Coba ubah filter atau kata kunci pencarian</span>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  Mulai mencari kosakata untuk ditambahkan
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setShowAddModal(false); setSearchQuery(""); setSearchResults([]); }}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {cards.length === 0 && (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">📝</div>
            <div>
              <h3 className="text-lg font-medium">Belum ada kartu</h3>
              <p className="text-sm text-muted-foreground">Mulai dengan menambahkan kartu kosakata pertama</p>
            </div>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Kartu Pertama
            </Button>
          </div>
        </Card>
      )}

      {/* Cards List */}
      {cards.length > 0 && (
        <div className="flex flex-col gap-2">
          {cards.map((card, index) => (
            <PersonalCardRow
              key={card.id}
              card={card}
              index={index}
              onDelete={() => handleDeleteCard(card.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PersonalCardRow({ card, index, onDelete }: { card: Card; index: number; onDelete: () => void }) {
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const didHold = React.useRef(false)
  const startPoint = React.useRef({ x: 0, y: 0 })
  const clearPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); pressTimer.current = null }

  React.useEffect(() => clearPress, [])

  return (
    <div
      className="flex cursor-pointer items-center gap-4 rounded-xl border border-border/40 bg-card/40 p-4 transition-colors hover:bg-muted/30"
      onPointerDown={event => { didHold.current = false; startPoint.current = { x: event.clientX, y: event.clientY }; pressTimer.current = setTimeout(() => { didHold.current = true; if (navigator.vibrate) navigator.vibrate(40); speakMandarin(card.hanzi) }, 550) }}
      onPointerMove={event => { const point = startPoint.current; if (Math.abs(event.clientX - point.x) > 18 || Math.abs(event.clientY - point.y) > 18) clearPress() }}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
      onClick={() => { if (didHold.current) { didHold.current = false; return } }}
    >
      <div className="font-hanzi min-w-[3.5rem] shrink-0 whitespace-nowrap text-3xl leading-tight text-foreground">{card.hanzi}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TonePinyin text={card.pinyin} className="text-sm font-medium" />
        <span className="truncate text-sm text-muted-foreground">{card.arti}</span>
      </div>
      <div className="ml-1 flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); speakMandarin(card.hanzi) }}
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Dengar"
        >
          <Volume2 className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          aria-label="Hapus"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
