"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  Minus,
  Plus,
  RotateCcw,
  Volume2,
  X,
  BookMarked,
  Play,
  Pause,
  Gauge,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSupabase } from "@/hooks/use-supabase"
import { speakMandarin, speakParagraph, cancelTTS } from "@/lib/tts"
import { getCeritaProgress, setCeritaProgress, clearCeritaProgress } from "@/lib/cerita-progress"
import { saveUserScore } from "@/lib/user-scores"
import { shuffle } from "@/lib/array-utils"
import { PracticeHeader } from "@/components/practice-header"
import styles from "./page.module.css"


type QuizQuestion = {
  q: string
  options: string[]
  correctIndex: number
  explanation?: string
}

type CeritaDetail = {
  title: string
  title_zh: string
  badge: string
  paragraphs: string[]
  vocab: Record<string, { pinyin: string; arti: string }>
  quizQuestions: QuizQuestion[]
}

type Segment = string | { word: string }

function segmentParagraph(text: string, vocabWords: string[]): Segment[] {
  let segments: Segment[] = [text]
  for (const word of vocabWords) {
    if (!word) continue
    const next: Segment[] = []
    for (const seg of segments) {
      if (typeof seg !== "string") {
        next.push(seg)
        continue
      }
      const parts = seg.split(word)
      parts.forEach((part, i) => {
        if (part) next.push(part)
        if (i < parts.length - 1) next.push({ word })
      })
    }
    segments = next
  }
  return segments
}

type Popover = { word: string; pinyin: string; arti: string; x: number; y: number }

const FONT_LEVELS = [16, 20, 24, 28, 32]

const AUTOPLAY_SPEEDS = [
  { rate: 1.0, label: "1.0×" },
  { rate: 0.7, label: "0.7×" },
  { rate: 0.5, label: "0.5×" },
  { rate: 0.3, label: "0.3×" },
]
const AUTOPLAY_SPEED_KEY = "cerita_autoplay_speed"

