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
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:border-primary/50 hover:bg-muted/30 transition-all"
                    >
                      <div className="font-hanzi min-w-[2.5rem] shrink-0 whitespace-nowrap text-2xl leading-tight text-foreground">{card.hanzi}</div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <TonePinyin text={card.pinyin || ""} className="text-xs font-medium" />
                        <span className="truncate text-xs text-muted-foreground">{card.arti || ""}</span>
                      </div>
                      <div className="ml-1 flex shrink-0 items-center gap-1">
                        {card.hsk_level && <HskBadge hskLevel={card.hsk_level} />}
                        {card.badge && (
                          <Badge variant="secondary" className="text-[10px]">
                            {card.badge}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleAddCard(card)}
                          disabled={adding}
                          className="shrink-0 h-7 px-2 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Tambah
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Card key={card.id} className="group hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-2xl">{card.hanzi}</CardTitle>
                    {card.pinyin && (
                      <CardDescription className="text-base">{card.pinyin}</CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteCard(card.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-lg font-medium">{card.arti}</div>
                {card.word_class && (
                  <Badge variant="secondary" className="text-xs">
                    {card.word_class}
                  </Badge>
                )}
                {card.catatan && (
                  <div className="text-sm text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                    <BookOpen className="h-3 w-3 inline mr-1" />
                    {card.catatan}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
