"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { X, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { speakMandarin } from "@/lib/tts"
import { TonePinyin } from "@/components/tone-pinyin"
import styles from "./swipe-flashcard-session.module.css"

export type SwipeFlashcard = {
  id: string | number
  hanzi: string
  pinyin: string
  arti: string
  setId?: string | number | null
  srsLevel?: number
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
type SpeechRecognitionResultEventLike = {
  results: {
    0: {
      isFinal: boolean
      0: { transcript: string }
    }
  }
}

function normalizeChinese(str: string) {
  return str.replace(/[，,、。．？?！!；;：:＂"＇'「」『』【】（）()〈〉《》〔〕［］｛｝·\s]/g, "").trim()
}

function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  let curr = new Array(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    [prev, curr] = [curr, prev]
  }
  return prev[n]
}

function getSimilarity(a: string, b: string) {
  if (!a || !b) return 0
  if (a === b) return 100
  const maxLen = Math.max(a.length, b.length)
  const dist = levenshtein(a, b)
  return Math.max(0, Math.round((1 - dist / maxLen) * 100))
}

type SessionStats = { hafal: number; lupa: number; ragu: number }

type SwipeFlashcardSessionProps = {
  cards: SwipeFlashcard[]
  loading?: boolean
  emptyTitle?: string
  emptyEmoji?: string
  wordDetailPath?: (card: SwipeFlashcard) => string | null
  onReview?: (card: SwipeFlashcard, quality: 0 | 3 | 5) => void | Promise<void>
  onComplete?: (stats: SessionStats) => void
}

export function SwipeFlashcardSession({
  cards,
  loading = false,
  emptyTitle = "Belum Ada Kartu",
  emptyEmoji = "📭",
  wordDetailPath,
  onReview,
  onComplete,
}: SwipeFlashcardSessionProps) {
  const router = useRouter()

  const [idx, setIdx] = React.useState(0)
  const [flip, setFlip] = React.useState<0 | 1 | 2>(0)
  const [hafal, setHafal] = React.useState(0)
  const [lupa, setLupa] = React.useState(0)
  const [ragu, setRagu] = React.useState(0)
  const [done, setDone] = React.useState(false)
  const [repeatQueue, setRepeatQueue] = React.useState<SwipeFlashcard[]>([])
  const [dragX, setDragX] = React.useState(0)
  const [dragY, setDragY] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const startX = React.useRef(0)
  const startY = React.useRef(0)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = React.useRef(false)
  const [isRecording, setIsRecording] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{ type: "ok" | "warn" | "err" | "interim"; msg: string; hanzi?: string } | null>(null)
  const recogRef = React.useRef<SpeechRecognitionLike | null>(null)
  const [flyOut, setFlyOut] = React.useState<{ x: number; y: number } | null>(null)
  const [sessionKey, setSessionKey] = React.useState(0)
  const scoreSavedRef = React.useRef(false)

  React.useEffect(() => {
    setIdx(0)
    setFlip(0)
    setHafal(0)
    setLupa(0)
    setRagu(0)
    setDone(false)
    setRepeatQueue([])
    setDragX(0)
    setDragY(0)
    setIsDragging(false)
    setFlyOut(null)
    setFeedback(null)
    scoreSavedRef.current = false
  }, [sessionKey])

  const totalOriginal = cards.length
  const currentTotal = totalOriginal + repeatQueue.length
  const card = idx < totalOriginal ? cards[idx] : repeatQueue[idx - totalOriginal]
  const progress = currentTotal > 0 ? (idx / currentTotal) * 100 : 0

  React.useEffect(() => {
    if (flip === 1 && !isRecording && card?.hanzi) {
      speakMandarin(card.hanzi)
    }
  }, [flip, idx, isRecording, card?.hanzi])

  React.useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }
  }, [])

  React.useEffect(() => {
    if (!done || cards.length === 0 || scoreSavedRef.current) return
    scoreSavedRef.current = true
    onComplete?.({ hafal, lupa, ragu })
  }, [done, cards.length, hafal, lupa, ragu, onComplete])

  function cancelLongPress() {
    if (!longPressTimer.current) return
    clearTimeout(longPressTimer.current)
    longPressTimer.current = null
  }

  function handleCardClick() {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    if (isDragging || dragX > 10 || dragX < -10 || dragY > 10 || dragY < -10) return

    if (flip === 0) {
      setFlip(1)
    } else if (flip === 1) {
      setFlip(2)
    } else if (card) {
      speakMandarin(card.hanzi)
    }
  }

  function animateFlyOutAndAdvance(quality: 0 | 3 | 5, toX: number, toY: number) {
    setIsDragging(false)
    setFlyOut({ x: toX, y: toY })
    setTimeout(() => {
      advance(quality)
      setFlyOut(null)
    }, 250)
  }

  function advance(quality: 0 | 3 | 5) {
    if (!card) return
    onReview?.(card, quality)
    if (quality === 5) setHafal((h) => h + 1)
    else if (quality === 3) setRagu((r) => r + 1)
    else {
      setLupa((l) => l + 1)
      setRepeatQueue((prev) => [...prev, card])
    }

    setDragX(0)
    setDragY(0)
    setFlip(0)
    setFeedback(null)

    if (idx + 1 >= currentTotal + (quality === 0 ? 1 : 0)) {
      setDone(true)
    } else {
      setIdx((i) => i + 1)
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (flyOut || !card) return
    didLongPress.current = false
    startX.current = e.clientX
    startY.current = e.clientY
    setIsDragging(true)
    cardRef.current?.setPointerCapture(e.pointerId)
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      didLongPress.current = true
      setIsDragging(false)
      const href = wordDetailPath?.(card) ?? null
      if (href) router.push(href)
    }, 600)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging || flyOut) return
    const nextDragX = e.clientX - startX.current
    const nextDragY = e.clientY - startY.current

    if (Math.abs(nextDragX) > 10 || Math.abs(nextDragY) > 10) cancelLongPress()

    if (Math.abs(nextDragX) > 14 || Math.abs(nextDragY) > 14) {
      setFlip((currentFlip) => (currentFlip === 2 ? currentFlip : 2))
    }

    setDragX(nextDragX)
    setDragY(nextDragY)
  }

  function onPointerUp() {
    cancelLongPress()
    if (!isDragging || flyOut) return
    const absX = Math.abs(dragX)
    const absY = Math.abs(dragY)

    if (dragY > absX && dragY > 80) {
      animateFlyOutAndAdvance(3, 0, 500)
    } else if (absX > dragY && absX > 80) {
      if (dragX > 0) animateFlyOutAndAdvance(5, 500, 0)
      else animateFlyOutAndAdvance(0, -500, 0)
    } else {
      setDragX(0)
      setDragY(0)
      setIsDragging(false)
    }
  }

  function onPointerCancel() {
    cancelLongPress()
    setDragX(0)
    setDragY(0)
    setIsDragging(false)
  }

  function toggleListen() {
    if (typeof window === "undefined" || !card) return

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!SR) {
      setFeedback({ type: "err", msg: "Browser tidak mendukung. Gunakan Chrome." })
      return
    }

    if (isRecording) {
      recogRef.current?.stop()
      setIsRecording(false)
      return
    }

    setIsRecording(true)
    setFeedback(null)
    const recog = new SR()
    recog.lang = "zh-CN"
    recog.interimResults = true
    recog.maxAlternatives = 1

    recog.onresult = (e) => {
      const result = e.results[0]
      const isFinal = result.isFinal
      const text = result[0].transcript.trim()

      if (!isFinal) {
        setFeedback({ type: "interim", msg: `"${text}" ...` })
        return
      }

      const tNorm = normalizeChinese(text.toLowerCase())
      const hzNorm = normalizeChinese(card.hanzi)

      let bestScore = getSimilarity(tNorm, hzNorm)
      if (hzNorm.includes(tNorm) && tNorm.length / hzNorm.length >= 0.75) {
        bestScore = Math.max(bestScore, 85)
      }

      const displayResult = bestScore >= 60 ? card.hanzi : text

      if (bestScore >= 80) {
        setFeedback({ type: "ok", msg: `✓ Bagus! ${bestScore}% Tepat Sekali!`, hanzi: displayResult })
      } else if (bestScore >= 60) {
        setFeedback({ type: "warn", msg: `${bestScore}% — Hampir Sesuai`, hanzi: displayResult })
      } else {
        setFeedback({ type: "err", msg: `${bestScore}% — HUH WKWK?!`, hanzi: displayResult })
      }
    }

    recog.onerror = () => {
      setFeedback({ type: "err", msg: "Gagal mendengarkan" })
      setIsRecording(false)
    }

    recog.onend = () => {
      setIsRecording(false)
    }

    recogRef.current = recog
    recog.start()
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className="flex flex-1 items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (done || cards.length === 0) {
    return (
      <div className={styles.page}>
        <div className="flashcard-result flex flex-col flex-1 items-center justify-center gap-8 p-8 bg-background">
          <div className="absolute top-4 left-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flashcard-result-emoji text-6xl">{cards.length === 0 ? emptyEmoji : "🎉"}</div>
          <h2 className="flashcard-result-title text-3xl font-bold">{cards.length === 0 ? emptyTitle : "Sesi Selesai!"}</h2>
          {cards.length > 0 && (
            <div className="grid grid-cols-3 gap-4 w-full max-w-md">
              <div className="flashcard-result-stat flex flex-col items-center gap-1 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-3xl font-bold text-emerald-500">{hafal}</span>
                <span className="text-xs text-muted-foreground">Hafal</span>
              </div>
              <div className="flashcard-result-stat flex flex-col items-center gap-1 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <span className="text-3xl font-bold text-amber-500">{ragu}</span>
                <span className="text-xs text-muted-foreground">Ragu</span>
              </div>
              <div className="flashcard-result-stat flex flex-col items-center gap-1 p-5 rounded-2xl bg-red-500/10 border border-red-500/30">
                <span className="text-3xl font-bold text-red-500">{lupa}</span>
                <span className="text-xs text-muted-foreground">Lupa</span>
              </div>
            </div>
          )}
          <div className="flex gap-3 w-full max-w-xs">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => router.back()}>Kembali</Button>
            {cards.length > 0 && (
              <Button className="flex-1 rounded-xl" onClick={() => setSessionKey((k) => k + 1)}>
                Ulangi
              </Button>
            )}
          </div>
          <style dangerouslySetInnerHTML={{ __html: `
            .flashcard-result { animation: fcResultEnter 520ms cubic-bezier(.22,1,.36,1) both; }
            .flashcard-result-emoji { animation: fcResultPop 620ms cubic-bezier(.2,1.4,.4,1) 120ms both; }
            .flashcard-result-title { animation: fcResultRise 420ms cubic-bezier(.22,1,.36,1) 80ms both; }
            .flashcard-result-stat { animation: fcResultRise 420ms cubic-bezier(.22,1,.36,1) both; }
            .flashcard-result-stat:nth-child(2) { animation-delay: 80ms; }
            .flashcard-result-stat:nth-child(3) { animation-delay: 160ms; }
            @keyframes fcResultEnter { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes fcResultPop { 0% { opacity: 0; transform: translateY(10px) scale(.6) rotate(-10deg); } 70% { opacity: 1; transform: translateY(0) scale(1.12) rotate(4deg); } 100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); } }
            @keyframes fcResultRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
          ` }} />
        </div>
      </div>
    )
  }

  if (!card) return null

  let swipeStatus: "none" | "hafal" | "lupa" | "ragu" = "none"
  const absX = Math.abs(dragX)
  const absY = Math.abs(dragY)

  if (isDragging && flip === 2 && (absX > 20 || absY > 20)) {
    if (dragY > absX) {
      swipeStatus = "ragu"
    } else if (absX > dragY) {
      if (dragX > 0) swipeStatus = "hafal"
      else swipeStatus = "lupa"
    }
  }

  const contentOpacity = swipeStatus !== "none" ? 0 : 1
  const cardRotation = dragX * 0.05

  return (
    <div className={styles.page}>
      <div className="flex flex-col flex-1 overflow-hidden select-none bg-background">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0">
            <X className="h-5 w-5" />
          </Button>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm text-muted-foreground font-medium tabular-nums shrink-0">{idx + 1}/{currentTotal}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 relative">
          <div className="relative w-full max-w-sm aspect-[3/4] max-h-[420px] perspective-[800px]">
            <div
              key={idx + "-" + card.id}
              ref={cardRef}
              className={`absolute inset-0 w-full h-full rounded-3xl border border-border bg-card shadow-xl flex flex-col transform-style-3d touch-none ${
                isDragging ? "!transition-none cursor-grabbing" : flyOut ? "transition-all duration-300 ease-out cursor-grabbing" : "transition-transform duration-300 cursor-pointer"
              }`}
              style={{
                transform: flyOut
                  ? `translate(${flyOut.x}px, ${flyOut.y}px) rotate(${flyOut.x * 0.05}deg) rotateY(360deg)`
                  : isDragging
                    ? `translate(${dragX}px, ${dragY}px) rotate(${cardRotation}deg) rotateY(${flip === 0 ? 0 : flip === 1 ? 180 : 360}deg)`
                    : `rotateY(${flip === 0 ? 0 : flip === 1 ? 180 : 360}deg)`,
                opacity: flyOut ? 0 : 1,
              }}
              onClick={handleCardClick}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerCancel={onPointerCancel}
              onPointerUp={onPointerUp}
            >
              <div className="absolute inset-0 backface-hidden rounded-3xl">
                {flip === 2 ? (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-secondary/30 rounded-3xl transition-opacity duration-200"
                    style={{ opacity: contentOpacity }}
                  >
                    <div className="font-hanzi mb-6 text-6xl leading-none text-foreground">{card.hanzi}</div>
                    <TonePinyin text={card.pinyin} className="mb-2 text-2xl font-sans font-medium" />
                    <span className="text-xl font-semibold text-center text-foreground">{card.arti}</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-card rounded-3xl">
                    <div className="font-hanzi text-8xl leading-none text-foreground">{card.hanzi}</div>
                  </div>
                )}
              </div>

              <div className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-8 bg-card rounded-3xl rotate-y-180">
                <div className="font-hanzi mb-6 text-6xl leading-none text-foreground">{card.hanzi}</div>
                <TonePinyin text={card.pinyin} className="text-3xl font-sans font-medium" />
              </div>

              <div
                className={`absolute inset-0 rounded-3xl pointer-events-none flex items-center justify-center text-4xl font-bold tracking-wider z-20 backface-hidden transition-all duration-200 ${swipeStatus !== "none" ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
                style={{
                  background: swipeStatus === "hafal" ? "rgba(26, 122, 74, 0.25)" : swipeStatus === "lupa" ? "rgba(192, 57, 43, 0.25)" : swipeStatus === "ragu" ? "rgba(245, 158, 11, 0.25)" : "transparent",
                  color: swipeStatus === "hafal" ? "#4ade80" : swipeStatus === "lupa" ? "#f87171" : swipeStatus === "ragu" ? "#f59e0b" : "transparent",
                  border: swipeStatus === "hafal" ? "2px solid rgba(74, 222, 128, 0.4)" : swipeStatus === "lupa" ? "2px solid rgba(248, 113, 113, 0.4)" : swipeStatus === "ragu" ? "2px solid rgba(245, 158, 11, 0.4)" : "none",
                  display: flip === 2 ? "flex" : "none",
                }}
              >
                <span className="drop-shadow-lg">
                  {swipeStatus === "hafal" ? "HAFAL ✓" : swipeStatus === "lupa" ? "LUPA ✕" : swipeStatus === "ragu" ? "RAGU ?" : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 mt-2 h-32 w-full max-w-sm">
            {!feedback && (
              <p className="text-xs text-muted-foreground/80 font-medium flex items-center justify-center gap-3 tracking-widest uppercase">
                <span className="text-red-400">← Lupa</span> • <span className="text-amber-500">Ragu ↓</span> • <span className="text-emerald-500">Hafal →</span>
              </p>
            )}

            <div className="flex justify-center w-full">
              <Button
                variant="outline"
                className={`rounded-full h-10 px-6 gap-2 transition-colors border ${isRecording ? "bg-red-500/10 border-red-500/40 text-red-500 hover:bg-red-500/20 hover:text-red-500" : "bg-[#13151f] border-border/40 text-muted-foreground hover:text-foreground"}`}
                onClick={toggleListen}
              >
                <Mic className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
                {isRecording ? "Mendengarkan..." : "Coba Ucapkan"}
              </Button>
            </div>

            {feedback && (
              <div className={`text-center px-4 py-4 rounded-xl border w-full max-w-sm mx-auto shadow-sm ${
                feedback.type === "ok" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                feedback.type === "warn" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                feedback.type === "interim" ? "text-muted-foreground border-transparent" :
                "bg-red-500/10 border-red-500/20 text-red-500"
              }`}>
                <div className="font-medium text-sm">{feedback.msg}</div>
                {feedback.hanzi && <div className="font-hanzi mt-1 text-xl">&quot;{feedback.hanzi}&quot;</div>}
              </div>
            )}
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          .perspective-\\[800px\\] { perspective: 800px; }
          .transform-style-3d { transform-style: preserve-3d; }
          .backface-hidden { backface-visibility: hidden; }
          .rotate-y-180 { transform: rotateY(180deg); }
          .rotate-y-360 { transform: rotateY(360deg); }
        ` }} />
      </div>
    </div>
  )
}
