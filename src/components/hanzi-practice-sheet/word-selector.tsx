"use client"

import * as React from "react"
import { Search, Lock, FolderOpen, Plus, Check, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TonePinyin } from "@/components/tone-pinyin"
import { useSupabase } from "@/hooks/use-supabase"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { performSmartSearch, initGlobalSearchCache } from "@/lib/hanzi-segmentation"
import type { VocabularyWord } from "@/lib/hanzi-map"

type ChapterId = string | number

type WordSelectorProps = {
  unlockedHSK: number[]
  selectedWords: VocabularyWord[]
  onAddFromChapter: (hskLevel: number, chapterId: ChapterId) => void
  onRemoveChapter: (chapterId: ChapterId) => void
  onAddWord: (word: VocabularyWord) => void
  onRemoveWord: (hanzi: string) => void
  onClearAll: () => void
  maxWords: number
}

type Mode = "chapter" | "search"

type Chapter = {
  id: ChapterId
  title: string
  wordCount: number
}

export function WordSelector({
  unlockedHSK,
  selectedWords,
  onAddFromChapter,
  onRemoveChapter,
  onAddWord,
  onRemoveWord,
  onClearAll,
  maxWords,
}: WordSelectorProps) {
  const supa = useSupabase()
  const [mode, setMode] = React.useState<Mode>("chapter")
  const [selectedHsk, setSelectedHsk] = React.useState<number>(1)
  const [chapters, setChapters] = React.useState<Chapter[]>([])
  const [loading, setLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [results, setResults] = React.useState<VocabularyWord[] | null>(null)
  const [searchType, setSearchType] = React.useState<"all" | "hanzi" | "pinyin" | "arti">("all")
  const [searchFilter, setSearchFilter] = React.useState<"all" | "hsk" | "common" | "native">("all")

  const isFull = selectedWords.length >= maxWords

  // Initialize global search cache
  React.useEffect(() => {
    initGlobalSearchCache()
  }, [])

  // Bab yang sudah ditambahkan & kata yang sudah dipilih (diturunkan dari selectedWords,
  // tidak perlu fetch ulang tiap kata berubah)
  const addedChapterIds = React.useMemo(() => {
    const ids = new Set<ChapterId>()
    for (const w of selectedWords) {
      if (w.set_id != null) ids.add(w.set_id)
    }
    return ids
  }, [selectedWords])

  const selectedHanzi = React.useMemo(
    () => new Set(selectedWords.map((w) => w.hanzi)),
    [selectedWords]
  )

  // Ambil daftar bab hanya saat level HSK berubah
  React.useEffect(() => {
    let cancelled = false

    const fetchChapters = async () => {
      setLoading(true)
      try {
        const { data, error } = await supa
          .from("flashcard_sets")
          .select("id, title")
          .eq("hsk_level", selectedHsk)
          .order("sort_order", { ascending: true })

        if (error) throw error
        const sets = data ?? []

        // Hitung kata per bab lewat count (tidak kena batas 1000 baris)
        const counts = await Promise.all(
          sets.map(async (set) => {
            const { count } = await supa
              .from("flashcard_cards")
              .select("id", { count: "exact", head: true })
              .eq("set_id", set.id)
            return count ?? 0
          })
        )

        if (cancelled) return
        setChapters(
          sets.map((set, i) => ({ id: set.id, title: set.title, wordCount: counts[i] }))
        )
      } catch (error) {
        console.error("Error fetching chapters:", error)
        if (!cancelled) setChapters([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchChapters()
    return () => {
      cancelled = true
    }
  }, [selectedHsk, supa])

  const handleChapterToggle = (chapter: Chapter) => {
    if (addedChapterIds.has(chapter.id)) {
      onRemoveChapter(chapter.id)
    } else {
      onAddFromChapter(selectedHsk, chapter.id)
    }
  }

  const handleSearchTypeChange = (type: "all" | "hanzi" | "pinyin" | "arti") => {
    setSearchType(type)
  }

  const handleSearchFilterChange = (filter: "all" | "hsk" | "common" | "native") => {
    setSearchFilter(filter)
  }

  // Re-run search when query or filters change
  React.useEffect(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim()
      setSearching(true)
      performSmartSearch(q, searchFilter, searchType).then((globalResults) => {
        const vocabResults: VocabularyWord[] = globalResults.map((w) => ({
          id: w.id,
          hanzi: w.hanzi,
          pinyin: w.pinyin,
          arti: w.arti,
          source: w.source === "hsk" ? "flashcard" : "compound",
          hsk_level: w.hsk_level,
          set_id: w.set_id,
        }))
        setResults(vocabResults)
        setSearching(false)
      })
    } else {
      setResults(null)
    }
  }, [searchQuery, searchFilter, searchType])

  return (
    <Card className="min-h-[600px] flex flex-col">
      <CardHeader>
        <div className="flex gap-2">
          <Button
            variant={mode === "search" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("search")}
          >
            <Search className="h-4 w-4 mr-2" />
            Cari di kamus
          </Button>
          <Button
            variant={mode === "chapter" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("chapter")}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Ambil dari deck
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {mode === "chapter" && (
          <>
            {/* Chip level HSK */}
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((level) => {
                const isUnlocked = unlockedHSK.includes(level)
                return (
                  <Button
                    key={level}
                    variant={selectedHsk === level ? "default" : "outline"}
                    size="sm"
                    disabled={!isUnlocked}
                    onClick={() => setSelectedHsk(level)}
                    className="rounded-full"
                  >
                    HSK {level}
                    {!isUnlocked && <Lock className="h-3 w-3 ml-1.5" />}
                  </Button>
                )
              })}
            </div>

            {/* Daftar bab */}
            <div className="max-h-[420px] overflow-auto space-y-2 pr-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : chapters.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Tidak ada bab untuk HSK {selectedHsk}
                </p>
              ) : (
                chapters.map((chapter) => {
                  const isAdded = addedChapterIds.has(chapter.id)
                  return (
                    <div
                      key={String(chapter.id)}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{chapter.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {chapter.wordCount} kata
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isAdded ? "destructive" : "default"}
                        onClick={() => handleChapterToggle(chapter)}
                        disabled={(isFull && !isAdded) || chapter.wordCount === 0}
                      >
                        {isAdded ? "Hapus" : "Tambah"}
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {mode === "search" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari hanzi, pinyin, atau arti..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Search Type & Filter */}
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="sm" className="flex-1 gap-2" />}
                >
                  <Filter className="h-3 w-3" />
                  {searchType === "all" ? "Semua" : searchType === "hanzi" ? "Hanzi" : searchType === "pinyin" ? "Pinyin" : "Arti"}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleSearchTypeChange("all")}>Semua</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSearchTypeChange("hanzi")}>Hanzi</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSearchTypeChange("pinyin")}>Pinyin</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSearchTypeChange("arti")}>Arti</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="sm" className="flex-1 gap-2" />}
                >
                  {searchFilter === "all" ? "Semua Sumber" : searchFilter === "hsk" ? "HSK" : searchFilter === "common" ? "Common" : "Native"}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleSearchFilterChange("all")}>Semua Sumber</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSearchFilterChange("hsk")}>HSK</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSearchFilterChange("common")}>Common</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSearchFilterChange("native")}>Native</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="max-h-[420px] overflow-auto space-y-2 pr-1">
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : results === null ? (
                <p className="text-sm text-muted-foreground">
                  Ketik kata untuk mencari, kemudian pilih kata yang mau ditambahkan.
                </p>
              ) : results.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Tidak ada kata yang cocok
                </p>
              ) : (
                results.map((word) => {
                  const added = selectedHanzi.has(word.hanzi)
                  return (
                    <div
                      key={`${word.source}-${word.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border"
                    >
                      <span className="font-hanzi text-xl shrink-0">{word.hanzi}</span>
                      <div className="flex-1 min-w-0">
                        <TonePinyin text={word.pinyin ?? ""} className="text-xs" />
                        <div className="text-sm text-muted-foreground truncate">
                          {word.arti}
                        </div>
                      </div>
                      {word.hsk_level != null && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          HSK {word.hsk_level}
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant={added ? "secondary" : "default"}
                        className="shrink-0"
                        disabled={added || isFull}
                        onClick={() => onAddWord(word)}
                        aria-label={added ? `${word.hanzi} sudah ditambahkan` : `Tambah ${word.hanzi}`}
                      >
                        {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Kata di lembar */}
        <div className="border-t border-border pt-4 mt-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">
              Kata di lembar ini ({selectedWords.length}/{maxWords})
            </h3>
            {selectedWords.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="text-destructive hover:text-destructive"
              >
                Kosongkan
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedWords.map((word) => (
              <Badge 
                key={word.hanzi} 
                variant="secondary" 
                className="cursor-pointer hover:bg-destructive/20 transition-colors"
                onClick={() => onRemoveWord(word.hanzi)}
              >
                <span className="font-hanzi text-lg">{word.hanzi}</span>
              </Badge>
            ))}
            {selectedWords.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada kata yang dipilih</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
