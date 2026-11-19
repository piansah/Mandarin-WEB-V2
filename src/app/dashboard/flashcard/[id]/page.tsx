"use client"

/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/* 
   page.tsx -- Flashcard Deck - Card Browser and Study */

import * as React from "react"
import { PageLoader } from "@/components/page-loader"
import { createPortal } from "react-dom"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { BookOpen, ChevronsLeft, Flag, Heart, MoreHorizontal, Plus, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSupabase } from "@/hooks/use-supabase"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Music, Layers, Edit2, ListChecks, CheckCircle2 } from "lucide-react"
import { TonePinyin } from "@/components/tone-pinyin"
import { speakMandarin } from "@/lib/tts"
import { fetchCharacterDictionary } from "@/lib/character-dictionary"
import { getTone, isHanzi, IDS_LABELS, decompParts } from "@/lib/hanzi-utils"
import { useSidebar } from "@/components/ui/sidebar"
import type { Card, DetailTab, ExampleSentence, CompoundWord, DictionaryEntry, DictionaryMap, DeckMeta } from "./types"
import { ColorPinyin } from "./components"
import { HskBadge } from "@/components/hsk-badge"
import { ReportModal } from "@/components/report-modal"
import { SwipeToReport } from "@/components/swipe-to-report"
import { getDeckPracticeScores, getEstafetPracticeScores } from "@/lib/user-scores"
import { sortRelatedWords } from "@/lib/flashcard-related-words"
import { getWordDetailPath } from "@/lib/hanzi-segmentation"
import { orderNumeralsBeforeTen } from "@/lib/flashcard-order"
import { listFavorites, toggleFavorite } from "@/lib/personal-decks"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type EstafetPracticeSet = {
  key: string
  title: string
  hsk_level: number
  unlock_after: number
}

const idsLabels = IDS_LABELS

function getDetailTab(value: string | null): DetailTab {
  return value === "stroke" || value === "karakter" || value === "kata" ? value : "kalimat"
}

