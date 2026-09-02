"use client"

/**
 * Mini demo animasi untuk slide fitur di onboarding (`/dashboard/placement`).
 *
 * Beda dari versi lama (`app/onboarding.js`) yang manipulasi DOM langsung
 * pakai setTimeout/setInterval global — di sini tiap demo adalah komponen
 * React mandiri (state + effect miliknya sendiri), dan dipasang sebagai
 * `key={step}` di halaman placement sehingga otomatis reset/berhenti saat
 * slide berpindah (unmount) — tidak perlu guard index manual seperti dulu.
 *
 * Kontennya juga disesuaikan ke fitur yang benar-benar ada sekarang, bukan
 * port apa adanya dari demo lama:
 * - Daftar Kata  -> mockup search bar + hasil kata (pakai TonePinyin & HskBadge asli)
 * - Flashcard    -> stack 3 kartu yang "geser" satu-satu (representasi SRS)
 * - Modul Belajar-> jalur/roadmap modul yang terbuka bertahap (fitur ini "segera hadir")
 * - Quiz         -> soal hanzi -> arti dengan 4 opsi, opsi benar ter-highlight
 * - Simulasi Ujian -> timer + progres soal berjalan lalu keluar badge hasil
 */

import * as React from "react"
import { Search, Volume2, CheckCircle2, Lock, Clock } from "lucide-react"
import { TonePinyin } from "@/components/tone-pinyin"
import { HskBadge } from "@/components/hsk-badge"

