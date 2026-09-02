"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useParams, useRouter } from "next/navigation"
import { ChevronsLeft, Flag, Heart, Plus, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSupabase } from "@/hooks/use-supabase"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Music, Layers, Edit2, ListChecks } from "lucide-react"
import { TonePinyin } from "@/components/tone-pinyin"
import { speakMandarin } from "@/lib/tts"
import { getTone, isHanzi, IDS_LABELS, decompParts } from "@/lib/hanzi-utils"
import { useSidebar } from "@/components/ui/sidebar"
import type { Card, DetailTab, ExampleSentence, CompoundWord, DictionaryEntry, DictionaryMap, DeckMeta } from "./types"
import { ColorPinyin } from "./components"
import { HskBadge } from "@/components/hsk-badge"
import { getUserScoresByType } from "@/lib/user-scores"

const idsLabels = IDS_LABELS

export default function FlashcardDeckPage() {
  const params = useParams()
  const router = useRouter()
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
  const [detailTab, setDetailTab] = React.useState<DetailTab>("kalimat")
  const [examples, setExamples] = React.useState<ExampleSentence[]>([])
  const [compounds, setCompounds] = React.useState<CompoundWord[]>([])
  const [examplesLoading, setExamplesLoading] = React.useState(false)
  const [compoundsLoading, setCompoundsLoading] = React.useState(false)

  // ── Gating "Pilih Latihan": Flashcard -> Quiz -> (Nada & Menulis bareng) ──
  const [flashcardDone, setFlashcardDone] = React.useState(false)
  const [quizDone, setQuizDone] = React.useState(false)

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

      setCards(cardData ?? [])
      setLoading(false)
    }
    load()
  }, [deckId])

  // Status gating untuk modal "Pilih Latihan" — terpisah dari load() di atas
  // supaya tidak ikut nge-block render kartu kalau lambat.
  React.useEffect(() => {
    let cancelled = false
    getUserScoresByType("fc_session").then(scores => {
      if (!cancelled) setFlashcardDone(scores[String(deckId)] !== undefined)
    })

    return () => { cancelled = true }
  }, [deckId, supa])

  // Skor quiz baru bisa dicek setelah tahu deckId
  React.useEffect(() => {
    let cancelled = false
    getUserScoresByType("quiz").then(scores => {
      if (!cancelled) setQuizDone(scores[String(deckId)] !== undefined)
    })
    return () => { cancelled = true }
  }, [deckId])

  const quizUnlocked = flashcardDone
  const postQuizUnlocked = quizDone

  function navigateToPractice(type: string) {
    router.push(`/dashboard/practice/${type}/${deckId}`)
  }

  function navigateToQuiz() {
    router.push(`/dashboard/practice/quiz/${deckId}`)
  }

  function openDetail(card: Card) {
    router.push(`/dashboard/flashcard/${deckId}/word/${card.id}`)
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
      const { data } = await supa
        .from("word_compounds")
        .select("hanzi, pinyin, arti, badge")
        .ilike("hanzi", `%${activeCard.hanzi}%`)
        .limit(30)

      if (cancelled) return
      setCompounds(data ?? [])
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

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

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
        <p className="text-xs text-muted-foreground">{deck?.description}</p>
      </div>

      {/* Card List */}
      <div className="flex flex-col gap-2 px-6 pt-4">
        {cards.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-12">Tidak ada kosakata ditemukan</p>
        )}
        {cards.map((card, i) => (
          <VocabularyRow key={card.id} card={card} index={i} onOpen={openDetail} />
        ))}
      </div>

      {/* Sticky Bottom Bar */}
      <div
        className="fixed bottom-0 right-0 z-30 px-4 pt-4 bg-background/95 backdrop-blur-md border-t border-border/40 transition-[left] duration-200 ease-linear"
        style={{ left: sidebarOffset, paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <Drawer>
          <DrawerTrigger
            render={
              <Button className="flex w-full h-[52px] items-center justify-center whitespace-nowrap rounded-2xl shadow-lg shadow-primary/20 text-base font-bold" />
            }
          >
            Mulai Latihan
          </DrawerTrigger>
          <DrawerContent>
            <div className="mx-auto w-full max-w-sm">
              <DrawerHeader className="text-center pb-2">
                <DrawerTitle className="text-xs tracking-widest text-muted-foreground uppercase">
                  Pilih Latihan
                </DrawerTitle>
              </DrawerHeader>
              <div className="p-4 grid grid-cols-4 gap-2.5">
                <div
                  onClick={() => navigateToPractice("flashcard")}
                  className="flex flex-col items-center justify-center gap-3 p-3 rounded-xl border border-primary/50 bg-primary/5 shadow-sm hover:bg-primary/10 cursor-pointer transition-colors relative"
                >
                  <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Layers className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-center leading-tight">Flashcard</span>
                </div>

                {/* Quiz — kebuka setelah Flashcard selesai */}
                <div
                  onClick={() => { if (quizUnlocked) navigateToQuiz() }}
                  aria-disabled={!quizUnlocked}
                  className={`flex flex-col items-center justify-center gap-3 p-3 rounded-xl border transition-colors relative ${
                    quizUnlocked
                      ? "border-border/50 bg-card hover:bg-muted/50 hover:border-primary/50 cursor-pointer"
                      : "border-border/30 bg-card/40 opacity-55 cursor-not-allowed"
                  }`}
                >
                  <div className="h-11 w-11 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <ListChecks className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-center leading-tight">Quiz</span>
                  {!quizUnlocked && (
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      Selesaikan Flashcard
                    </span>
                  )}
                </div>

                {/* Nada & Menulis — kebuka bareng setelah Quiz selesai */}
                <div
                  onClick={() => { if (postQuizUnlocked) navigateToPractice("nada") }}
                  aria-disabled={!postQuizUnlocked}
                  className={`flex flex-col items-center justify-center gap-3 p-3 rounded-xl border transition-colors ${
                    postQuizUnlocked
                      ? "border-border/50 bg-card hover:bg-muted/50 hover:border-primary/50 cursor-pointer"
                      : "border-border/30 bg-card/40 opacity-55 cursor-not-allowed"
                  }`}
                >
                  <div className="h-11 w-11 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-500">
                    <Music className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-center leading-tight">Latihan Nada</span>
                  {!postQuizUnlocked && (
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">Selesaikan Quiz</span>
                  )}
                </div>

                <div
                  onClick={() => { if (postQuizUnlocked) navigateToPractice("tulis") }}
                  aria-disabled={!postQuizUnlocked}
                  className={`flex flex-col items-center justify-center gap-3 p-3 rounded-xl border transition-colors ${
                    postQuizUnlocked
                      ? "border-border/50 bg-card hover:bg-muted/50 hover:border-primary/50 cursor-pointer"
                      : "border-border/30 bg-card/40 opacity-55 cursor-not-allowed"
                  }`}
                >
                  <div className="h-11 w-11 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <Edit2 className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-center leading-tight">Tulis Hanzi</span>
                  {!postQuizUnlocked && (
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">Selesaikan Quiz</span>
                  )}
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {selectedCard && (
        <WordDetailPortal>
          <WordDetailPanel
            card={selectedCard}
            tab={detailTab}
            examples={examples}
            compounds={compounds}
            examplesLoading={examplesLoading}
            compoundsLoading={compoundsLoading}
            onTabChange={setDetailTab}
            onClose={closeDetail}
            onSpeak={speakMandarin}
            onOpenCard={openDetail}
          />
        </WordDetailPortal>
      )}
    </div>
  )
}

