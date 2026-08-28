"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { X, List, TrendingUp, Star, CheckCircle2, ChevronLeft, EyeOff, SkipForward, Eye, Zap, Brain, HelpCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { speakMandarin } from "@/lib/tts"
import { TonePinyin } from "@/components/tone-pinyin"
import { useSupabase } from "@/hooks/use-supabase"
import { WORD_CLASS_LABELS } from "@/lib/hanzi-utils"
import { previewIntervalDays } from "@/lib/srs"
import styles from "./swipe-flashcard-session.module.css"

export type SwipeFlashcard = {
  id: string | number
  hanzi: string
  pinyin: string
  arti: string
  setId?: string | number | null
  srsLevel?: number
  exampleSentence?: string
  examplePinyin?: string
  exampleTranslation?: string
  deckTitle?: string
  deckHskLevel?: number
  // Kode mentah dari kolom `word_class` tabel flashcard_cards (mis. "verb",
  // "adj", "num", "noun", "classifier", "particle", "adv", "prefix",
  // "meas"). Diperluas jadi label lengkap lewat WORD_CLASS_LABELS —
  // sama seperti yang dipakai di halaman detail kosakata.
  wordClass?: string
  // true jika user belum pernah membuat progress review untuk kartu ini
  // (tidak ada baris di user_card_progress), dipakai untuk badge "Kartu Baru".
  isNew?: boolean
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

function formatIntervalDays(days: number) {
  return days === 1 ? "1 hari" : `${days} hari`
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

// Label "HSK {level} - {word_class}" + badge "Kartu Baru" di pojok atas
// setiap sisi kartu (card 1, 2, dan 3).
function CardTopBar({ card }: { card: SwipeFlashcard }) {
  // Sama seperti di halaman detail kosakata: kode mentah ("adj", "noun",
  // dst.) diperluas jadi label lengkap ("Adjektiva · 形容词 (xíngróngcí)").
  // Kalau kodenya belum ada di WORD_CLASS_LABELS, tampilkan apa adanya
  // supaya tidak hilang begitu saja.
  const wordClassLabel = card.wordClass
    ? WORD_CLASS_LABELS[card.wordClass] ?? card.wordClass
    : undefined

  const levelLabel = card.deckHskLevel
    ? wordClassLabel
      ? `HSK ${card.deckHskLevel} - ${wordClassLabel}`
      : `HSK ${card.deckHskLevel}`
    : wordClassLabel ?? ""

  if (!levelLabel && !card.isNew) return null

  return (
    <div className="absolute top-2 left-3 right-3 sm:top-3 sm:left-4 sm:right-4 flex items-start justify-between gap-2 z-10 pointer-events-none">
      <span className="text-[9px] sm:text-[11px] font-medium text-muted-foreground tracking-wide bg-background/50 backdrop-blur-sm px-1.5 py-0.5 sm:px-2 rounded-full truncate">
        {levelLabel}
      </span>
      {card.isNew && (
        <span className="text-[9px] sm:text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 sm:px-2 rounded-full shrink-0">
          Kartu Baru
        </span>
      )}
    </div>
  )
}

// Hint "klik kartu / tekan space" — hanya dipakai di card 1 (depan) dan
// card 2 (belakang, hanzi+pinyin), sesuai referensi.
function CardHint() {
  return (
    <p className="mt-3 sm:mt-4 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-muted-foreground/80 text-center px-4">
      <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
      Klik kartu atau tekan Space untuk lihat jawaban
    </p>
  )
}

type SessionStats = { hafal: number; lupa: number; ragu: number; sulit: number }
type SessionHeaderStats = { dueToday: number; totalCards: number; accuracy: number; mastered: number; rated: number }

type SwipeFlashcardSessionProps = {
  cards: SwipeFlashcard[]
  loading?: boolean
  emptyTitle?: string
  emptyEmoji?: string
  wordDetailPath?: (card: SwipeFlashcard) => string | null
  onReview?: (card: SwipeFlashcard, quality: 0 | 3 | 4 | 5) => void | Promise<void>
  onComplete?: (stats: SessionStats) => void
  deckTitle?: string
  deckLevel?: string
  userId?: string | null
  disableSwipe?: boolean
  isFastMode?: boolean
  deckCardIds?: string[] // For filtering stats by deck
}

export function SwipeFlashcardSession({
  cards,
  loading = false,
  emptyTitle = "Belum Ada Kartu",
  emptyEmoji = "📭",
  wordDetailPath,
  onReview,
  onComplete,
  deckTitle = "Kartu Hafalan",
  deckLevel = "Level A1",
  userId,
  disableSwipe = false,
  isFastMode = false,
  deckCardIds,
}: SwipeFlashcardSessionProps) {
  const router = useRouter()
  const supa = useSupabase()

  const [idx, setIdx] = React.useState(0)
  const [flip, setFlip] = React.useState<0 | 1 | 2>(0)
  const [hafal, setHafal] = React.useState(0)
  const [lupa, setLupa] = React.useState(0)
  const [ragu, setRagu] = React.useState(0)
  const [sulit, setSulit] = React.useState(0)
  const [done, setDone] = React.useState(false)
  const [sessionMastered, setSessionMastered] = React.useState(0)
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
  const [headerStats, setHeaderStats] = React.useState<SessionHeaderStats>({
    dueToday: 0,
    totalCards: 0,
    accuracy: 0,
    mastered: 0,
    rated: 0,
  })
  const [selectedRating, setSelectedRating] = React.useState<0 | 3 | 4 | 5 | null>(null)
  // Nilai yang sedang dianimasikan untuk ring akurasi di layar "Sesi
  // Selesai" — naik dari 0 ke akurasi final begitu sesi selesai, lalu
  // di-reset ke 0 saat sesi baru dimulai (lihat effect di bawah dan
  // effect reset sessionKey).
  const [resultRingValue, setResultRingValue] = React.useState(0)
  const prefersReducedMotionRef = React.useRef(false)

  React.useEffect(() => {
    prefersReducedMotionRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  React.useEffect(() => {
    setIdx(0)
    setFlip(0)
    setHafal(0)
    setLupa(0)
    setRagu(0)
    setSulit(0)
    setDone(false)
    setRepeatQueue([])
    setDragX(0)
    setDragY(0)
    setIsDragging(false)
    setFlyOut(null)
    setFeedback(null)
    scoreSavedRef.current = false
    setSelectedRating(null)
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
    onComplete?.({ hafal, lupa, ragu, sulit })
  }, [done, cards.length, hafal, lupa, ragu, sulit, onComplete])

  // Animasikan ring akurasi di layar "Sesi Selesai" begitu sesi tuntas.
  // hafal/sulit/ragu/lupa sudah final di render yang sama dengan
  // done=true (semuanya di-set dalam satu advance() sebelum idx terakhir),
  // jadi aman dipakai langsung sebagai dependency tanpa animasi
  // ke-trigger ulang saat kartu masih berjalan.
  React.useEffect(() => {
    if (!done || cards.length === 0) {
      setResultRingValue(0)
      return
    }
    const total = hafal + sulit + ragu + lupa
    const target = total > 0 ? Math.round(((hafal + sulit) / total) * 100) : 0

    if (prefersReducedMotionRef.current) {
      setResultRingValue(target)
      return
    }

    setResultRingValue(0)
    let raf = 0
    const start = performance.now()
    const duration = 900
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setResultRingValue(Math.round(eased * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    const delay = setTimeout(() => { raf = requestAnimationFrame(tick) }, 150)
    return () => { clearTimeout(delay); if (raf) cancelAnimationFrame(raf) }
  }, [done, cards.length, hafal, sulit, ragu, lupa])

  // Override pointer events when swipe is disabled
  React.useEffect(() => {
    if (disableSwipe && cardRef.current) {
      // Keep pointer events for clicking but disable drag
      cardRef.current.style.touchAction = 'none'
    } else if (cardRef.current) {
      cardRef.current.style.touchAction = 'auto'
    }
  }, [disableSwipe])

  // Dukungan tombol Space: sama seperti klik kartu, membalik dari card 1 ->
  // 2 -> 3. Diabaikan saat sedang fokus di input/textarea, saat kartu
  // sedang fly-out, atau saat sesi sudah selesai.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return
      const target = e.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return
      if (!card || flyOut || done) return
      if (flip === 2) return
      e.preventDefault()
      setFlip((f) => (f === 0 ? 1 : f === 1 ? 2 : f))
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [flip, flyOut, done, card])

  // Dukungan keyboard untuk tombol rating (mode tidak-cepat saja, sesuai
  // hint "1-4 nilai · ← → navigasi"): angka 1-4 menilai langsung kartu yang
  // sedang tampil (1=Lupa, 2=Sulit, 3=Ingat, 4=Mudah), sementara ← / →
  // meniru tombol Sebelumnya / Lewati.
  React.useEffect(() => {
    if (isFastMode) return
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return
      if (!card || flyOut || done) return

      if (e.key === "1") { e.preventDefault(); setSelectedRating(0); advance(0); return }
      if (e.key === "2") { e.preventDefault(); setSelectedRating(3); advance(3); return }
      if (e.key === "3") { e.preventDefault(); setSelectedRating(4); advance(4); return }
      if (e.key === "4") { e.preventDefault(); setSelectedRating(5); advance(5); return }
      if (e.key === "ArrowLeft") { e.preventDefault(); goToPrevious(); return }
      if (e.key === "ArrowRight") { e.preventDefault(); skipCard(); return }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isFastMode, card, flyOut, done, idx])

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
    }
    // At flip === 2 (detail view with example sentence), tapping the card
    // no longer speaks the vocab hanzi — that caused it to fight with the
    // example sentence's own speaker button/tap. Use the dedicated
    // speaker buttons instead.
  }

  React.useEffect(() => {
    async function fetchHeaderStats() {
      if (!userId) return
      const today = new Date().toISOString().slice(0, 10)

      // Fetch due today - cards that need review today
      const { data: dueData } = await supa
        .from("user_card_progress")
        .select("card_id")
        .eq("user_id", userId)
        .lte("next_review", today)

      // Filter by deck if deckCardIds provided
      const filteredDueData = deckCardIds
        ? dueData?.filter(d => deckCardIds.includes(String(d.card_id))) ?? []
        : dueData ?? []

      // Calculate total cards in current session
      const totalCardsInSession = cards.length

      // Calculate session accuracy (correct ratings / total ratings)
      const totalRatings = hafal + sulit + ragu + lupa
      const accuracy = totalRatings > 0 ? Math.round(((hafal + sulit) / totalRatings) * 100) : 0

      // Fetch mastered cards (srs_level >= 5)
      const { data: masteredData } = await supa
        .from("user_card_progress")
        .select("id, card_id")
        .eq("user_id", userId)
        .gte("srs_level", 5)

      // Filter by deck if deckCardIds provided
      const filteredMasteredData = deckCardIds
        ? masteredData?.filter(d => deckCardIds.includes(String(d.card_id))) ?? []
        : masteredData ?? []

      setHeaderStats({
        dueToday: filteredDueData.length,
        totalCards: totalCardsInSession,
        accuracy: accuracy,
        mastered: sessionMastered + filteredMasteredData.length,
        rated: hafal + sulit + ragu + lupa,
      })
    }
    fetchHeaderStats()
  }, [userId, cards.length, hafal, sulit, ragu, lupa, supa, deckCardIds])

  function cancelLongPress() {
    if (!longPressTimer.current) return
    clearTimeout(longPressTimer.current)
    longPressTimer.current = null
  }



  function animateFlyOutAndAdvance(quality: 0 | 3 | 4 | 5, toX: number, toY: number) {
    setIsDragging(false)
    setFlyOut({ x: toX, y: toY })
    setTimeout(() => {
      advance(quality)
      setFlyOut(null)
    }, 250)
  }

  function advance(quality: 0 | 3 | 4 | 5) {
    if (!card) return
    onReview?.(card, quality)
    if (quality === 5) setHafal((h) => h + 1)
    else if (quality === 4) setSulit((s) => s + 1)
    else if (quality === 3) setRagu((r) => r + 1)
    else {
      setLupa((l) => l + 1)
      setRepeatQueue((prev) => [...prev, card])
    }

    setDragX(0)
    setDragY(0)
    setFlip(0)
    setFeedback(null)
    setSelectedRating(null)

    // Update stats for real-time accuracy calculation
    setHeaderStats(prev => ({
      ...prev,
      rated: prev.rated + 1,
      mastered: quality === 5 ? prev.mastered + 1 : prev.mastered,
    }))
    setSessionMastered(prev => quality === 5 ? prev + 1 : prev)

    if (idx + 1 >= currentTotal + (quality === 0 ? 1 : 0)) {
      setDone(true)
    } else {
      setIdx((i) => i + 1)
    }
  }

  function goToPrevious() {
    if (idx === 0) return
    setDragX(0)
    setDragY(0)
    setFlip(0)
    setFeedback(null)
    setSelectedRating(null)
    setIdx((i) => Math.max(0, i - 1))
  }

  function hideAnswer() {
    setFlip(0)
    setFeedback(null)
    setSelectedRating(null)
  }

  function skipCard() {
    if (!card) return
    setDragX(0)
    setDragY(0)
    setFlip(0)
    setFeedback(null)
    setSelectedRating(null)

    if (idx + 1 >= currentTotal) {
      setDone(true)
    } else {
      setIdx((i) => i + 1)
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (flyOut || !card) return
    // Don't start a drag/long-press when the tap originates from an
    // interactive control inside the card (e.g. the vocab speaker button,
    // or the example-sentence speaker/text). Otherwise setPointerCapture()
    // below hijacks the pointer stream and the button's click never fires,
    // so TTS silently does nothing when tapped in the flip===2 view.
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return
    // If swipe is disabled, don't allow dragging
    if (disableSwipe) {
      // Still allow click, but no drag
      return
    }
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
    if (!isDragging || flyOut || disableSwipe) return
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
    if (!isDragging || flyOut || disableSwipe) return
    const absX = Math.abs(dragX)
    const absY = Math.abs(dragY)

    if (dragY > absX && dragY > 80) {
      animateFlyOutAndAdvance(3, 0, 500)
    } else if (dragY < -absX && dragY < -80) {
      animateFlyOutAndAdvance(4, 0, -500)
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
        {/*
          `min-h-screen` sengaja dihapus dari sini: .page sekarang sudah
          display:flex + flex-direction:column dan tingginya fixed
          100dvh, jadi `flex-1` saja sudah cukup membuat div ini mengisi
          tinggi penuh .page. `min-h-screen` (min-height:100vh) di sini
          justru bisa memaksa div ini lebih tinggi dari box .page
          (100dvh), yang berpotensi menambah scroll/gap yang tidak perlu.
        */}
        <div className="flex flex-1 items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (done || cards.length === 0) {
    const isEmpty = cards.length === 0
    const totalRated = hafal + sulit + ragu + lupa
    const finalAccuracy = totalRated > 0 ? Math.round(((hafal + sulit) / totalRated) * 100) : 0
    const ringColor = finalAccuracy >= 80 ? "#34d399" : finalAccuracy >= 50 ? "#f59e0b" : "#f87171"
    const circumference = 2 * Math.PI * 54
    const ringOffset = circumference - (resultRingValue / 100) * circumference

    return (
      <div className={styles.page}>
        <div className="flex flex-col flex-1 select-none relative z-10 min-h-0">
          {/* Header with Title, Subtitle, and Action Buttons */}
          {!isFastMode ? (
            <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm px-4 py-3 shrink-0 sticky top-0 z-20">
              <div className="mb-2">
                <h1 className="text-lg font-bold text-foreground">{deckTitle}</h1>
                <p className="text-xs text-muted-foreground">{deckLevel}</p>
              </div>

              {/* Always Visible Stats Section */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                <div className={`${styles.statsCard} flex flex-col gap-1`}>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    Jatuh Tempo Hari Ini
                  </div>
                  <div className="flex items-center h-1.5">
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                      {headerStats.dueToday} dari {headerStats.totalCards} tersimpan
                    </span>
                  </div>
                </div>
                <div className={`${styles.statsCard} flex flex-col gap-1`}>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3" />
                    Akurasi Sesi
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${headerStats.accuracy}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground">{headerStats.accuracy}%</span>
                  </div>
                </div>
                <div className={`${styles.statsCard} flex flex-col gap-1`}>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Star className="h-3 w-3" />
                    Sudah Dikuasai
                  </div>
                  <div className="text-sm font-semibold text-foreground">{headerStats.mastered}</div>
                </div>
                <div className={`${styles.statsCard} flex flex-col gap-1`}>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3" />
                    Dinilai
                  </div>
                  <div className="text-sm font-semibold text-foreground">{headerStats.rated}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm px-4 py-3 shrink-0 sticky top-0 z-20">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-bold text-foreground">{deckTitle}</h1>
                  <p className="text-xs text-muted-foreground">{deckLevel} - Mode Cepat</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-lg gap-1.5 text-xs" onClick={() => router.back()}>
                    <X className="h-3.5 w-3.5" />
                    Keluar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Result Content */}
          <div className="flashcard-result relative flex flex-col flex-1 items-center justify-center gap-7 p-8 bg-background overflow-hidden min-h-0">
            {isEmpty ? (
            <>
              <div className="flashcard-result-emoji text-6xl">{emptyEmoji}</div>
              <h2 className="flashcard-result-title text-3xl font-bold text-center">{emptyTitle}</h2>
              <Button variant="outline" className="rounded-2xl px-8" onClick={() => router.back()}>Kembali</Button>
            </>
          ) : (
            <>
              {/*
                Signature: watermark hanzi besar di belakang ring, gaya
                sama persis dengan watermark yang muncul di setiap sisi
                kartu sepanjang sesi (lihat renderDetailFaceInner & Card
                1). 完 = "selesai/tuntas" — layar ini jadi terasa seperti
                kartu penutup dari sesi yang sama, bukan komponen lepas.
              */}
              <div
                aria-hidden="true"
                className="flashcard-result-watermark absolute select-none pointer-events-none font-hanzi text-foreground/[0.05] dark:text-foreground/[0.07]"
                style={{
                  fontSize: "16rem",
                  lineHeight: 1,
                  top: "50%",
                  left: "50%",
                  // Sebelumnya cuma `top: "6%"` tanpa penyeimbang
                  // horizontal, jadi watermark selalu nempel di kiri atas
                  // (posisi statis defaultnya sebagai elemen absolute
                  // tanpa `left`), bukan di tengah layar seperti yang
                  // dimaksud. translate(-50%, -50%) dari titik tengah
                  // (top/left 50%) yang benar-benar menengahkan glyph-nya
                  // secara horizontal DAN vertikal relatif terhadap
                  // seluruh layar hasil.
                  transform: "translate(-50%, -50%)",
                }}
              >
                完
              </div>

              <div className="flashcard-result-title flex flex-col items-center gap-1 relative z-10">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Sesi Selesai!</h2>
                <p className="text-sm text-muted-foreground">{totalRated} kata dinilai</p>
              </div>

              {/* Ring akurasi — echo dari "Akurasi Sesi" di header sesi */}
              <div className="flashcard-result-ring relative z-10 flex items-center justify-center">
                <svg width="152" height="152" viewBox="0 0 120 120" className="-rotate-90">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/60" />
                  <circle
                    cx="60" cy="60" r="54" fill="none"
                    stroke={ringColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={ringOffset}
                    style={{ transition: "stroke 400ms ease" }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-bold text-foreground tabular-nums">{resultRingValue}%</span>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Akurasi</span>
                </div>
              </div>

              {/* Rincian penilaian — chip per kategori, warnanya sama
                  dengan tombol rating di sesi latihan supaya bahasa
                  visualnya konsisten (bukan cuma kotak angka datar). */}
              <div className="flashcard-result-stats flex flex-wrap justify-center gap-2 relative z-10">
                <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-500"><Zap className="h-3.5 w-3.5" /></span>
                  <span className="text-sm font-semibold text-emerald-500 tabular-nums">{hafal}</span>
                  <span className="text-xs text-muted-foreground">Mudah</span>
                </div>
                <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500/15 text-blue-500"><Brain className="h-3.5 w-3.5" /></span>
                  <span className="text-sm font-semibold text-blue-500 tabular-nums">{sulit}</span>
                  <span className="text-xs text-muted-foreground">Ingat</span>
                </div>
                <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/15 text-amber-500"><HelpCircle className="h-3.5 w-3.5" /></span>
                  <span className="text-sm font-semibold text-amber-500 tabular-nums">{ragu}</span>
                  <span className="text-xs text-muted-foreground">Sulit</span>
                </div>
                <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/25">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-red-500/15 text-red-500"><RotateCcw className="h-3.5 w-3.5" /></span>
                  <span className="text-sm font-semibold text-red-500 tabular-nums">{lupa}</span>
                  <span className="text-xs text-muted-foreground">Lupa</span>
                </div>
              </div>

                <div className="flashcard-result-actions flex gap-3 w-full max-w-xs relative z-10">
                  <Button variant="outline" className="flex-1 rounded-2xl h-11" onClick={() => router.back()}>Kembali</Button>
                  <Button className="flex-1 rounded-2xl h-11 shadow-sm" onClick={() => setSessionKey((k) => k + 1)}>Ulangi</Button>
                </div>
              </>
            )}
          </div>

          <style dangerouslySetInnerHTML={{
            __html: `
            .flashcard-result { animation: fcResultEnter 520ms cubic-bezier(.22,1,.36,1) both; }
            .flashcard-result-emoji { animation: fcResultPop 620ms cubic-bezier(.2,1.4,.4,1) 120ms both; }
            .flashcard-result-watermark { animation: fcWatermarkFade 900ms ease 80ms both; }
            .flashcard-result-title { animation: fcResultRise 420ms cubic-bezier(.22,1,.36,1) 80ms both; }
            .flashcard-result-ring { animation: fcResultPop 620ms cubic-bezier(.2,1.4,.4,1) 200ms both; }
            .flashcard-result-stats { animation: fcResultRise 420ms cubic-bezier(.22,1,.36,1) 360ms both; }
            .flashcard-result-actions { animation: fcResultRise 420ms cubic-bezier(.22,1,.36,1) 460ms both; }
            @keyframes fcResultEnter { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes fcResultPop { 0% { opacity: 0; transform: translateY(10px) scale(.8); } 70% { opacity: 1; transform: translateY(0) scale(1.05); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes fcResultRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes fcWatermarkFade { from { opacity: 0; } to { opacity: 1; } }
            @media (prefers-reduced-motion: reduce) {
              .flashcard-result, .flashcard-result-emoji, .flashcard-result-watermark, .flashcard-result-title, .flashcard-result-ring, .flashcard-result-stats, .flashcard-result-actions {
                animation: none !important;
              }
            }
          ` }} />
        </div>
      </div>
    )
  }

  if (!card) return null

  let swipeStatus: "none" | "hafal" | "lupa" | "ragu" | "sulit" = "none"
  const absX = Math.abs(dragX)
  const absY = Math.abs(dragY)

  if (isDragging && flip === 2 && (absX > 20 || absY > 20)) {
    if (dragY > absX) {
      swipeStatus = "ragu"
    } else if (dragY < -absX) {
      swipeStatus = "sulit"
    } else if (absX > dragY) {
      if (dragX > 0) swipeStatus = "hafal"
      else swipeStatus = "lupa"
    }
  }

  const contentOpacity = swipeStatus !== "none" ? 0 : 1
  const cardRotation = dragX * 0.05

  // Konten inti Card 3 (sisi detail: arti + contoh kalimat) diekstrak jadi
  // fungsi supaya bisa dipakai dua kali: sekali untuk tampilan asli
  // (absolute, dengan semua interaksi/tombol speaker), dan sekali lagi
  // sebagai "sizer" tak terlihat yang menentukan tinggi seluruh stack
  // kartu (lihat komentar di wrapper grid di bawah).
  function renderDetailFaceInner() {
    return (
      <>
        <div
          aria-hidden="true"
          className="absolute -right-8 -bottom-10 select-none pointer-events-none font-hanzi text-foreground/[0.07] dark:text-foreground/[0.1]"
          style={{ fontSize: "10rem", lineHeight: 1, transform: "scaleX(-1) rotate(-8deg)" }}
        >
          {card.hanzi}
        </div>
        <CardTopBar card={card} />
        <div className="flex-1 flex flex-col items-center justify-center mt-4">
          <div
            className="font-hanzi text-4xl sm:text-5xl leading-none text-foreground drop-shadow-sm mb-2 cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
            data-no-drag
            onClick={(e) => { e.stopPropagation(); speakMandarin(card.hanzi) }}
          >
            {card.hanzi}
          </div>
          <TonePinyin text={card.pinyin} className="mb-2 text-xl font-sans font-medium drop-shadow-sm" />
          <span className="text-lg font-semibold text-center text-foreground drop-shadow-sm">{card.arti}</span>
        </div>
        {!isFastMode && (
          <div className="mt-3 pt-3 border-t border-border/40 bg-gradient-to-br from-muted/30 to-muted/10 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground">CONTOH · penggunaan</div>
            </div>
            {card.exampleSentence ? (
              <>
                <div
                  className="text-sm text-foreground mb-1 font-hanzi text-xl cursor-pointer hover:text-primary transition-colors"
                  data-no-drag
                  onClick={(e) => { e.stopPropagation(); speakMandarin(card.exampleSentence!) }}
                >
                  {card.exampleSentence}
                </div>
                {card.examplePinyin && <TonePinyin text={card.examplePinyin || ""} className="text-sm mb-1 font-italic" />}
                <div className="text-sm text-foreground">{card.exampleTranslation}</div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground italic">Belum ada contoh kalimat untuk kata ini</div>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <div className={styles.page}>
      {/*
        `.page` sendiri TIDAK lagi jadi scroll container (lihat
        swipe-flashcard-session.module.css) — halaman ini sekarang
        dirender di dalam layout dashboard normal, dan satu-satunya scroll
        container adalah wrapper `flex-1 overflow-auto` di
        dashboard-layout-client.tsx (sidebar & DashboardHeader tetap
        terlihat/diam di tempat).

        Inner wrapper ini pun TIDAK boleh memasang overflow-y sendiri
        (auto/hidden/scroll) — itu akan membuatnya jadi scroll container
        ketiga, dan `position: sticky` pada header di bawah akan resolve
        relatif ke wrapper ini (statis, tidak scroll) alih-alih ke
        ancestor yang benar-benar scroll, sehingga sticky terlihat seperti
        tidak berfungsi (header ikut ter-scroll bersama isinya).
      */}
      <div className="flex flex-col flex-1 select-none relative z-10">
        {/* Header with Title, Subtitle, and Action Buttons */}
        {!isFastMode ? (
          <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm px-4 py-3 shrink-0 sticky top-0 z-20">
            <div className="mb-2">
              <h1 className="text-lg font-bold text-foreground">{deckTitle}</h1>
              <p className="text-xs text-muted-foreground">{deckLevel}</p>
            </div>

            {/* Always Visible Stats Section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 p-3 rounded-xl bg-muted/30 border border-border/40">
              <div className={`${styles.statsCard} flex flex-col gap-1`}>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  Jatuh Tempo Hari Ini
                </div>
                <div className="flex items-center h-1.5">
                  <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                    {headerStats.dueToday} dari {headerStats.totalCards} tersimpan
                  </span>
                </div>
              </div>
              <div className={`${styles.statsCard} flex flex-col gap-1`}>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3" />
                  Akurasi Sesi
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${headerStats.accuracy}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground">{headerStats.accuracy}%</span>
                </div>
              </div>
              <div className={`${styles.statsCard} flex flex-col gap-1`}>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Star className="h-3 w-3" />
                  Sudah Dikuasai
                </div>
                <div className="text-sm font-semibold text-foreground">{headerStats.mastered}</div>
              </div>
              <div className={`${styles.statsCard} flex flex-col gap-1`}>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3" />
                  Dinilai
                </div>
                <div className="text-sm font-semibold text-foreground">{headerStats.rated}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm px-4 py-3 shrink-0 sticky top-0 z-20">
            <div>
              <h1 className="text-lg font-bold text-foreground">{deckTitle}</h1>
              <p className="text-xs text-muted-foreground">{deckLevel} - Mode Cepat</p>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="flex items-center gap-3 px-4 py-2 shrink-0">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 relative">
          {/*
            Diperlebar di layar besar: max-w-lg (mobile) -> max-w-2xl (md) ->
            max-w-3xl (lg), agar kartu tidak terlihat kekecilan saat dibuka
            di PC, sesuai referensi.

            Tinggi TIDAK lagi di-hardcode (dulu h-[340px] md:h-[360px]
            lg:h-[400px]) — itu yang menyebabkan Card 3 (arti + contoh
            kalimat) kepotong dan harus di-scroll sendiri di dalam kartu,
            sehingga bentrok dengan gestur swipe.

            Solusi: CSS Grid stacking trick. `.grid` di bawah punya dua
            child yang sama-sama diberi grid-area 1/1, jadi saling
            menumpuk di sel yang sama:
            1) "sizer" — invisible, normal-flow, berisi render Card 3 yang
               identik. Karena normal-flow, tingginya dihitung apa adanya
               oleh browser dan itulah yang menentukan tinggi baris grid.
            2) stack kartu (Card 1/2/3 + efek tumpukan) — semuanya absolute,
               tapi ikut stretch mengisi tinggi sel grid (default
               align-items: stretch), jadi tingginya otomatis mengikuti
               sizer tanpa perlu JS/ResizeObserver.
            Setiap kali `card` berganti dan kalimat contohnya lebih
            panjang/pendek, tinggi seluruh kartu ikut menyesuaikan.
          */}
          <div className="relative w-full max-w-lg md:max-w-2xl lg:max-w-3xl perspective-[800px]">
            <div className="grid">
              {/* Sizer tak terlihat — menentukan tinggi baris grid */}
              <div
                aria-hidden="true"
                className="invisible pointer-events-none flex flex-col p-6 rounded-3xl [grid-area:1/1]"
              >
                {renderDetailFaceInner()}
              </div>

              {/* Stack kartu asli, stretch mengikuti tinggi sizer di atas */}
              <div className="relative w-full [grid-area:1/1]">
                {/*
                  Efek tumpukan kartu: dua lapis "kartu hantu" statis di
                  belakang kartu utama, sedikit digeser & lebih kecil, supaya
                  terlihat seperti ada kartu lain menumpuk di belakangnya
                  (bukan blur/shadow biasa).
                */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-3xl border border-border/30 bg-card/70"
                  style={{ transform: "translate(0px, 14px) scale(0.96)", zIndex: 0 }}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-3xl border border-border/20 bg-card/40"
                  style={{ transform: "translate(0px, 26px) scale(0.92)", zIndex: -1 }}
                />
                <div
                  key={idx + "-" + card.id}
                  ref={cardRef}
                  className={`absolute inset-0 w-full h-full rounded-3xl border border-border/40 bg-card shadow-2xl flex flex-col transform-style-3d touch-none flashcardCard z-10 ${isDragging ? "!transition-none cursor-grabbing" : flyOut ? "transition-all duration-300 ease-out cursor-grabbing" : "transition-transform duration-300 cursor-pointer"
                    }`}
                  style={{
                    transform: flyOut
                      ? `translate(${flyOut.x}px, ${flyOut.y}px) rotate(${flyOut.x * 0.05}deg) rotateY(360deg)`
                      : isDragging
                        ? `translate(${dragX}px, ${dragY}px) rotate(${cardRotation}deg) rotateY(${flip === 0 ? 0 : flip === 1 ? 180 : 360}deg)`
                        : `rotateY(${flip === 0 ? 0 : flip === 1 ? 180 : 360}deg)`,
                    opacity: flyOut ? 0 : 1,
                    transition: flyOut ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease' :
                      isDragging ? 'none' :
                        'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onClick={handleCardClick}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerCancel={onPointerCancel}
                  onPointerUp={onPointerUp}
                >
                  <div className="absolute inset-0 backface-hidden rounded-3xl overflow-hidden">
                    {flip === 2 ? (
                      // Card 3: tampilan detail (arti + contoh kalimat), dengan
                      // watermark hanzi besar yang sama dengan Card 1 & 2. Tidak
                      // ada lagi overflow-y-auto di sini — tinggi kartu sudah
                      // otomatis cukup untuk seluruh konten lewat sizer di atas.
                      <div
                        className="absolute inset-0 flex flex-col p-6 bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-3xl transition-opacity duration-200"
                        style={{ opacity: contentOpacity }}
                      >
                        {renderDetailFaceInner()}
                      </div>
                    ) : (
                      // Card 1: tampilan depan (hanya hanzi), dengan watermark
                      // hanzi besar yang sama dengan Card 2 & 3 supaya konsisten
                      // di setiap kondisi kartu.
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-card to-card/80 rounded-3xl overflow-hidden">
                        <div
                          aria-hidden="true"
                          className="absolute -right-8 -bottom-10 select-none pointer-events-none font-hanzi text-foreground/[0.07] dark:text-foreground/[0.1]"
                          style={{ fontSize: "10rem", lineHeight: 1, transform: "scaleX(-1) rotate(-8deg)" }}
                        >
                          {card.hanzi}
                        </div>
                        <CardTopBar card={card} />
                        <div className="font-hanzi text-6xl sm:text-7xl md:text-8xl leading-none text-foreground drop-shadow-sm whitespace-nowrap">{card.hanzi}</div>
                        <CardHint />
                      </div>
                    )}
                  </div>

                  {/* Card 2: tampilan belakang (hanzi + pinyin), dengan watermark
                      hanzi besar yang di-mirror horizontal dan warnanya gelap
                      transparan di pojok kanan-bawah, mirip watermark referensi. */}
                  <div className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-8 bg-gradient-to-br from-card to-card/80 rounded-3xl rotate-y-180 overflow-hidden">
                    <div
                      aria-hidden="true"
                      className="absolute -right-8 -bottom-10 select-none pointer-events-none font-hanzi text-foreground/[0.07] dark:text-foreground/[0.1]"
                      style={{ fontSize: "10rem", lineHeight: 1, transform: "scaleX(-1) rotate(-8deg)" }}
                    >
                      {card.hanzi}
                    </div>
                    <CardTopBar card={card} />
                    <div className="font-hanzi mb-6 text-4xl sm:text-5xl md:text-6xl leading-none text-foreground drop-shadow-sm whitespace-nowrap">{card.hanzi}</div>
                    <TonePinyin text={card.pinyin} className="text-3xl font-sans font-medium drop-shadow-sm" />
                    <CardHint />
                  </div>

                  <div
                    className={`absolute inset-0 rounded-3xl pointer-events-none flex items-center justify-center text-4xl font-bold tracking-wider z-20 backface-hidden transition-all duration-200 ${swipeStatus !== "none" ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
                    style={{
                      background: swipeStatus === "hafal" ? "rgba(26, 122, 74, 0.25)" : swipeStatus === "lupa" ? "rgba(192, 57, 43, 0.25)" : swipeStatus === "ragu" ? "rgba(245, 158, 11, 0.25)" : swipeStatus === "sulit" ? "rgba(59, 130, 246, 0.25)" : "transparent",
                      color: swipeStatus === "hafal" ? "#4ade80" : swipeStatus === "lupa" ? "#f87171" : swipeStatus === "ragu" ? "#f59e0b" : swipeStatus === "sulit" ? "#60a5fa" : "transparent",
                      border: swipeStatus === "hafal" ? "2px solid rgba(74, 222, 128, 0.4)" : swipeStatus === "lupa" ? "2px solid rgba(248, 113, 113, 0.4)" : swipeStatus === "ragu" ? "2px solid rgba(245, 158, 11, 0.4)" : swipeStatus === "sulit" ? "2px solid rgba(96, 165, 250, 0.4)" : "none",
                      display: flip === 2 ? "flex" : "none",
                    }}
                  >
                    <span className="drop-shadow-lg">
                      {swipeStatus === "hafal" ? "MUDAH ✓" : swipeStatus === "lupa" ? "LUPA ✕" : swipeStatus === "ragu" ? "SULIT ?" : swipeStatus === "sulit" ? "INGAT !" : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 mt-2 h-auto w-full max-w-lg md:max-w-2xl lg:max-w-3xl">
            {isFastMode && !feedback && (
              <p className="text-xs text-muted-foreground/80 font-medium flex items-center justify-center gap-3 tracking-widest uppercase">
                <span className="text-red-400">← Lupa</span> • <span className="text-amber-500">Sulit ↓</span> • <span className="text-blue-400">Ingat ↑</span> • <span className="text-emerald-500">Mudah →</span>
              </p>
            )}

            {!isFastMode && (
              <>
                {/* Sebelumnya / Sembunyi / Lewati */}
                <div className="grid grid-cols-3 gap-2 w-full">
                  <Button
                    variant="outline"
                    className="rounded-xl h-10 gap-1.5 text-xs font-medium"
                    onClick={goToPrevious}
                    disabled={idx === 0}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl h-10 gap-1.5 text-xs font-medium"
                    onClick={hideAnswer}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Sembunyi
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl h-10 gap-1.5 text-xs font-medium"
                    onClick={skipCard}
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Lewati
                  </Button>
                </div>

                {/* Visible Rating Buttons */}
                <div className="text-sm font-semibold text-foreground">Seberapa mudah kamu mengingatnya?</div>
                <div className="grid grid-cols-4 gap-2 w-full">
                  <Button
                    variant="outline"
                    className={`${styles.ratingButton} relative rounded-xl h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${selectedRating === 0
                      ? "bg-red-500/20 border-red-500/50 text-red-500 scale-105"
                      : "bg-red-500/5 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
                      }`}
                    onClick={() => { setSelectedRating(0); advance(0) }}
                  >
                    <span className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-md bg-muted/70 text-[9px] font-semibold text-muted-foreground">1</span>
                    <span>Lupa</span>
                    <span className="text-[10px] font-normal text-muted-foreground">{formatIntervalDays(previewIntervalDays(card?.srsLevel ?? 0, 0))}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className={`${styles.ratingButton} relative rounded-xl h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${selectedRating === 3
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-500 scale-105"
                      : "bg-amber-500/5 border-amber-500/20 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30"
                      }`}
                    onClick={() => { setSelectedRating(3); advance(3) }}
                  >
                    <span className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-md bg-muted/70 text-[9px] font-semibold text-muted-foreground">2</span>
                    <span>Sulit</span>
                    <span className="text-[10px] font-normal text-muted-foreground">{formatIntervalDays(previewIntervalDays(card?.srsLevel ?? 0, 3))}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className={`${styles.ratingButton} relative rounded-xl h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${selectedRating === 4
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-500 scale-105"
                      : "bg-blue-500/5 border-blue-500/20 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30"
                      }`}
                    onClick={() => { setSelectedRating(4); advance(4) }}
                  >
                    <span className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-md bg-muted/70 text-[9px] font-semibold text-muted-foreground">3</span>
                    <span>Ingat</span>
                    <span className="text-[10px] font-normal text-muted-foreground">{formatIntervalDays(previewIntervalDays(card?.srsLevel ?? 0, 4))}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className={`${styles.ratingButton} relative rounded-xl h-14 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${selectedRating === 5
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-500 scale-105"
                      : "bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30"
                      }`}
                    onClick={() => { setSelectedRating(5); advance(5) }}
                  >
                    <span className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-md bg-muted/70 text-[9px] font-semibold text-muted-foreground">4</span>
                    <span>Mudah</span>
                    <span className="text-[10px] font-normal text-muted-foreground">{formatIntervalDays(previewIntervalDays(card?.srsLevel ?? 0, 5))}</span>
                  </Button>
                </div>

                {/* Hint navigasi keyboard: 1-4 untuk menilai langsung, ← →
                    untuk Sebelumnya/Lewati. Disembunyikan di layar mobile
                    karena keyboard fisik jarang dipakai di sana. */}
                <p className="hidden sm:flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
                  <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 font-mono text-[10px]">1</kbd>
                  <span>–</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 font-mono text-[10px]">4</kbd>
                  <span>nilai</span>
                  <span className="mx-1">·</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 font-mono text-[10px]">←</kbd>
                  <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 font-mono text-[10px]">→</kbd>
                  <span>navigasi</span>
                </p>

                {/* Rating Explanations */}
                <div className="w-full rounded-xl border border-border/40 bg-muted/20 p-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Arti setiap penilaian</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-red-400 shrink-0">Lupa ·</span>
                      <span className="text-muted-foreground">belum ingat, muncul lagi besok</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-amber-400 shrink-0">Sulit ·</span>
                      <span className="text-muted-foreground">hampir lupa, muncul lagi besok</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-blue-400 shrink-0">Ingat ·</span>
                      <span className="text-muted-foreground">ingat dengan usaha, jeda beberapa hari</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-emerald-400 shrink-0">Mudah ·</span>
                      <span className="text-muted-foreground">sangat mudah, jeda lebih lama</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {feedback && (
              <div className={`text-center px-4 py-4 rounded-xl border w-full max-w-lg mx-auto shadow-sm ${feedback.type === "ok" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
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

        <style dangerouslySetInnerHTML={{
          __html: `
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