/** Loop sebuah urutan langkah dengan delay; berhenti otomatis saat unmount. */
function useStepLoop(steps: number, stepDelayMs: number, holdMs: number) {
  const [i, setI] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    function tick(step: number) {
      if (cancelled) return
      setI(step)
      const delay = step === steps - 1 ? holdMs : stepDelayMs
      timer = setTimeout(() => tick((step + 1) % steps), delay)
    }
    tick(0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return i
}

/* ============================================================
   1. DAFTAR KATA — search lalu hasil kata muncul
   ============================================================ */
const VOCAB_QUERY = "nǐ hǎo"
const VOCAB_RESULT = { hanzi: "你好", pinyin: "nǐ hǎo", arti: "Halo / Apa kabar", hsk: 1 }

export function VocabDemo() {
  // 0..len = animasi ngetik, len+1 = tampilkan hasil, len+2 = jeda baca
  const totalChars = VOCAB_QUERY.length
  const step = useStepLoop(totalChars + 3, 90, 1600)
  const typedLen = Math.min(step, totalChars)
  const showResult = step > totalChars
  const pulseIcon = step === totalChars + 1

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm text-foreground">
          {VOCAB_QUERY.slice(0, typedLen)}
          <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-foreground/60 align-middle" />
        </span>
      </div>

      <div
        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300 ${
          showResult ? "translate-y-0 border-primary/30 bg-primary/5 opacity-100" : "translate-y-1 opacity-0"
        }`}
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-hanzi text-lg font-bold">{VOCAB_RESULT.hanzi}</span>
            <HskBadge hskLevel={VOCAB_RESULT.hsk} />
          </div>
          <TonePinyin text={VOCAB_RESULT.pinyin} className="text-xs" />
          <span className="text-xs text-muted-foreground">{VOCAB_RESULT.arti}</span>
        </div>
        <Volume2 className={`h-4 w-4 shrink-0 text-primary transition-transform ${pulseIcon ? "scale-125" : "scale-100"}`} />
      </div>
    </div>
  )
}

/* ============================================================
   2. FLASHCARD — stack kartu SRS yang geser satu-satu
   ============================================================ */
const FC_WORDS = [
  { hanzi: "你好", pinyin: "nǐ hǎo", arti: "Halo", isNew: true },
  { hanzi: "谢谢", pinyin: "xiè xie", arti: "Terima kasih" },
  { hanzi: "再见", pinyin: "zài jiàn", arti: "Sampai jumpa" },
]

export function FlashcardDemo() {
  // per kartu: 0 sisi depan, 1 terbalik (jawaban), 2 sedang geser keluar
  const phase = useStepLoop(FC_WORDS.length * 3, 700, 700)
  const cardIndex = Math.floor(phase / 3) % FC_WORDS.length
  const cardPhase = phase % 3

  return (
    <div className="relative h-36 w-full">
      {[2, 1, 0].map((depth) => {
        const wordIdx = (cardIndex + depth) % FC_WORDS.length
        const word = FC_WORDS[wordIdx]
        const isFront = depth === 0
        const flipped = isFront && cardPhase >= 1
        const swipingOut = isFront && cardPhase === 2

        return (
          <div
            key={depth}
            className="absolute inset-x-6 top-0 flex h-32 flex-col items-center justify-center gap-1 rounded-2xl border border-border/50 bg-card shadow-md transition-all duration-500 ease-out"
            style={{
              zIndex: 10 - depth,
              transform: swipingOut
                ? "translateX(-130%) rotate(-10deg)"
                : `translateY(${depth * 8}px) scale(${1 - depth * 0.05}) rotate(${depth === 2 ? -3 : depth === 1 ? -1.5 : 0}deg)`,
              opacity: swipingOut ? 0 : depth === 2 ? 0.55 : depth === 1 ? 0.8 : 1,
            }}
          >
            {isFront && word.isNew && !flipped && (
              <span className="absolute right-3 top-2.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                Kartu Baru
              </span>
            )}
            {!flipped ? (
              <span className="font-hanzi text-3xl font-bold">{word.hanzi}</span>
            ) : (
              <>
                <TonePinyin text={word.pinyin} className="text-base font-semibold" />
                <span className="text-sm text-muted-foreground">{word.arti}</span>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================
   3. MODUL BELAJAR — roadmap kurikulum yang terbuka bertahap
   ============================================================ */
const MODULES = ["Dasar", "Kosakata Inti", "Tata Bahasa", "Percakapan"]

export function ModulDemo() {
  const unlocked = useStepLoop(MODULES.length + 2, 750, 1400)
  const activeCount = Math.min(unlocked, MODULES.length)

  return (
    <div className="flex w-full flex-col gap-0 rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
      {MODULES.map((name, i) => {
        const done = i < activeCount
        const isLast = i === MODULES.length - 1
        return (
          <div key={name} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                  done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Lock className="h-3 w-3" />}
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 bg-border">
                  <div
                    className="w-0.5 bg-primary transition-all duration-500"
                    style={{ height: done ? "100%" : "0%" }}
                  />
                </div>
              )}
            </div>
            <div className={`pb-5 pt-0.5 text-sm ${done ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {name}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================
   4. QUIZ — soal hanzi -> arti, opsi benar ter-highlight
   ============================================================ */
const QUIZ = { hanzi: "猫", options: ["Kucing", "Anjing", "Burung", "Ikan"], correct: 0 }

export function QuizDemo() {
  const step = useStepLoop(QUIZ.options.length + 2, 260, 1800)
  const visibleCount = Math.min(step, QUIZ.options.length)
  const showCorrect = step > QUIZ.options.length

  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
      <span className="font-hanzi text-3xl font-bold">{QUIZ.hanzi}</span>
      <span className="text-xs text-muted-foreground">Apa artinya?</span>
      <div className="grid w-full grid-cols-2 gap-2">
        {QUIZ.options.map((opt, i) => {
          const visible = i < visibleCount
          const isCorrect = showCorrect && i === QUIZ.correct
          return (
            <div
              key={opt}
              className={`rounded-xl border px-3 py-2 text-center text-xs font-medium transition-all duration-300 ${
                isCorrect
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border/50 bg-background/60 text-foreground"
              }`}
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(8px)",
              }}
            >
              <span className="inline-flex items-center gap-1">
                {opt}
                {isCorrect && <CheckCircle2 className="h-3 w-3" />}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================
   5. SIMULASI UJIAN — timer + progres soal, lalu hasil
   ============================================================ */
const SIM_TOTAL_SOAL = 40

export function SimulasiDemo() {
  // step 0..8 = soal berjalan, step 9 = hasil muncul
  const step = useStepLoop(10, 380, 1800)
  const showResult = step === 9
  const soalKe = Math.min(4 + step * 4, SIM_TOTAL_SOAL)
  const progressPct = (soalKe / SIM_TOTAL_SOAL) * 100
  const secondsLeft = Math.max(45 * 60 - step * 90, 0)
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0")
  const ss = String(secondsLeft % 60).padStart(2, "0")

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Soal {soalKe}/{SIM_TOTAL_SOAL}</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {mm}:{ss}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div
        className={`flex items-center justify-center gap-2 rounded-xl border py-3 transition-all duration-400 ${
          showResult
            ? "scale-100 border-emerald-500/40 bg-emerald-500/10 opacity-100"
            : "scale-90 border-transparent opacity-0"
        }`}
      >
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">HSK 4 · Lulus</span>
      </div>
    </div>
  )
}