export default function FlashcardDeckPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const deckId = Number(params.id)
  const { pinned, isMobile } = useSidebar()

  // The sidebar floats as an overlay, but when pinned open on desktop it
  // takes up real layout space — offset the fixed footer to match.
  // On mobile the sidebar is always an overlay (Sheet), so the persisted
  // `pinned` cookie must NOT push the footer off-screen there, otherwise
  // this bar collapses to a thin strip pinned to the right edge.
  const sidebarOffset = pinned && !isMobile ? '280px' : '0px'

  const supa = useSupabase()
  const [deck, setDeck] = React.useState<DeckMeta | null>(null)
  const [cards, setCards] = React.useState<Card[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedCard, setSelectedCard] = React.useState<Card | null>(null)
  const [reportCard, setReportCard] = React.useState<Card | null>(null)
  const [detailTab, setDetailTab] = React.useState<DetailTab>(() => getDetailTab(searchParams.get("tab")))
  const [examples, setExamples] = React.useState<ExampleSentence[]>([])
  const [compounds, setCompounds] = React.useState<CompoundWord[]>([])
  const [examplesLoading, setExamplesLoading] = React.useState(false)
  const [compoundsLoading, setCompoundsLoading] = React.useState(false)
  const [isScrolling, setIsScrolling] = React.useState(false)
  const listRef = React.useRef<HTMLDivElement>(null)
  const [favoriteHanZi, setFavoriteHanZi] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    const scrollContainer = listRef.current?.closest(".overflow-auto")
    if (!scrollContainer) return

    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const handleScroll = () => {
      setIsScrolling(true)
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => setIsScrolling(false), 700)
    }

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll)
      if (idleTimer) clearTimeout(idleTimer)
    }
  }, [loading])

  React.useEffect(() => {
    setDetailTab(getDetailTab(searchParams.get("tab")))
  }, [searchParams])

  function handleDetailTabChange(tab: DetailTab) {
    setDetailTab(tab)
    const url = new URL(window.location.href)
    if (tab === "kalimat") url.searchParams.delete("tab")
    else url.searchParams.set("tab", tab)
    router.replace(`${url.pathname}${url.search}`, { scroll: false })
  }

  // ── Gating & Status "Pilih Latihan": Flashcard -> Quiz -> (Nada & Menulis bareng) ──
  const [flashcardDone, setFlashcardDone] = React.useState(false)
  const [quizScore, setQuizScore] = React.useState<number | null>(null)
  const [nadaDone, setNadaDone] = React.useState(false)
  const [tulisDone, setTulisDone] = React.useState(false)
  const [estafetSets, setEstafetSets] = React.useState<EstafetPracticeSet[]>([])
  const [estafetScores, setEstafetScores] = React.useState<Record<string, number | null>>({})

  const quizDone = quizScore !== null
  const quizUnlocked = flashcardDone
  const postQuizUnlocked = quizDone

  const refreshScores = React.useCallback(async () => {
    if (!deckId) return
    const [res, estafetResults] = await Promise.all([
      getDeckPracticeScores(deckId),
      Promise.all(estafetSets.map(async (set) => [set.key, (await getEstafetPracticeScores(set.key)).quizScore] as const)),
    ])
    setFlashcardDone(res.fcDone)
    setQuizScore(res.quizScore)
    setNadaDone(res.nadaDone)
    setTulisDone(res.tulisDone)
    setEstafetScores(Object.fromEntries(estafetResults))
  }, [deckId, estafetSets])

  React.useEffect(() => {
    let cancelled = false
    listFavorites().then((favorites) => {
      if (!cancelled) setFavoriteHanZi(new Set(favorites.map((favorite) => favorite.hanzi)))
    }).catch(() => {
      if (!cancelled) setFavoriteHanZi(new Set())
    })
    return () => { cancelled = true }
  }, [deckId])

  React.useEffect(() => {
    let cancelled = false
    supa
      .from("hanzi_sets")
      .select("key, title, hsk_level, unlock_after")
      .eq("unlock_after", deckId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setEstafetSets((data ?? []) as EstafetPracticeSet[])
      })
    return () => { cancelled = true }
  }, [deckId, supa])

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // Fetch deck meta
      const { data: setData, error: setErr } = await supa
        .from("flashcard_sets")
        .select("title, description")
        .eq("id", deckId)
        .single()

      if (setErr || !setData) {
        setError("Deck tidak ditemukan")
        setLoading(false)
        return
      }
      setDeck(setData)

      // Fetch cards
      const { data: cardData, error: cardErr } = await supa
        .from("flashcard_cards")
        .select("id, hanzi, pinyin, arti")
        .eq("set_id", deckId)
        .order("created_at", { ascending: true })

      if (cardErr) {
        setError("Gagal memuat kartu: " + cardErr.message)
        setLoading(false)
        return
      }

      setCards(orderNumeralsBeforeTen(cardData ?? []))
      setLoading(false)
    }
    load()
  }, [deckId])

  // Status gating untuk modal "Pilih Latihan" — terpisah dari load() di atas
  // supaya tidak ikut nge-block render kartu kalau lambat.
  // Di-refresh juga saat user kembali ke halaman ini setelah latihan selesai.
  React.useEffect(() => {
    refreshScores()

    function handleVisibility() {
      if (document.visibilityState === "visible") refreshScores()
    }
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", refreshScores)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", refreshScores)
    }
  }, [refreshScores])

  function navigateToPractice(type: string) {
    router.push(`/dashboard/practice/${type}/${deckId}`)
  }

  function navigateToQuiz() {
    router.push(`/dashboard/practice/quiz/${deckId}`)
  }

  const practiceTileCount = 4 + estafetSets.length
  const practiceTileRemainder = practiceTileCount % 3
  const practiceTileClass = (index: number): string => {
    if (practiceTileCount === 5 && index === 3) return "col-start-2 md:col-start-2"
    if (practiceTileCount === 5 && index === 4) return "col-start-3 md:col-start-4"
    if (practiceTileRemainder === 1 && index === practiceTileCount - 1) return "md:col-start-3"
    if (practiceTileRemainder === 2 && index === practiceTileCount - 2) return "md:col-start-2"
    if (practiceTileRemainder === 2 && index === practiceTileCount - 1) return "md:col-start-4"
    return ""
  }

  function openDetail(card: Card) {
    router.push(`/dashboard/flashcard/${deckId}/word/${card.id}`)
  }

  async function handleToggleFavorite(card: Card) {
    const wasFavorited = favoriteHanZi.has(card.hanzi)
    const nextFavorites = new Set(favoriteHanZi)
    if (wasFavorited) nextFavorites.delete(card.hanzi)
    else nextFavorites.add(card.hanzi)
    setFavoriteHanZi(nextFavorites)

    try {
      const result = await toggleFavorite({
        hanzi: card.hanzi,
        pinyin: card.pinyin,
        arti: card.arti,
        source: "hsk",
        source_id: Number(card.id),
      })
      if (result.error) throw new Error(result.error)
      setFavoriteHanZi((current) => {
        const updated = new Set(current)
        if (result.isFavorited) updated.add(card.hanzi)
        else updated.delete(card.hanzi)
        return updated
      })
      toast.success(result.isFavorited ? "Ditambahkan ke favorit" : "Dihapus dari favorit")
    } catch (error) {
      setFavoriteHanZi((current) => {
        const updated = new Set(current)
        if (wasFavorited) updated.add(card.hanzi)
        else updated.delete(card.hanzi)
        return updated
      })
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui favorit")
    }
  }

  function closeDetail() {
    setSelectedCard(null)
    setExamples([])
    setCompounds([])
  }

  React.useEffect(() => {
    if (!selectedCard) return

    const activeCard = selectedCard
    let cancelled = false

    async function loadExamples() {
      setExamplesLoading(true)
      const [hanziRes, wordRes] = await Promise.all([
        supa
          .from("hanzi_items")
          .select("id, section_label, hanzi, pinyin, arti")
          .ilike("hanzi", `%${activeCard.hanzi}%`)
          .order("id", { ascending: true })
          .limit(12),
        supa
          .from("word_examples")
          .select("id, hanzi, pinyin, arti")
          .eq("word_hanzi", activeCard.hanzi)
          .order("id", { ascending: true }),
      ])

      if (cancelled) return

      const hskExamples = (hanziRes.data ?? []).map(row => ({
        id: row.id,
        section_label: row.section_label,
        hanzi: row.hanzi,
        pinyin: row.pinyin,
        arti: row.arti,
      }))
      const userExamples = (wordRes.data ?? []).map(row => ({
        id: row.id,
        hanzi: row.hanzi,
        pinyin: row.pinyin,
        arti: row.arti,
      }))

      setExamples([...hskExamples, ...userExamples])
      setExamplesLoading(false)
    }

    loadExamples()

    return () => {
      cancelled = true
    }
  }, [selectedCard])

  React.useEffect(() => {
    if (!selectedCard || detailTab !== "kata") return

    const activeCard = selectedCard
    let cancelled = false

    async function loadCompounds() {
      setCompoundsLoading(true)
      const [compoundRes, cardRes] = await Promise.all([
        supa
          .from("word_compounds")
          .select("id, hanzi, pinyin, arti, badge")
          .ilike("hanzi", `%${activeCard.hanzi}%`)
          .order("frequency", { ascending: false })
          .limit(30),
        supa
          .from("flashcard_cards")
          .select("id, set_id, hanzi, pinyin, arti, flashcard_sets(hsk_level)")
          .ilike("hanzi", `%${activeCard.hanzi}%`)
          .limit(30),
      ])

      if (cancelled) return
      const flashcardWords = (cardRes.data ?? []).map(word => ({
        id: word.id,
        set_id: word.set_id,
        source: "hsk" as const,
        hanzi: word.hanzi,
        pinyin: word.pinyin,
        arti: word.arti,
        badge: word.flashcard_sets?.hsk_level ? `HSK ${word.flashcard_sets.hsk_level}` : null,
      }))
      const compoundWords = (compoundRes.data ?? []).map(word => ({ ...word, source: "compound" as const }))
      const merged = [...flashcardWords, ...compoundWords]
      const unique = new Map(merged.map(word => [`${word.hanzi}\u0000${word.pinyin ?? ""}\u0000${word.arti ?? ""}`, word]))
      setCompounds(sortRelatedWords([...unique.values()], activeCard.hanzi).slice(0, 30))
      setCompoundsLoading(false)
    }

    loadCompounds()

    return () => {
      cancelled = true
    }
  }, [selectedCard, detailTab])

  React.useEffect(() => {
    if (!selectedCard) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedCard])

  if (loading) return <PageLoader />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <Button variant="outline" onClick={() => router.back()}>Kembali</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-28 relative">
      {/* Header sticky */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/40 px-6 py-4">
        <h1 className="text-lg font-bold text-primary truncate">{deck?.title}</h1>
        <p className="text-xs text-muted-foreground">
          {deck?.description} {cards.length > 0 ? `- ${cards.length} kosakata` : ""}
        </p>
      </div>

      {/* Card List */}
      <div ref={listRef} className="mx-auto w-full max-w-6xl px-6 pt-4">
        <div className="flex flex-col gap-2">
          {cards.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-12">Tidak ada kosakata ditemukan</p>
          )}
          {cards.map((card, index) => (
            <SwipeToReport
              key={card.id}
              onFavorite={() => handleToggleFavorite(card)}
              favorited={favoriteHanZi.has(card.hanzi)}
            >
              <VocabularyRow
                card={card}
                count={index + 1}
                isScrolling={isScrolling}
                onSpeak={() => speakMandarin(card.hanzi)}
                onOpen={() => openDetail(card)}
                onReport={() => setReportCard(card)}
              />
            </SwipeToReport>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div
        className="fixed bottom-0 right-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/40 transition-[left] duration-200 ease-linear"
        style={{ left: sidebarOffset, paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-4">
          <Drawer onOpenChange={(open) => { if (open) refreshScores() }} onOpenChangeComplete={(open) => { if (open) refreshScores() }}>
            <DrawerTrigger render={<Button className="w-full" size="lg" />}>
              Mulai Latihan
            </DrawerTrigger>
            <DrawerContent>
              <div className="mx-auto w-full max-w-lg">
                <DrawerHeader className="text-center pb-2">
                  <DrawerTitle className="text-xs tracking-widest text-muted-foreground uppercase">
                    Pilih Latihan
                  </DrawerTitle>
                </DrawerHeader>
                <div className="flex flex-wrap justify-center gap-2 p-3 sm:gap-2.5 sm:p-4 md:grid md:grid-cols-6">
                  {/* Flashcard */}
                  <div
                    onClick={() => navigateToPractice("flashcard")}
                    className={`w-[calc((100%_-_1.5rem)/4)] flex flex-col items-center justify-center gap-2 rounded-xl border p-2 transition-colors relative cursor-pointer md:col-span-2 md:w-auto md:gap-3 md:p-3 ${practiceTileClass(0)} ${flashcardDone
                        ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-sm"
                        : "border-primary/50 bg-primary/5 shadow-sm hover:bg-primary/10"
                      }`}
                  >
                    {flashcardDone ? (
                      <div className="absolute top-2 right-2 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                    ) : (
                      <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary animate-pulse" />
                    )}
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full md:h-11 md:w-11 ${flashcardDone ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                      }`}>
                      <Layers className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <span className="text-center text-[10px] font-semibold leading-tight md:text-xs">Flashcard</span>
                  </div>

                  {/* Quiz — kebuka setelah Flashcard selesai */}
                  <div
                    onClick={() => { if (quizUnlocked) navigateToQuiz() }}
                    aria-disabled={!quizUnlocked}
                    className={`w-[calc((100%_-_1.5rem)/4)] flex flex-col items-center justify-center gap-2 rounded-xl border p-2 transition-colors relative md:col-span-2 md:w-auto md:gap-3 md:p-3 ${practiceTileClass(1)} ${!quizUnlocked
                        ? "border-border/30 bg-card/40 opacity-55 cursor-not-allowed"
                        : quizDone
                          ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-sm cursor-pointer"
                          : "border-border/50 bg-card hover:bg-muted/50 hover:border-primary/50 cursor-pointer"
                      }`}
                  >
                    {quizDone && typeof quizScore === "number" && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                          {quizScore}%
                        </span>
                      </div>
                    )}
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 md:h-11 md:w-11">
                      <ListChecks className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <span className="text-center text-[10px] font-semibold leading-tight md:text-xs">Quiz</span>
                  </div>

                  {estafetSets.map((set, index) => {
                    const unlocked = (quizScore ?? 0) >= 80
                    const estafetScore = estafetScores[set.key]
                    return (
                      <div
                        key={set.key}
                        onClick={() => {
                          if (unlocked) router.push(`/dashboard/flashcard/cumulative/${set.key}`)
                          else toast.error(`Selesaikan quiz deck ini dengan nilai minimal 80% untuk membuka ${set.title}.`)
                        }}
                        aria-disabled={!unlocked}
                        className={`relative w-[calc((100%_-_1.5rem)/4)] flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border p-2 transition-colors md:col-span-2 md:w-auto md:gap-3 md:p-3 ${practiceTileClass(index + 2)} ${unlocked
                          ? "border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10"
                          : "cursor-not-allowed border-border/30 bg-card/40 opacity-55"
                        }`}
                      >
                        {typeof estafetScore === "number" && (
                          <div className="absolute right-2 top-2">
                            <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">
                              {estafetScore}%
                            </span>
                          </div>
                        )}
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/10 text-violet-500 md:h-11 md:w-11">
                          <Layers className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                        <span className="text-center text-[10px] font-semibold leading-tight md:text-xs">Estafet</span>
                      </div>
                    )
                  })}

                  {practiceTileCount === 5 && <div aria-hidden="true" className="h-0 basis-full md:hidden" />}

                  {/* Nada & Menulis — kebuka bareng setelah Quiz selesai */}
                  <div
                    onClick={() => { if (postQuizUnlocked) navigateToPractice("nada") }}
                    aria-disabled={!postQuizUnlocked}
                    className={`relative w-[calc((100%_-_1.5rem)/4)] flex flex-col items-center justify-center gap-2 rounded-xl border p-2 transition-colors md:col-span-2 md:w-auto md:gap-3 md:p-3 ${practiceTileClass(estafetSets.length + 2)} ${!postQuizUnlocked
                        ? "border-border/30 bg-card/40 opacity-55 cursor-not-allowed"
                        : nadaDone
                          ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-sm cursor-pointer"
                          : "border-border/50 bg-card hover:bg-muted/50 hover:border-primary/50 cursor-pointer"
                      }`}
                  >
                    {nadaDone && (
                      <div className="absolute top-2 right-2 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                    )}
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/10 text-violet-500 md:h-11 md:w-11">
                      <Music className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <span className="text-center text-[10px] font-semibold leading-tight md:text-xs">Latihan Nada</span>
                    {!postQuizUnlocked && (
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">Selesaikan Quiz</span>
                    )}
                  </div>

                  <div
                    onClick={() => { if (postQuizUnlocked) navigateToPractice("tulis") }}
                    aria-disabled={!postQuizUnlocked}
                    className={`relative w-[calc((100%_-_1.5rem)/4)] flex flex-col items-center justify-center gap-2 rounded-xl border p-2 transition-colors md:col-span-2 md:w-auto md:gap-3 md:p-3 ${practiceTileClass(estafetSets.length + 3)} ${!postQuizUnlocked
                        ? "border-border/30 bg-card/40 opacity-55 cursor-not-allowed"
                        : tulisDone
                          ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-sm cursor-pointer"
                          : "border-border/50 bg-card hover:bg-muted/50 hover:border-primary/50 cursor-pointer"
                      }`}
                  >
                    {tulisDone && (
                      <div className="absolute top-2 right-2 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                    )}
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 md:h-11 md:w-11">
                      <Edit2 className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <span className="text-center text-[10px] font-semibold leading-tight md:text-xs">Tulis Hanzi</span>
                    {!postQuizUnlocked && (
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">Selesaikan Quiz</span>
                    )}
                  </div>
                </div>
                <DrawerFooter className="pt-0">
                  <DrawerClose render={<Button variant="outline" className="w-full rounded-xl" />}>
                    Kembali
                  </DrawerClose>
                </DrawerFooter>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>

      <ReportModal
        isOpen={reportCard !== null}
        onClose={() => setReportCard(null)}
        contentType="kosakata"
        contentId={reportCard?.id ?? ""}
        contentLabel={reportCard?.hanzi ?? ""}
      />

      {selectedCard && (
        <WordDetailPortal>
          <WordDetailPanel
            card={selectedCard}
            tab={detailTab}
            examples={examples}
            compounds={compounds}
            examplesLoading={examplesLoading}
            compoundsLoading={compoundsLoading}
            onTabChange={handleDetailTabChange}
            onClose={closeDetail}
            onSpeak={speakMandarin}
            onOpenWord={word => {
              const path = getWordDetailPath(word)
              if (path) router.push(path)
            }}
          />
        </WordDetailPortal>
      )}
    </div>
  )
}

function VocabularyRow({
  card,
  count,
  isScrolling,
  onSpeak,
  onOpen,
  onReport,
}: {
  card: Card
  count: number
  isScrolling: boolean
  onSpeak: () => void
  onOpen: () => void
  onReport: () => void
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/40 p-3 transition-colors hover:bg-muted/30 sm:gap-4 sm:p-4"
    >
      <button
        type="button"
        data-bottom-accent="off"
        aria-label={`Dengarkan ${card.hanzi}, kosakata nomor ${count}`}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left sm:gap-4"
        onClick={onSpeak}
      >
        <span className="font-hanzi min-w-[3.5rem] shrink-0 whitespace-nowrap text-3xl leading-tight text-foreground">{card.hanzi}</span>
        <span className="flex min-w-0 flex-1 flex-col"><TonePinyin text={card.pinyin} className="text-sm font-medium" /><span className="truncate text-sm text-muted-foreground">{card.arti}</span></span>
        <HskBadge hskLevel={card.hsk_level} />
      </button>
      {isScrolling ? (
        <span
          className="grid h-9 min-w-9 shrink-0 place-items-center rounded-full px-1 text-[11px] font-medium tabular-nums text-muted-foreground animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none"
          aria-label={`Kosakata ${count}`}
        >
          #{count}
        </span>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                data-bottom-accent="off"
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Menu kosakata ${card.hanzi}`}
                title="Menu kosakata"
              />
            }
          >
            <MoreHorizontal className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="grid w-44 grid-cols-2 gap-1 sm:w-64">
            <DropdownMenuItem onClick={onOpen} className="min-h-16 flex-col justify-center gap-1 px-1.5 py-2 text-center text-xs sm:min-h-20 sm:gap-2 sm:px-2 sm:py-3 sm:text-sm">
              <BookOpen aria-hidden="true" className="size-4 text-primary sm:size-5" />
              <span>Detail</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onReport} className="min-h-16 flex-col justify-center gap-1 px-1.5 py-2 text-center text-xs sm:min-h-20 sm:gap-2 sm:px-2 sm:py-3 sm:text-sm">
              <Flag aria-hidden="true" className="size-4 text-destructive sm:size-5" />
              <span>Laporkan</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function WordDetailPortal({ children }: { children: React.ReactNode }) {
  const mounted = typeof document !== "undefined"

  if (!mounted) return null
  return createPortal(children, document.body)
}

function WordDetailPanel({
  card,
  tab,
  examples,
  compounds,
  examplesLoading,
  compoundsLoading,
  onTabChange,
  onClose,
  onSpeak,
  onOpenWord,
}: {
  card: Card
  tab: DetailTab
  examples: ExampleSentence[]
  compounds: CompoundWord[]
  examplesLoading: boolean
  compoundsLoading: boolean
  onTabChange: (tab: DetailTab) => void
  onClose: () => void
  onSpeak: (text: string) => void
  onOpenWord: (word: CompoundWord) => void
}) {
  const supa = useSupabase()
  const chars = [...card.hanzi].filter(isHanzi)
  const [dictionary, setDictionary] = React.useState<DictionaryMap | null>(null)
  const [dictionaryChecked, setDictionaryChecked] = React.useState(false)
  const [dictionaryKey, setDictionaryKey] = React.useState("")
  const characterKey = [...new Set(chars)].join("|")
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "kalimat", label: "Kalimat" },
    { id: "stroke", label: "Goresan" },
    { id: "karakter", label: "Karakter" },
    { id: "kata", label: "Kata" },
  ]

  React.useEffect(() => {
    if (tab !== "karakter" || (dictionaryChecked && dictionaryKey === characterKey)) return

    let cancelled = false
    setDictionary(null)
    setDictionaryChecked(false)
    fetchCharacterDictionary(supa, characterKey ? characterKey.split("|") : [])
      .then(data => {
        if (cancelled) return
        setDictionary(data)
        setDictionaryKey(characterKey)
        setDictionaryChecked(true)
      })
      .catch(error => {
        console.error("Gagal memuat data karakter:", error)
        if (cancelled) return
        setDictionary({})
        setDictionaryKey(characterKey)
        setDictionaryChecked(true)
      })

    return () => {
      cancelled = true
    }
  }, [characterKey, dictionaryChecked, dictionaryKey, supa, tab])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#07131f] text-slate-100">
      <div className="flex h-[92px] shrink-0 items-center justify-between gap-3 border-b border-[#252636] bg-[#12131b] px-6">
        <div className="min-w-0">
          <div className="font-serif text-2xl font-bold text-[#f4d76d]">Detail Kata</div>
          <div className="truncate text-base text-[#8f90d8]">Flashcard Day</div>
        </div>
        <div className="flex items-center gap-3">
          <Button className="h-9 rounded-full border border-[#e8c96d]/50 bg-[#e8c96d]/10 px-5 text-xs font-bold text-[#f4d76d] hover:bg-[#e8c96d]/20">
            <Plus className="h-3.5 w-3.5" />
            TAMBAH
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl border border-[#252636] bg-[#1a1b2a] text-slate-300 hover:bg-[#222438] hover:text-white" onClick={onClose}>
            <ChevronsLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="relative grid h-14 shrink-0 grid-cols-4 border-b border-[#252636] bg-[#12131b] px-3">
        {tabs.map(item => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              className={`relative px-2 text-base font-bold tracking-wide transition-colors ${active ? "text-[#f4d76d]" : "text-[#686bd6] hover:text-slate-200"
                }`}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
              {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#f4d76d]" />}
            </button>
          )
        })}
      </div>

      <div className="relative shrink-0 border-b border-[#343042] bg-[linear-gradient(135deg,#191a25_0%,#171821_55%,#1c1a12_100%)] px-6 py-8 text-center">
        <div className="absolute left-6 top-4 rounded-lg border border-[#e8c96d]/40 bg-[#e8c96d]/15 px-3 py-1 text-xs font-bold text-[#f4d76d]">
          HSK 1
        </div>
        <div className="absolute right-5 top-4 flex gap-3">
          <button className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2d2d46] bg-[#1b1c30] text-slate-400">
            <Flag className="h-5 w-5" />
          </button>
          <button className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2d2d46] bg-[#1b1c30] text-slate-400">
            <Heart className="h-6 w-6" />
          </button>
        </div>
        <div className="font-hanzi text-7xl leading-none text-slate-100 sm:text-8xl">{card.hanzi}</div>
        <div className="mt-4 text-[22px] font-semibold tracking-wide">
          <ColorPinyin text={card.pinyin || ""} />
        </div>
        <div className="mx-auto mt-2 max-w-xl text-lg font-semibold text-[#e8c96d]">{card.arti}</div>
        <Button variant="ghost" size="sm" className="mt-4 gap-1.5 rounded-full border border-cyan-900/60 bg-[#0b1c2b] px-4 text-slate-200 hover:bg-cyan-950/80" onClick={() => onSpeak(card.hanzi)}>
          <Volume2 className="h-4 w-4" />
          Dengar
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        {tab === "kalimat" && (
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {examplesLoading && <LoadingLine label="Memuat contoh kalimat..." />}
            {!examplesLoading && examples.length === 0 && <EmptyLine label="Belum ada contoh kalimat." />}
            {examples.map(example => (
              <button
                key={`${example.id}-${example.hanzi}`}
                className="rounded-xl border border-cyan-900/50 bg-[#0b1c2b] px-4 py-3 text-left transition-colors hover:border-[#e8c96d]/40"
                onClick={() => example.hanzi && onSpeak(example.hanzi)}
              >
                {example.section_label && (
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                    {example.section_label}
                  </div>
                )}
                <div className="font-hanzi pr-8 text-xl leading-relaxed text-slate-100">{example.hanzi}</div>
                {example.pinyin && (
                  <div className="mt-1 text-sm leading-relaxed">
                    <ColorPinyin text={example.pinyin} />
                  </div>
                )}
                {example.arti && <div className="mt-2 border-t border-cyan-900/50 pt-2 text-sm leading-relaxed text-slate-500">{example.arti}</div>}
              </button>
            ))}
          </div>
        )}

        {tab === "stroke" && (
          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            {chars.map(char => (
              <div key={char} className="rounded-xl border border-cyan-900/50 bg-[#0b1c2b] p-4">
                <StrokePreview char={char} />
              </div>
            ))}
          </div>
        )}

        {tab === "karakter" && (
          <div className="mx-auto flex max-w-none flex-col gap-6">
            {chars.map((char, index) => (
              <CharBreakdown
                key={`${char}-${index}`}
                char={char}
                dictionary={dictionary}
                onSpeak={onSpeak}
              />
            ))}
            {dictionaryChecked && !Object.keys(dictionary ?? {}).length && (
              <div className="text-center text-xs text-slate-600">
                Data karakter belum dapat dimuat dari database.
              </div>
            )}
          </div>
        )}

        {tab === "kata" && (
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {compoundsLoading && <LoadingLine label="Memuat kata gabungan..." />}
            {!compoundsLoading && compounds.length === 0 && <EmptyLine label="Tidak ada kata gabungan ditemukan." />}
            {compounds.map((word, index) => (
              <div
                key={`${word.hanzi}-${index}`}
                className="flex items-center gap-3 rounded-xl border border-cyan-900/50 bg-[#0b1c2b] p-3 transition-colors hover:border-[#e8c96d]/40 sm:gap-4 sm:p-4"
              >
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4" onClick={() => onOpenWord(word)} aria-label={`Buka detail kosakata ${word.hanzi}`}>
                  <span className="font-hanzi min-w-16 text-3xl text-slate-100 sm:min-w-20">{word.hanzi}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      <ColorPinyin text={word.pinyin ?? ""} />
                    </span>
                    <span className="block truncate text-sm text-slate-500">{word.arti}</span>
                  </span>
                </button>
                <div className="flex shrink-0 flex-col items-center gap-1 sm:flex-row sm:gap-2">
                  {word.badge && <span className="rounded-full border border-[#e8c96d]/30 bg-[#e8c96d]/10 px-2 py-1 text-[10px] font-bold uppercase text-[#e8c96d]">{word.badge}</span>}
                  <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white" onClick={() => onSpeak(word.hanzi)} aria-label={`Dengarkan ${word.hanzi}`} title="Dengarkan pelafalan">
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#e8c96d] border-t-transparent" />
      {label}
    </div>
  )
}

function EmptyLine({ label }: { label: string }) {
  return <div className="py-12 text-center text-sm text-slate-500">{label}</div>
}

function CharBreakdown({
  char,
  dictionary,
  onSpeak,
}: {
  char: string
  dictionary: DictionaryMap | null
  onSpeak: (text: string) => void
}) {
  const entry = dictionary?.[char]
  const { ids, label, parts } = decompParts(entry)
  const pinyin = entry?.pinyin?.join(", ") || ""
  const definition = entry?.definition || ""

  return (
    <div className="flex flex-col gap-3">
      <button
        className="rounded-2xl border border-[#252636] bg-[#1a1b25] px-5 py-5 text-left"
        onClick={() => onSpeak(char)}
      >
        <div className="flex items-center gap-6">
          <div className="font-hanzi min-w-20 text-center text-7xl leading-none text-slate-100">{char}</div>
          <div className="min-w-0">
            {pinyin && (
              <div className="text-base font-bold">
                <ColorPinyin text={pinyin} />
              </div>
            )}
            <div className="mt-1 text-base text-[#8585d8]">{definition || "Data karakter belum tersedia"}</div>
            {label && <div className="mt-3 text-sm text-[#e8c96d]">{ids} · {label}</div>}
          </div>
        </div>
        {entry?.etymology?.hint && (
          <div className="mt-5 border-t border-dashed border-[#e8c96d]/20 pt-4 text-sm italic leading-relaxed text-[#a8a8d5]">
            {entry.etymology.hint}
          </div>
        )}
      </button>

      {parts.length > 0 && (
        <>
          <div className="text-center text-sm tracking-wide text-[#686bd6]">↓ komponen</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {parts.map((part, index) => {
              const partEntry = dictionary?.[part]
              const partInfo = decompParts(partEntry)
              return (
                <button
                  key={`${part}-${index}`}
                  className="rounded-xl border border-[#252636] bg-[#1a1b25] px-5 py-4 text-left transition-colors hover:border-[#e8c96d]/40"
                  onClick={() => onSpeak(part)}
                >
                  <div className="flex items-center gap-4">
                    <div className="font-hanzi min-w-14 text-center text-5xl leading-none text-slate-100">{part}</div>
                    <div className="min-w-0">
                      {partEntry?.pinyin && (
                        <div className="text-sm font-bold">
                          <ColorPinyin text={partEntry.pinyin.join(", ")} />
                        </div>
                      )}
                      {partEntry?.definition && (
                        <div className="mt-1 text-sm leading-snug text-[#8585d8]">{partEntry.definition}</div>
                      )}
                    </div>
                  </div>
                  {partEntry?.etymology?.hint && (
                    <div className="mt-3 border-t border-white/5 pt-3 text-xs italic leading-relaxed text-slate-500">
                      {partEntry.etymology.hint}
                    </div>
                  )}
                  {partInfo.parts.length > 0 && (
                    <div className="mt-3 border-t border-white/5 pt-2 text-xs text-[#686bd6]">
                      {partInfo.parts.join(" · ")}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function StrokePreview({ char }: { char: string }) {
  const targetRef = React.useRef<HTMLDivElement>(null)
  const writerRef = React.useRef<{ animateCharacter: () => void } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const target = targetRef.current
    if (!target) return

    target.innerHTML = ""

    import("hanzi-writer").then(({ default: HanziWriter }) => {
      if (cancelled || !targetRef.current) return
      writerRef.current = HanziWriter.create(targetRef.current, char, {
        width: 220,
        height: 220,
        padding: 18,
        strokeColor: "#e8e8f4",
        outlineColor: "#2a2a3e",
        drawingColor: "#e8c96d",
        showOutline: true,
        showCharacter: false,
        strokeAnimationSpeed: 0.8,
        delayBetweenStrokes: 180,
      })
    })

    return () => {
      cancelled = true
      target.innerHTML = ""
    }
  }, [char])

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={targetRef} className="h-[220px] w-[220px]" />
      <Button
        variant="outline"
        size="sm"
        className="rounded-full border-cyan-900/70 bg-[#081522] px-4 text-[#e8c96d] hover:bg-[#102235] hover:text-[#e8c96d]"
        onClick={() => writerRef.current?.animateCharacter()}
      >
        Animasi Stroke
      </Button>
    </div>
  )
}