function VocabularyRow({ card, index, onOpen }: { card: Card; index: number; onOpen: (card: Card) => void }) {
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
      onClick={() => { if (didHold.current) { didHold.current = false; return } onOpen(card) }}
    >
      <div className="font-hanzi min-w-[3.5rem] shrink-0 whitespace-nowrap text-3xl leading-tight text-foreground">{card.hanzi}</div>
      <div className="flex min-w-0 flex-1 flex-col"><TonePinyin text={card.pinyin} className="text-sm font-medium" /><span className="truncate text-sm text-muted-foreground">{card.arti}</span></div>
      <div className="ml-1 flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); speakMandarin(card.hanzi) }}
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Dengar"
        >
          <Volume2 className="h-4 w-4" />
        </button>
        <HskBadge hskLevel={card.hsk_level} />
        <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
      </div>
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
  onOpenCard,
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
  onOpenCard: (card: Card) => void
}) {
  const chars = [...card.hanzi].filter(isHanzi)
  const [dictionary, setDictionary] = React.useState<DictionaryMap | null>(null)
  const [dictionaryChecked, setDictionaryChecked] = React.useState(false)
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "kalimat", label: "Sentences" },
    { id: "stroke", label: "Stroke" },
    { id: "karakter", label: "Char" },
    { id: "kata", label: "Word" },
  ]

  React.useEffect(() => {
    if (tab !== "karakter" || dictionary || dictionaryChecked) return

    let cancelled = false
    fetch("/data/dictionary.json")
      .then(res => (res.ok ? res.json() : null))
      .then((data: DictionaryMap | null) => {
        if (cancelled) return
        setDictionary(data)
        setDictionaryChecked(true)
      })
      .catch(() => {
        if (cancelled) return
        setDictionary(null)
        setDictionaryChecked(true)
      })

    return () => {
      cancelled = true
    }
  }, [dictionary, dictionaryChecked, tab])

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
              className={`relative px-2 text-base font-bold tracking-wide transition-colors ${
                active ? "text-[#f4d76d]" : "text-[#686bd6] hover:text-slate-200"
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
            {dictionaryChecked && !dictionary && (
              <div className="text-center text-xs text-slate-600">
                Simpan dictionary di public/data/dictionary.json untuk menampilkan komponen karakter.
              </div>
            )}
          </div>
        )}

        {tab === "kata" && (
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {compoundsLoading && <LoadingLine label="Memuat kata gabungan..." />}
            {!compoundsLoading && compounds.length === 0 && <EmptyLine label="Tidak ada kata gabungan ditemukan." />}
            {compounds.map((word, index) => (
              <button
                key={`${word.hanzi}-${index}`}
                className="flex items-center gap-4 rounded-xl border border-cyan-900/50 bg-[#0b1c2b] p-4 text-left transition-colors hover:border-[#e8c96d]/40"
                onClick={() => onOpenCard({
                  id: card.id,
                  hanzi: word.hanzi,
                  pinyin: word.pinyin ?? "",
                  arti: word.arti ?? "",
                })}
              >
                <span className="font-hanzi min-w-20 text-3xl text-slate-100">{word.hanzi}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    <ColorPinyin text={word.pinyin ?? ""} />
                  </span>
                  <span className="block truncate text-sm text-slate-500">{word.arti}</span>
                </span>
                {word.badge && <span className="rounded-full border border-[#e8c96d]/30 bg-[#e8c96d]/10 px-2 py-1 text-[10px] font-bold uppercase text-[#e8c96d]">{word.badge}</span>}
              </button>
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