export default function CeritaReadPage() {
  const params = useParams<{ key: string }>()
  const router = useRouter()
  const key = params.key
  const supa = useSupabase()

  const [data, setData] = React.useState<CeritaDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [fontLevel, setFontLevel] = React.useState(2)
  const [pct, setPct] = React.useState(0)
  const [popover, setPopover] = React.useState<Popover | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const [quizOpen, setQuizOpen] = React.useState(false)
  const [quizItems, setQuizItems] = React.useState<QuizQuestion[]>([])
  const [quizIdx, setQuizIdx] = React.useState(0)
  const [quizCorrect, setQuizCorrect] = React.useState(0)
  const [quizSelected, setQuizSelected] = React.useState<number | null>(null)
  const [quizDone, setQuizDone] = React.useState(false)

  /* ── Autoplay (baca otomatis berurutan) ── */
  const [autoplayOn, setAutoplayOn] = React.useState(false)
  const [autoplayIdx, setAutoplayIdx] = React.useState<number | null>(null)
  const [speedIdx, setSpeedIdx] = React.useState(0)
  const autoplayStopRef = React.useRef(false)
  const autoplayRunIdRef = React.useRef(0)
  const speedIdxRef = React.useRef(0)
  const paragraphRefs = React.useRef<(HTMLParagraphElement | null)[]>([])

  React.useEffect(() => {
    const saved = window.localStorage.getItem(AUTOPLAY_SPEED_KEY)
    const idx = saved !== null ? Number(saved) : NaN
    if (!Number.isNaN(idx) && AUTOPLAY_SPEEDS[idx]) {
      setSpeedIdx(idx)
      speedIdxRef.current = idx
    }
  }, [])

  const rootRef = React.useRef<HTMLDivElement>(null)
  const quizPanelRef = React.useRef<HTMLDivElement>(null)
  const lastSavedPctRef = React.useRef(-1)

  const getScrollEl = React.useCallback((): HTMLElement | null => {
    // Sejak halaman ini dirender di dalam layout dashboard normal (sidebar +
    // header tetap terlihat, bukan overlay fullscreen lagi), `rootRef`
    // sendiri bukan lagi elemen yang scroll — scroll container sebenarnya
    // adalah wrapper `overflow-auto` di dashboard-layout-client.tsx, satu
    // level di atas. Lihat juga catatan serupa di swipe-flashcard-session.tsx.
    return (rootRef.current?.closest(".overflow-auto") as HTMLElement | null) ?? rootRef.current
  }, [])

  /* ── Load data ── */
  React.useEffect(() => {
    let cancelled = false

    async function load() {
      const [metaRes, parasRes, vocabRes] = await Promise.all([
        supa.from("cerita_sets").select("title, title_zh, badge, quiz_questions").eq("key", key).single(),
        supa.from("cerita_paragraphs").select("para_index, hanzi_text").eq("cerita_key", key).order("para_index", { ascending: true }),
        supa.from("cerita_vocab").select("hanzi, pinyin, arti").eq("cerita_key", key).order("sort_order", { ascending: true }),
      ])

      if (cancelled) return
      if (metaRes.error || !metaRes.data) {
        setError("Cerita tidak ditemukan.")
        setLoading(false)
        return
      }
      if (parasRes.error) {
        setError(`Gagal memuat paragraf: ${parasRes.error.message}`)
        setLoading(false)
        return
      }

      const vocab: Record<string, { pinyin: string; arti: string }> = {}
      ;(vocabRes.data ?? []).forEach((v) => {
        vocab[v.hanzi] = { pinyin: v.pinyin, arti: v.arti }
      })

      setData({
        title: metaRes.data.title,
        title_zh: metaRes.data.title_zh ?? "",
        badge: metaRes.data.badge ?? "HSK 1",
        paragraphs: (parasRes.data ?? []).map((p) => p.hanzi_text),
        vocab,
        quizQuestions: (metaRes.data.quiz_questions as QuizQuestion[] | null) ?? [],
      })
      setLoading(false)
    }

    load().catch(() => {
      if (!cancelled) {
        setError("Gagal memuat cerita.")
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [key])

  /* ── Restore progress + attach scroll tracking ── */
  React.useEffect(() => {
    if (!data) return
    const el = getScrollEl()
    if (!el) return

    const saved = getCeritaProgress()[key]
    if (saved && saved > 0 && saved < 100) {
      const timer = setTimeout(() => {
        const max = el.scrollHeight - el.clientHeight
        if (max <= 0) return
        el.scrollTop = (max * saved) / 100
        const real = Math.round((el.scrollTop / max) * 100)
        setPct(real)
        lastSavedPctRef.current = real
      }, 120)
      return () => clearTimeout(timer)
    }
  }, [data, key, getScrollEl])

  const updateProgress = React.useCallback(() => {
    const el = getScrollEl()
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    if (max <= 0) return
    const current = Math.round((el.scrollTop / max) * 100)
    setPct(current)

    if (current >= 95) {
      if (lastSavedPctRef.current < 95) {
        lastSavedPctRef.current = 100
        setCeritaProgress(key, 100)
      }
    } else if (current - lastSavedPctRef.current >= 5 || (current === 0 && lastSavedPctRef.current !== 0)) {
      lastSavedPctRef.current = current
      setCeritaProgress(key, current)
    }
  }, [getScrollEl, key])

  React.useEffect(() => {
    if (!data) return
    const el = getScrollEl()
    if (!el) return
    el.addEventListener("scroll", updateProgress, { passive: true })
    return () => el.removeEventListener("scroll", updateProgress)
  }, [data, getScrollEl, updateProgress])

  const stopAutoplay = React.useCallback(() => {
    autoplayStopRef.current = true
    autoplayRunIdRef.current += 1
    setAutoplayOn(false)
    setAutoplayIdx(null)
  }, [])

  /* ── Cleanup on unmount / tab hidden ── */
  React.useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        cancelTTS()
        stopAutoplay()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", cancelTTS)
    return () => {
      cancelTTS()
      stopAutoplay()
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", cancelTTS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const startAutoplay = React.useCallback(async () => {
    if (!data || data.paragraphs.length === 0) return
    cancelTTS()
    autoplayStopRef.current = false
    const runId = (autoplayRunIdRef.current += 1)
    setAutoplayOn(true)

    for (let i = 0; i < data.paragraphs.length; i++) {
      if (autoplayStopRef.current || runId !== autoplayRunIdRef.current) return
      setAutoplayIdx(i)
      paragraphRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })
      
      const startTime = Date.now()
      await speakParagraph(data.paragraphs[i], AUTOPLAY_SPEEDS[speedIdxRef.current].rate)
      if (autoplayStopRef.current || runId !== autoplayRunIdRef.current) return

      // Hitung durasi membaca minimum disesuaikan dengan rate speed
      const rate = AUTOPLAY_SPEEDS[speedIdxRef.current].rate
      const textLength = data.paragraphs[i].length
      const speedFactor = 0.7 / rate
      const minDuration = (2500 + textLength * 250) * speedFactor

      const elapsed = Date.now() - startTime
      if (elapsed < minDuration) {
        await new Promise((resolve) => setTimeout(resolve, minDuration - elapsed))
      }
      if (autoplayStopRef.current || runId !== autoplayRunIdRef.current) return
    }

    if (runId === autoplayRunIdRef.current) {
      setAutoplayOn(false)
      setAutoplayIdx(null)
    }
  }, [data])

  function toggleAutoplay() {
    if (autoplayOn) stopAutoplay()
    else startAutoplay()
  }

  function cycleSpeed() {
    setSpeedIdx((current) => {
      const next = (current + 1) % AUTOPLAY_SPEEDS.length
      speedIdxRef.current = next
      window.localStorage.setItem(AUTOPLAY_SPEED_KEY, String(next))
      return next
    })
  }

  function changeFontLevel(delta: number) {
    setFontLevel((current) => Math.min(FONT_LEVELS.length - 1, Math.max(0, current + delta)))
  }

  function resetProgress() {
    setConfirmOpen(true)
  }

  function confirmReset() {
    setConfirmOpen(false)
    clearCeritaProgress(key)
    lastSavedPctRef.current = -1
    setPct(0)
    const el = getScrollEl()
    if (el) el.scrollTop = 0
  }

  function openWordPopover(word: string, e: React.MouseEvent) {
    const v = data?.vocab[word]
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPopover({
      word,
      pinyin: v?.pinyin ?? "",
      arti: v?.arti ?? "",
      x: Math.min(Math.max(rect.left, 12), window.innerWidth - 232),
      y: rect.bottom + 8,
    })
    speakMandarin(word, { silent: true })
  }

  React.useEffect(() => {
    if (!popover) return
    function close() {
      setPopover(null)
    }
    document.addEventListener("click", close)
    window.addEventListener("scroll", close, true)
    return () => {
      document.removeEventListener("click", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [popover])

  /* ── Comprehension quiz ── */
  function shuffleOptions(q: QuizQuestion): QuizQuestion {
    const correctText = q.options[q.correctIndex]
    const options = shuffle(q.options)
    return { ...q, options, correctIndex: options.indexOf(correctText) }
  }

  function startQuiz() {
    if (!data) return
    const pool = [...data.quizQuestions]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(shuffleOptions)
    setQuizItems(pool)
    setQuizIdx(0)
    setQuizCorrect(0)
    setQuizSelected(null)
    setQuizDone(false)
    setQuizOpen(true)
    setTimeout(() => quizPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
  }

  function answerQuiz(idx: number) {
    if (quizSelected !== null) return
    setQuizSelected(idx)
    const q = quizItems[quizIdx]
    if (idx === q.correctIndex) setQuizCorrect((c) => c + 1)
  }

  function nextQuiz() {
    const nextIdx = quizIdx + 1
    if (nextIdx >= quizItems.length) {
      setQuizDone(true)
      const scorePct = Math.round((quizCorrect / quizItems.length) * 100)
      saveUserScore("cerita_quiz", key, scorePct).catch(() => {
        // gagal simpan (mis. offline) — tidak mengganggu UX, user tetap lihat hasil kuis
      })
      return
    }
    setQuizIdx(nextIdx)
    setQuizSelected(null)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-sm text-red-400">{error ?? "Cerita tidak ditemukan."}</p>
        <Link href="/dashboard/cerita" className={buttonVariants({ variant: "outline" })}>Kembali</Link>
      </div>
    )
  }

  const vocabWords = Object.keys(data.vocab).sort((a, b) => b.length - a.length)
  const fontSize = FONT_LEVELS[fontLevel]

  return (
    <div ref={rootRef} className={styles.page}>
      <PracticeHeader
        title={data.title_zh || data.title}
        subtitle={data.title_zh ? data.title : undefined}
        progress={pct}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/60 px-1.5 py-1">
            <button
              type="button"
              onClick={toggleAutoplay}
              disabled={data.paragraphs.length === 0}
              className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              aria-label={autoplayOn ? "Jeda baca otomatis" : "Mulai baca otomatis"}
              title={autoplayOn ? "Jeda" : "Baca otomatis"}
            >
              {autoplayOn ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={cycleSpeed}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Ganti kecepatan baca"
              title="Kecepatan baca otomatis"
            >
              <Gauge className="h-3.5 w-3.5" />
              {AUTOPLAY_SPEEDS[speedIdx].label}
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/60 px-1.5 py-1">
            <button type="button" onClick={() => changeFontLevel(-1)} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Perkecil font">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-5 text-center text-[11px] font-semibold tabular-nums text-muted-foreground" title={`Ukuran ${fontLevel + 1} dari ${FONT_LEVELS.length}`}>
              {fontLevel + 1}
            </span>
            <button type="button" onClick={() => changeFontLevel(1)} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Perbesar font">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={resetProgress}
            className="grid h-7 w-7 place-items-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Reset progress"
            title="Reset progress"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </PracticeHeader>
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        {data.paragraphs.map((para, pi) => {
          const segments = segmentParagraph(para, vocabWords)
          const isActive = autoplayIdx === pi
          return (
            <p
              key={pi}
              ref={(el) => { paragraphRefs.current[pi] = el }}
              style={{ fontSize }}
              className={`font-hanzi relative mb-5 rounded-lg pr-8 leading-loose text-foreground transition-colors ${
                isActive ? "bg-primary/10 ring-1 ring-primary/30" : ""
              }`}
            >
              {segments.map((seg, si) =>
                typeof seg === "string" ? (
                  <React.Fragment key={si}>{seg}</React.Fragment>
                ) : (
                  <button
                    key={si}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openWordPopover(seg.word, e)
                    }}
                    className="rounded-sm bg-primary/10 px-0.5 text-primary transition-colors hover:bg-primary/20"
                  >
                    {seg.word}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => speakMandarin(para)}
                className="absolute right-0 top-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Dengar paragraf ini"
              >
                🔊
              </button>
            </p>
          )
        })}

        <div className="my-8 flex flex-col items-center gap-4 border-t border-border/60 pt-6">
          <Button variant="secondary" className="gap-2" onClick={startQuiz}>
            <BookMarked className="h-4 w-4" />
            Uji Pemahaman
          </Button>
          <p className="text-xs text-muted-foreground">3 soal tentang cerita ini</p>
        </div>

        {quizOpen && (
          <div ref={quizPanelRef} className="rounded-2xl border border-border/60 bg-card/50 p-5">
            {quizItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Soal belum tersedia untuk cerita ini.</p>
            ) : quizDone ? (
              <QuizResult
                correct={quizCorrect}
                total={quizItems.length}
                onRetry={startQuiz}
                onClose={() => setQuizOpen(false)}
              />
            ) : (
              <QuizQuestionCard
                question={quizItems[quizIdx]}
                index={quizIdx}
                total={quizItems.length}
                selected={quizSelected}
                onAnswer={answerQuiz}
                onNext={nextQuiz}
              />
            )}
          </div>
        )}
      </div>

      {popover && (
        <div
          className="fixed z-30 w-56 rounded-xl border border-border/70 bg-card p-3 shadow-xl shadow-black/20"
          style={{ left: popover.x, top: popover.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-hanzi text-lg font-bold text-foreground">{popover.word}</div>
              {popover.pinyin && <div className="text-xs text-primary">{popover.pinyin}</div>}
            </div>
            <button type="button" onClick={() => setPopover(null)} className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted" aria-label="Tutup">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {popover.arti && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{popover.arti}</p>}
          <button
            type="button"
            onClick={() => speakMandarin(popover.word)}
            className="mt-2 flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-primary/15 text-xs font-semibold text-primary hover:bg-primary/25"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Dengar
          </button>
        </div>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-bold text-foreground">Reset progress?</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Progress membaca cerita ini akan dikembalikan ke awal.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                Batal
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmReset}>
                Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function QuizQuestionCard({
  question,
  index,
  total,
  selected,
  onAnswer,
  onNext,
}: {
  question: QuizQuestion
  index: number
  total: number
  selected: number | null
  onAnswer: (idx: number) => void
  onNext: () => void
}) {
  const answered = selected !== null
  const pct = (((index + 1) / total) * 100).toFixed(0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-[10px]">Uji Pemahaman</Badge>
        <span className="text-xs text-muted-foreground">{index + 1} / {total}</span>
      </div>
      <div className="h-1 rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm font-semibold leading-relaxed">{question.q}</p>
      <div className="flex flex-col gap-2">
        {question.options.map((opt, i) => {
          const isCorrect = i === question.correctIndex
          const isSelected = i === selected
          const showState = answered && (isCorrect || isSelected)
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => onAnswer(i)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed ${
                showState
                  ? isCorrect
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
                  : "border-border/60 bg-background hover:border-primary/40"
              }`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                {["A", "B", "C", "D"][i]}
              </span>
              {opt}
            </button>
          )
        })}
      </div>
      {answered && (
        <p className={`text-xs leading-relaxed ${selected === question.correctIndex ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {selected === question.correctIndex ? "✓ Benar! " : "✗ Salah. "}
          {question.explanation ?? ""}
        </p>
      )}
      <Button disabled={!answered} onClick={onNext} className="w-full">
        {index === total - 1 ? "Lihat Hasil" : "Lanjut"}
      </Button>
    </div>
  )
}

function QuizResult({
  correct,
  total,
  onRetry,
  onClose,
}: {
  correct: number
  total: number
  onRetry: () => void
  onClose: () => void
}) {
  const pct = Math.round((correct / total) * 100)
  const wrong = total - correct
  const emoji = pct >= 80 ? "🎉" : pct >= 60 ? "💪" : "📚"
  const title = pct >= 80 ? "Hebat!" : pct >= 60 ? "Lumayan!" : "Terus Berlatih!"

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="text-4xl">{emoji}</div>
      <div className="text-lg font-bold">{title}</div>
      <p className="text-sm text-muted-foreground">{correct} dari {total} soal benar</p>
      <div className="flex gap-3">
        <div className="flex flex-col items-center rounded-xl border border-border/60 px-4 py-2">
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{correct}</span>
          <span className="text-[10px] text-muted-foreground">Benar</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border/60 px-4 py-2">
          <span className="text-base font-bold text-red-600 dark:text-red-400">{wrong}</span>
          <span className="text-[10px] text-muted-foreground">Salah</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border/60 px-4 py-2">
          <span className="text-base font-bold text-primary">{pct}%</span>
          <span className="text-[10px] text-muted-foreground">Skor</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onRetry}>Coba Lagi</Button>
        <Button variant="secondary" onClick={onClose}>Tutup</Button>
      </div>
    </div>
  )
}
