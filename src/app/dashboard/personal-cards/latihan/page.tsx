"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Check, ChevronDown, ListFilter, Play } from "lucide-react"
import { PageLoader } from "@/components/page-loader"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSupabase } from "@/hooks/use-supabase"

type DeckOption = {
  id: number
  title: string
  description: string | null
  hsk_level: number | null
  flashcard_cards: { count: number }[]
}

export default function CustomFlashcardPickerPage() {
  const supa = useSupabase()
  const router = useRouter()
  const [decks, setDecks] = React.useState<DeckOption[]>([])
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set())
  const [selectedLevel, setSelectedLevel] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    async function loadDecks() {
      const { data, error } = await supa
        .from("flashcard_sets")
        .select("id, title, description, hsk_level, flashcard_cards(count)")
        .eq("is_default", true)
        .order("hsk_level", { ascending: true })
        .order("id", { ascending: true })

      if (cancelled) return
      if (error) {
        setLoadError(true)
      } else {
        const loadedDecks = (data ?? []) as DeckOption[]
        setDecks(loadedDecks)
        const firstLevel = loadedDecks
          .map(deck => deck.hsk_level)
          .filter((level): level is number => level !== null)
          .sort((a, b) => a - b)[0]
        setSelectedLevel(firstLevel ?? null)
      }
      setLoading(false)
    }

    void loadDecks()
    return () => { cancelled = true }
  }, [supa])

  const visibleDecks = React.useMemo(() => {
    return decks.filter(deck =>
      (deck.flashcard_cards?.[0]?.count ?? 0) > 0
      && deck.hsk_level === selectedLevel
    )
  }, [decks, selectedLevel])

  const hskLevels = [...new Set(decks.map(deck => deck.hsk_level).filter((level): level is number => level !== null))].sort((a, b) => a - b)
  const levels = [...new Set(visibleDecks.map(deck => deck.hsk_level ?? 0))].sort((a, b) => a - b)
  const selectedDecks = decks.filter(deck => selectedIds.has(deck.id))
  const selectedCardCount = selectedDecks.reduce((total, deck) => total + (deck.flashcard_cards?.[0]?.count ?? 0), 0)

  function toggleDeck(deckId: number) {
    setSelectedIds(current => {
      const next = new Set(current)
      if (next.has(deckId)) next.delete(deckId)
      else next.add(deckId)
      return next
    })
  }

  function startPractice() {
    const ids = decks.filter(deck => selectedIds.has(deck.id)).map(deck => deck.id)
    if (ids.length === 0) return
    router.push(`/dashboard/personal-cards/latihan/sesi?decks=${ids.join(",")}`)
  }

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Latihan Flashcard Custom</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilih deck yang ingin dipelajari. Sesi ini tidak mengubah penilaian atau jadwal review.
          </p>
        </div>
      </div>

      <div className="flex justify-start">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex min-h-9 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring sm:min-w-36">
            <span className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-muted-foreground" />
              {selectedLevel === null ? "Pilih HSK" : `HSK ${selectedLevel}`}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            {hskLevels.map(level => (
              <DropdownMenuItem key={level} onClick={() => setSelectedLevel(level)}>
                HSK {level}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Gagal memuat daftar deck. Muat ulang halaman untuk mencoba lagi.
        </div>
      ) : visibleDecks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {decks.length === 0 ? "Belum ada deck kosakata yang tersedia." : "Deck tidak ditemukan."}
        </div>
      ) : (
        <div className="space-y-6">
          {levels.map(level => {
            const levelDecks = visibleDecks.filter(deck => (deck.hsk_level ?? 0) === level)
            return (
              <section key={level} aria-labelledby={`hsk-level-${level}`}>
                <h2 id={`hsk-level-${level}`} className="mb-3 text-sm font-semibold text-muted-foreground">
                  {level > 0 ? `HSK ${level}` : "Level lainnya"}
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {levelDecks.map(deck => {
                    const selected = selectedIds.has(deck.id)
                    const count = deck.flashcard_cards?.[0]?.count ?? 0
                    return (
                      <button
                        key={deck.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleDeck(deck.id)}
                        className={`flex min-h-20 items-center gap-3 rounded-xl border p-4 text-left transition-colors ${selected ? "border-primary bg-primary/10" : "border-border/50 bg-card hover:border-primary/50"}`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{deck.title}</span>
                          {deck.description && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{deck.description}</span>}
                          <span className="mt-1 block text-xs text-primary">{count} kosakata</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-2xl border border-border/50 bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="px-1 text-sm text-muted-foreground">
          {selectedIds.size} deck dipilih · {selectedCardCount} kosakata
        </p>
        <Button onClick={startPractice} disabled={selectedIds.size === 0 || loadError}>
          <Play className="mr-2 h-4 w-4 fill-current" />
          Mulai latihan
        </Button>
      </div>
    </div>
  )
}
