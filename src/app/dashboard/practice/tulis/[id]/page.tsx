"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { X, RotateCcw, Eye, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/browser"

type Card = { id: number; hanzi: string; pinyin: string; arti: string; originalWord: string }

function speakHanzi(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = "zh-CN"
  utt.rate = 0.8
  window.speechSynthesis.speak(utt)
}

export default function TulisHanziPage() {
  const params = useParams()
  const router = useRouter()
  const deckId = Number(params.id)

  const [cards, setCards] = React.useState<Card[]>([])
  const [loading, setLoading] = React.useState(true)
  const [idx, setIdx] = React.useState(0)
  const [done, setDone] = React.useState(false)
  const [correct, setCorrect] = React.useState(0)
  const [writerReady, setWriterReady] = React.useState(false)
  const [strictMode, setStrictMode] = React.useState(false)
  const [hintPlaying, setHintPlaying] = React.useState(false)
  const [mistakeCount, setMistakeCount] = React.useState(0)

  const writerRef = React.useRef<any>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const strictModeRef = React.useRef(false)
  const mistakeRef = React.useRef(0)
  const cancelledRef = React.useRef(false)
  const idxRef = React.useRef(0)
  const totalRef = React.useRef(0)

  React.useEffect(() => {
    async function load() {
      const supa = createClient()
      const { data } = await supa
        .from("flashcard_cards")
        .select("id, hanzi, pinyin, arti")
        .eq("set_id", deckId)
        .order("created_at", { ascending: true })
      const parsed: Card[] = []
      for (const c of data ?? []) {
        for (const char of [...c.hanzi]) {
          const code = char.charCodeAt(0)
          if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) {
            parsed.push({ id: c.id, hanzi: char, pinyin: c.pinyin, arti: c.arti, originalWord: c.hanzi })
          }
        }
      }
      setCards(parsed)
      totalRef.current = parsed.length
      setLoading(false)
    }
    load()
  }, [deckId])

  const card = cards[idx]
  const total = cards.length
  const progress = total > 0 ? (idx / total) * 100 : 0

  function startQuiz(writer: any, currentCard: Card) {
    if (!writer) return
    mistakeRef.current = 0
    setMistakeCount(0)

    writer.quiz({
      onMistake: () => {
        if (strictModeRef.current) {
          mistakeRef.current += 1
          setMistakeCount(mistakeRef.current)
          if (mistakeRef.current >= 3) {
            mistakeRef.current = 0
            setMistakeCount(0)
            initWriter(currentCard)
          }
        }
      },
      onCorrectStroke: () => {
        mistakeRef.current = 0
        setMistakeCount(0)
      },
      onComplete: () => {
        if (cancelledRef.current) return
        speakHanzi(currentCard.originalWord)
        setTimeout(() => {
          if (cancelledRef.current) return
          setCorrect(c => c + 1)
          const nextIdx = idxRef.current + 1
          if (nextIdx >= totalRef.current) setDone(true)
          else setIdx(nextIdx)
        }, 1200)
      },
    })
  }

  function initWriter(currentCard: Card) {
    if (!containerRef.current) return
    setWriterReady(false)
    setHintPlaying(false)
    containerRef.current.innerHTML = ""
    mistakeRef.current = 0
    setMistakeCount(0)

    const targetDiv = document.createElement("div")
    containerRef.current.appendChild(targetDiv)

    import("hanzi-writer").then(({ default: HanziWriter }) => {
      if (cancelledRef.current || !containerRef.current) return

      const writer = HanziWriter.create(targetDiv, currentCard.hanzi, {
        width: 260,
        height: 260,
        padding: 26,
        strokeColor: "#e8e8f4",
        outlineColor: strictModeRef.current ? "rgba(0,0,0,0)" : "#2a2a3e",
        drawingColor: "#4ade80",
        drawingWidth: 6,
        showOutline: !strictModeRef.current,
        showCharacter: false,
        highlightOnComplete: true,
        highlightColor: "#4ade80",
      })
      writerRef.current = writer
      setWriterReady(true)
      startQuiz(writer, currentCard)
    })
  }

  React.useEffect(() => {
    idxRef.current = idx
    if (!cards[idx]?.hanzi || !containerRef.current || loading) return
    cancelledRef.current = false
    initWriter(cards[idx])
    return () => { cancelledRef.current = true }
  }, [cards[idx]?.hanzi, idx, loading])

  function handleClear() {
    if (!card) return
    initWriter(card)
  }

  function handleHint() {
    if (!writerRef.current || hintPlaying) return
    setHintPlaying(true)
    writerRef.current.animateCharacter({
      onComplete: () => {
        setHintPlaying(false)
        if (writerRef.current && card) startQuiz(writerRef.current, card)
      },
    })
  }

  function handleStrictMode() {
    const next = !strictMode
    setStrictMode(next)
    strictModeRef.current = next
    if (card) initWriter(card)
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (done || total === 0) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-8 p-8">
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="text-6xl">{total === 0 ? "📭" : "✍️"}</div>
        <h2 className="text-3xl font-bold">{total === 0 ? "Belum Ada Kartu" : "Latihan Selesai!"}</h2>
        {total > 0 && (
          <div className="flex flex-col items-center gap-1 p-6 rounded-2xl bg-primary/10 border border-primary/30">
            <span className="text-4xl font-bold text-primary">{correct}</span>
            <span className="text-sm text-muted-foreground">Karakter Selesai</span>
          </div>
        )}
        <div className="flex gap-3 w-full max-w-xs">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => router.back()}>Kembali</Button>
          {total > 0 && (
            <Button className="flex-1 rounded-xl" onClick={() => { setIdx(0); setDone(false); setCorrect(0) }}>
              🔀 Ulangi
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0">
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-sm text-muted-foreground font-medium tabular-nums shrink-0">{idx + 1}/{total}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
        {/* Info kartu */}
        <div className="flex flex-col items-center gap-1 pb-3 text-center">
          <span className="text-3xl font-bold text-foreground">{card.originalWord}</span>
          <span className="text-lg text-primary font-medium">{card.pinyin}</span>
          <span className="text-base text-muted-foreground">{card.arti}</span>
        </div>

        {/* Canvas */}
        <div className="relative rounded-3xl border-2 border-border/50 bg-card/60 p-3 shadow-xl">
          <div ref={containerRef} className="w-[260px] h-[260px]" />
          {!writerReady && (
            <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-card">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
          )}
          {strictMode && (
            <div className="absolute top-3 right-3 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
              STRICT
            </div>
          )}
          {strictMode && mistakeCount > 0 && (
            <div className="absolute top-3 left-3 flex gap-1">
              {[1, 2, 3].map(n => (
                <div key={n} className={`h-2.5 w-2.5 rounded-full ${mistakeCount >= n ? "bg-red-500" : "bg-muted"}`} />
              ))}
            </div>
          )}
        </div>

        {/* 3 Control Buttons */}
        <div className="flex w-full items-center justify-center pt-4" style={{ gap: "18px" }}>
          <button
            onClick={handleClear}
            title="Ulangi karakter ini"
            aria-label="Ulangi karakter ini"
            className="flex aspect-square h-14 min-h-14 w-14 min-w-14 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground shadow-sm transition-all hover:border-primary/50 hover:text-foreground active:scale-95"
          >
            <RotateCcw className="h-6 w-6" />
          </button>

          <button
            onClick={handleHint}
            disabled={hintPlaying || !writerReady}
            title="Tampilkan panduan animasi"
            aria-label="Tampilkan panduan animasi"
            className={`flex aspect-square h-14 min-h-14 w-14 min-w-14 shrink-0 items-center justify-center rounded-full border shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              hintPlaying
                ? "border-primary/60 bg-primary/20 text-primary"
                : "border-border/60 bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            <Eye className="h-6 w-6" />
          </button>

          <button
            onClick={handleStrictMode}
            title="Strict Mode"
            aria-label="Strict Mode"
            className={`flex aspect-square h-14 min-h-14 w-14 min-w-14 shrink-0 items-center justify-center rounded-full border shadow-sm transition-all active:scale-95 ${
              strictMode
                ? "border-amber-500/60 bg-amber-500/20 text-amber-400"
                : "border-border/60 bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            <Shield className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  )
}
