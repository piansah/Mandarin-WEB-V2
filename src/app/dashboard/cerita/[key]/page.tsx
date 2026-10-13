"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
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
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useSupabase } from "@/hooks/use-supabase"
import { speakMandarin, cancelTTS } from "@/lib/tts"
import { getCeritaProgress, setCeritaProgress, clearCeritaProgress } from "@/lib/cerita-progress"
import { saveUserScore } from "@/lib/user-scores"
import { shuffle } from "@/lib/array-utils"
import { createCeritaCompletedNotification } from "@/lib/notifications"
import { PracticeHeader } from "@/components/practice-header"
import { initGlobalSearchCache, segmentText, type SegmentedWord } from "@/lib/hanzi-segmentation"
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
  quizQuestions: QuizQuestion[]
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

/**
 * Satu-satunya sumber kebenaran untuk deteksi tanda baca.
 * Segmen dianggap tanda baca kalau setelah membuang spasi, tanda baca (\p{P})
 * dan simbol (\p{S}) tidak ada karakter yang tersisa. Ini juga menangani
 * segmen campuran seperti "，" atau " 。" maupun tanda baca full-width.
 */
function isPunct(text: string): boolean {
  return text.replace(/[\s\p{P}\p{S}]/gu, "") === ""
}

export default function CeritaReadPage() {
  const params = useParams<{ key: string }>()
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

  // Load quiz state from localStorage and Supabase
  React.useEffect(() => {
    const quizStateKey = `cerita_quiz_${key}`
    const saved = localStorage.getItem(quizStateKey)
    if (saved) {
      try {
        const state = JSON.parse(saved)
        if (state.quizOpen) {
          setQuizOpen(true)
          setQuizItems(state.quizItems || [])
          setQuizIdx(state.quizIdx || 0)
          setQuizCorrect(state.quizCorrect || 0)
          setQuizDone(state.quizDone || false)
        }
      } catch (e) {
        console.error("Failed to load quiz state:", e)
      }
    }

    // Load from Supabase for cross-device sync
    const loadFromSupabase = async () => {
      const { data: { user } } = await supa.auth.getUser()
      if (!user) return

      const { data } = await supa
        .from("user_scores")
        .select("meta")
        .eq("user_id", user.id)
        .eq("type", "cerita_quiz")
        .eq("key", key)
        .single()

      if (data?.meta && (data.meta as any).quizState) {
        const state = (data.meta as any).quizState
        if (state.quizOpen) {
          setQuizOpen(true)
          setQuizItems(state.quizItems || [])
          setQuizIdx(state.quizIdx || 0)
          setQuizCorrect(state.quizCorrect || 0)
          setQuizDone(state.quizDone || false)
        }
      }
    }

    loadFromSupabase().catch(console.error)
  }, [key, supa])

  // Save quiz state to localStorage and Supabase
  React.useEffect(() => {
    if (!quizOpen) {
      localStorage.removeItem(`cerita_quiz_${key}`)
      // Also clear from Supabase
      const clearFromSupabase = async () => {
        const { data: { user } } = await supa.auth.getUser()
        if (!user) return
        await supa
          .from("user_scores")
          .update({ meta: null })
          .eq("user_id", user.id)
          .eq("type", "cerita_quiz")
          .eq("key", key)
      }
      clearFromSupabase().catch(console.error)
      return
    }
    const state = { quizOpen, quizItems, quizIdx, quizCorrect, quizDone }
    localStorage.setItem(`cerita_quiz_${key}`, JSON.stringify(state))

    // Save to Supabase for cross-device sync
    const saveToSupabase = async () => {
      const { data: { user } } = await supa.auth.getUser()
      if (!user) return
      
      // Cek apakah sudah ada row dengan score
      const { data: existing } = await supa
        .from("user_scores")
        .select("score")
        .eq("user_id", user.id)
        .eq("type", "cerita_quiz")
        .eq("key", key)
        .single()
      
      if (existing && existing.score > 0) {
        // Jika sudah ada score, jangan timpa quiz state (quiz sudah selesai)
        return
      }
      
      await supa
        .from("user_scores")
        .upsert({
          user_id: user.id,
          type: "cerita_quiz",
          key,
          score: 0, // Will be updated when quiz is done
          meta: { quizState: state }
        }, {
          onConflict: "user_id_type_key"
        })
    }
    saveToSupabase().catch(console.error)
  }, [quizOpen, quizItems, quizIdx, quizCorrect, quizDone, key, supa])

  /* ── Autoplay (baca otomatis berurutan) ── */
  const [autoplayOn, setAutoplayOn] = React.useState(false)
  const [activeWordIdx, setActiveWordIdx] = React.useState<{ paraIdx: number; wordIdx: number } | null>(null)
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

  // Target level highlight: story ber-badge "HSK 1" -> hanya kosakata
  // hsk_level === 1 yang di-highlight/klik. Kata di luar level itu (termasuk
  // entri word_compounds yang memang tidak punya hsk_level) tampil sebagai
  // teks biasa — sengaja, biar user tetap ada usaha nyari sendiri.
  const targetHskLevel = React.useMemo(() => {
    const match = data?.badge.match(/\d+/)
    return match ? Number(match[0]) : null
  }, [data?.badge])

  // Deteksi otomatis nama tokoh / istilah yang tidak terdaftar sebagai
  // compound (mis. "李明"): kalau ada 2 karakter yang masing-masing valid
  // sebagai vocab SATUAN tapi tidak terdaftar sebagai satu kesatuan, dan
  // pasangan itu berulang (>=2x) di cerita yang sama, hampir pasti itu nama
  // orang/istilah khusus penulis. Digabung jadi satu unit polos (tidak
  // di-highlight) supaya tidak dipecah jadi highlight yang menyesatkan.
  const storySegments = React.useMemo(() => {
    if (!data) return [] as SegmentedWord[][]
    const perParagraph = data.paragraphs.map((para) => segmentText(para))

    const bigramCount = new Map<string, number>()
    perParagraph.forEach((segs) => {
      for (let i = 0; i < segs.length - 1; i++) {
        const a = segs[i]
        const b = segs[i + 1]
        if (a.found && b.found && [...a.hanzi].length === 1 && [...b.hanzi].length === 1) {
          const pairKey = a.hanzi + b.hanzi
          bigramCount.set(pairKey, (bigramCount.get(pairKey) ?? 0) + 1)
        }
      }
    })

    return perParagraph.map((segs) => {
      const merged: SegmentedWord[] = []
      let i = 0
      while (i < segs.length) {
        const a = segs[i]
        const b = segs[i + 1]
        const isRepeatedNamePair =
          b &&
          a.found && b.found &&
          [...a.hanzi].length === 1 && [...b.hanzi].length === 1 &&
          (bigramCount.get(a.hanzi + b.hanzi) ?? 0) >= 2
        if (isRepeatedNamePair) {
          merged.push({ hanzi: a.hanzi + b.hanzi, found: false })
          i += 2
        } else {
          merged.push(a)
          i += 1
        }
      }
      return merged
    })
  }, [data])

  const getScrollEl = React.useCallback((): HTMLElement | null => {
    // Halaman ini dirender di dalam layout dashboard normal, jadi scroll
    // container sebenarnya adalah wrapper `overflow-auto` satu level di atas.
    return (rootRef.current?.closest(".overflow-auto") as HTMLElement | null) ?? rootRef.current
  }, [])

  /* ── Load data ── */
  React.useEffect(() => {
    let cancelled = false

    async function load() {
      const [metaRes, parasRes] = await Promise.all([
        supa.from("cerita_sets").select("title, title_zh, badge, quiz_questions").eq("key", key).single(),
        supa.from("cerita_paragraphs").select("para_index, hanzi_text").eq("cerita_key", key).order("para_index", { ascending: true }),
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

      const paragraphs = (parasRes.data ?? []).map((p) => p.hanzi_text)

      // Muat SELURUH cache kosakata global (flashcard_cards + word_compounds)
      // supaya kata multi-karakter seperti "你好" bisa dikenali saat segmentasi.
      await initGlobalSearchCache()

      if (cancelled) return

      setData({
        title: metaRes.data.title,
        title_zh: metaRes.data.title_zh ?? "",
        badge: metaRes.data.badge ?? "HSK 1",
        paragraphs,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        console.log("[Cerita] Progress reached 95%+, triggering notification check")
        
        // Kirim notifikasi saat cerita selesai dibaca (sekali saja)
        const notifKey = `cerita_completed_${key}`
        const alreadyNotified = localStorage.getItem(notifKey)
        console.log("[Cerita] Notification check:", { alreadyNotified, hasData: !!data })
        
        if (!alreadyNotified && data) {
          console.log("[Cerita] Calling createCeritaCompletedNotification for:", data.title)
          createCeritaCompletedNotification(data.title)
            .then(() => {
              console.log("[Cerita] Notification promise resolved, setting localStorage")
              localStorage.setItem(notifKey, "true")
            })
            .catch((err) => console.error("[Cerita] Failed to create notification:", err))
        } else {
          console.log("[Cerita] Skipped notification - already notified or no data")
        }
      }
    } else if (current - lastSavedPctRef.current >= 5 || (current === 0 && lastSavedPctRef.current !== 0)) {
      lastSavedPctRef.current = current
      setCeritaProgress(key, current)
    }
  }, [getScrollEl, key, data])

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
    cancelTTS()
    setAutoplayOn(false)
    setActiveWordIdx(null)
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

    const cancelled = () => autoplayStopRef.current || runId !== autoplayRunIdRef.current

    for (let i = 0; i < data.paragraphs.length; i++) {
      if (cancelled()) return
      paragraphRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })

      const segments = storySegments[i] ?? []

      // Highlight & baca kata per kata
      for (let j = 0; j < segments.length; j++) {
        if (cancelled()) return

        // Tanda baca dilewati: tidak di-highlight dan tidak dibaca
        if (isPunct(segments[j].hanzi)) continue

        setActiveWordIdx({ paraIdx: i, wordIdx: j })

        await speakMandarin(segments[j].hanzi, { rate: AUTOPLAY_SPEEDS[speedIdxRef.current].rate })
        if (cancelled()) return

        // Jeda kecil antar kata
        await new Promise((resolve) => setTimeout(resolve, 400))
      }

      setActiveWordIdx(null)

      // Jeda antar paragraf
      await new Promise((resolve) => setTimeout(resolve, 1000))
      if (cancelled()) return
    }

    if (runId === autoplayRunIdRef.current) {
      setAutoplayOn(false)
      setActiveWordIdx(null)
    }
  }, [data, storySegments])

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

  function openWordPopover(seg: SegmentedWord, e: React.MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    // pinyin/arti sudah ikut dari hasil segmentText() (cache global),
    // jadi tidak perlu query ulang ke Supabase.
    setPopover({
      word: seg.hanzi,
      pinyin: seg.pinyin || "Tidak ditemukan",
      arti: seg.arti || "Tidak ditemukan",
      x: Math.min(Math.max(rect.left, 12), window.innerWidth - 232),
      y: rect.bottom + 8,
    })
    speakMandarin(seg.hanzi, { silent: true })
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

  const fontSize = FONT_LEVELS[fontLevel]

  return (
    <div ref={rootRef} className={styles.page}>
      <PracticeHeader
        title={data.title_zh || data.title}
        subtitle={data.title_zh ? data.title : undefined}
        progress={pct}
        headerActions={
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
              className="grid h-7 w-7 place-items-center rounded-lg border border-border/60 bg-background/60 text-foreground hover:bg-muted"
              aria-label="Reset progress"
              title="Reset progress"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        {data.paragraphs.map((para, pi) => {
          const segments = storySegments[pi] ?? []
          const isWordActive = activeWordIdx?.paraIdx === pi
          return (
            <p
              key={pi}
              ref={(el) => { paragraphRefs.current[pi] = el }}
              style={{ fontSize }}
              className="font-hanzi relative mb-5 rounded-lg leading-loose text-foreground"
            >
              {segments.map((seg, si) => {
                const isPunctuation = isPunct(seg.hanzi)

                // Highlight hanya untuk kosakata yang levelnya PAS sama dengan
                // target HSK cerita ini. Kata lain tampil sebagai teks biasa
                // (tidak di-highlight, tidak bisa diklik) — sengaja.
                const shouldHighlight =
                  !isPunctuation && seg.found && (targetHskLevel === null || seg.hsk === targetHskLevel)

                // Tanda baca tidak pernah jadi "kata aktif" saat autoplay
                const isCurrentWord = !isPunctuation && isWordActive && activeWordIdx?.wordIdx === si

                return !shouldHighlight ? (
                  <span
                    key={si}
                    className={`inline-block mr-1 transition-colors ${isCurrentWord ? "bg-primary/20 px-1 rounded" : ""}`}
                  >
                    {seg.hanzi}
                  </span>
                ) : (
                  <button
                    key={si}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openWordPopover(seg, e)
                    }}
                    className={`rounded-sm px-0.5 text-primary transition-colors hover:bg-primary/20 ${
                      isCurrentWord ? "bg-primary/30" : "bg-primary/10"
                    }`}
                  >
                    {seg.hanzi}
                  </button>
                )
              })}
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
          <div ref={quizPanelRef} className="mb-8">
            {quizItems.length === 0 ? (
              <Card className="rounded-2xl border border-border/60 bg-card/50 p-5">
                <p className="py-6 text-center text-sm text-muted-foreground">Soal belum tersedia untuk cerita ini.</p>
              </Card>
            ) : quizDone ? (
              <QuizResult
                correct={quizCorrect}
                total={quizItems.length}
                onRetry={startQuiz}
                onClose={() => setQuizOpen(false)}
              />
            ) : (
              <Card className="rounded-2xl border border-border/60 bg-card/50 p-5">
                <QuizQuestionCard
                  question={quizItems[quizIdx]}
                  index={quizIdx}
                  total={quizItems.length}
                  selected={quizSelected}
                  onAnswer={answerQuiz}
                  onNext={nextQuiz}
                />
              </Card>
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
  const hanziWatermark = "完"
  const title = pct >= 80 ? "Hebat!" : pct >= 60 ? "Lumayan!" : "Terus Berlatih!"

  return (
    <Card className="w-full border-border/50 bg-card/50 backdrop-blur-sm shadow-lg mb-6">
      <CardContent className="flex flex-col items-center gap-6 p-8 relative overflow-hidden">
        {/* Watermark */}
        <div
          aria-hidden="true"
          className="absolute select-none pointer-events-none text-foreground/[0.05] dark:text-foreground/[0.07] font-hanzi"
          style={{
            fontSize: "12rem",
            lineHeight: 1,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {hanziWatermark}
        </div>

        {/* Header */}
        <div className="flex flex-col items-center gap-1 relative z-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{correct} dari {total} soal benar</p>
        </div>

        {/* Ring akurasi */}
        <div className="relative z-10 flex items-center justify-center">
          {(() => {
            const circumference = 2 * Math.PI * 54
            return (
              <svg width="152" height="152" viewBox="0 0 120 120" className="-rotate-90">
                <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/60" />
                <circle
                  cx="60" cy="60" r="54" fill="none"
                  stroke={pct >= 80 ? "#34d399" : pct >= 60 ? "#fbbf24" : "#f87171"}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (pct / 100) * circumference}
                  style={{ transition: "stroke 400ms ease" }}
                />
              </svg>
            )
          })()}
          <div className="absolute flex flex-col items-center">
            <span className="text-4xl font-bold text-foreground tabular-nums">{pct}%</span>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Skor</span>
          </div>
        </div>

        {/* Rincian penilaian */}
        <div className="flex flex-wrap justify-center gap-2 relative z-10">
          <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /></span>
            <span className="text-sm font-semibold text-emerald-500 tabular-nums">{correct}</span>
            <span className="text-xs text-muted-foreground">Benar</span>
          </div>
          <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/25">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-red-500/15 text-red-500"><XCircle className="h-3.5 w-3.5" /></span>
            <span className="text-sm font-semibold text-red-500 tabular-nums">{wrong}</span>
            <span className="text-xs text-muted-foreground">Salah</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 w-full max-w-xs relative z-10">
          <Button variant="outline" className="flex-1 rounded-2xl h-11" onClick={onRetry}><RotateCcw className="h-4 w-4 mr-2" />Coba Lagi</Button>
          <Button variant="secondary" className="flex-1 rounded-2xl h-11" onClick={onClose}>Tutup</Button>
        </div>
      </CardContent>
    </Card>
  )
}