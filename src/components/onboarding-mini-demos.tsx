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
 * - Selamat Datang -> brand mark + jalur mini yang menyala bertahap (ganti emoji)
 * - Daftar Kata  -> mockup search bar + hasil kata (pakai TonePinyin & HskBadge asli)
 * - Flashcard    -> hanzi tetap tampil, pinyin & arti terungkap di bawahnya (representasi SRS)
 * - Modul Belajar-> jalur/roadmap modul yang terbuka bertahap (fitur ini "segera hadir")
 * - Quiz         -> soal hanzi -> arti dengan 4 opsi, opsi benar ter-highlight
 * - Estafet      -> kartu kalimat, ketuk untuk ungkap pinyin lalu arti secara bertahap
 * - Simulasi Ujian -> soal & opsi jawaban berjalan otomatis dengan timer, lalu badge hasil
 * - Preparing    -> layar transisi "menyiapkan pelajaran" antara intro & placement
 */

import * as React from "react"
import { Search, Check, CheckCircle2, Clock } from "lucide-react"
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
   0. SELAMAT DATANG — brand mark besar berdiri sendiri, tanpa card
      pembungkus dan tanpa animasi tambahan (menggantikan ikon emoji
      👋 generik). Momen hero yang tenang, bukan mockup fitur.
   ============================================================ */
export function WelcomeDemo() {
    return (
        <div className="flex min-h-[240px] w-full items-center justify-center">
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-[24%] bg-primary/15"
                    style={{ animationDuration: "2.4s" }}
                />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-[24%] bg-primary shadow-xl shadow-primary/25">
                    <span className="font-hanzi text-5xl font-bold text-white">木</span>
                </div>
            </div>
        </div>
    )
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
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300 ${showResult ? "translate-y-0 border-primary/30 bg-primary/5 opacity-100" : "translate-y-1 opacity-0"
                    }`}
            >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="font-hanzi shrink-0 text-lg font-bold">{VOCAB_RESULT.hanzi}</span>
                    <div className="flex min-w-0 flex-col text-left">
                        <TonePinyin text={VOCAB_RESULT.pinyin} className="text-xs" />
                        <span className="truncate text-xs text-muted-foreground">{VOCAB_RESULT.arti}</span>
                    </div>
                </div>
                <HskBadge hskLevel={VOCAB_RESULT.hsk} className="shrink-0" />
            </div>
        </div>
    )
}

/* ============================================================
   2. FLASHCARD — hanzi tetap tampil, pinyin & arti terungkap di bawah
   ============================================================ */
const FC_WORDS = [
    { hanzi: "你好", pinyin: "nǐ hǎo", arti: "Halo" },
    { hanzi: "谢谢", pinyin: "xiè xie", arti: "Terima kasih" },
    { hanzi: "再见", pinyin: "zài jiàn", arti: "Sampai jumpa" },
]

export function FlashcardDemo() {
    // per kartu: 0 hanzi saja, 1 pinyin+arti terungkap, 2 geser keluar
    const phase = useStepLoop(FC_WORDS.length * 3, 700, 1000)
    const cardIndex = Math.floor(phase / 3) % FC_WORDS.length
    const cardPhase = phase % 3
    const word = FC_WORDS[cardIndex]
    const revealed = cardPhase >= 1
    const swipingOut = cardPhase === 2

    return (
        <div className="relative h-40 w-full">
            {/* Tumpukan kartu di belakang — sekadar kesan "masih ada kartu lain" */}
            {[2, 1].map((depth) => (
                <div
                    key={depth}
                    className="absolute inset-x-8 top-2 h-32 rounded-2xl border border-border/40 bg-card/70"
                    style={{
                        zIndex: 10 - depth,
                        transform: `translateY(${depth * 6}px) scale(${1 - depth * 0.04}) rotate(${depth === 2 ? -3 : -1.5}deg)`,
                        opacity: depth === 2 ? 0.4 : 0.65,
                    }}
                />
            ))}

            {/* Kartu depan — hanzi jadi anchor, pinyin & arti nyusul di bawahnya */}
            <div
                className="absolute inset-x-6 top-0 flex h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-border/50 bg-card shadow-md transition-all duration-500 ease-out"
                style={{
                    zIndex: 10,
                    transform: swipingOut ? "translateX(-130%) rotate(-8deg)" : "translateX(0) rotate(0deg)",
                    opacity: swipingOut ? 0 : 1,
                }}
            >
                <span className="font-hanzi text-4xl font-bold">{word.hanzi}</span>
                <div
                    className="flex flex-col items-center gap-0.5 transition-all duration-300"
                    style={{ opacity: revealed ? 1 : 0, transform: revealed ? "translateY(0)" : "translateY(6px)" }}
                >
                    <TonePinyin text={word.pinyin} className="text-sm font-semibold" />
                    <span className="text-xs text-muted-foreground">{word.arti}</span>
                </div>
            </div>
        </div>
    )
}

/* ============================================================
   3. MODUL BELAJAR — mockup "Bagian dalam Modul": daftar bagian
      bernomor di dalam satu modul, bagian yang sedang dibaca
      tersorot lalu ditandai selesai saat lanjut ke bagian berikutnya.
      Ini yang benar-benar dilihat user saat membuka sebuah modul.
   ============================================================ */
const MODULE_META = "HSK 1 · PERCAKAPAN"
const MODULE_TITLE = "Sapaan & Perkenalan Diri"
const MODULE_SECTIONS = [
    "你好 itu lebih dari sekadar \"Halo\"",
    "Nanya kabar pakai 你好吗",
    "Kenalan pakai 我叫...",
    "Latihan pelafalan singkat",
]

export function ModulDemo() {
    const activeIndex = useStepLoop(MODULE_SECTIONS.length, 1400, 1800)

    return (
        <div className="flex w-full flex-col gap-3 rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">{MODULE_META}</span>
                <h3 className="text-sm font-bold leading-snug text-foreground">{MODULE_TITLE}</h3>
            </div>

            <div className="flex flex-col gap-1">
                {MODULE_SECTIONS.map((title, i) => {
                    const active = i === activeIndex
                    const read = i < activeIndex
                    return (
                        <div
                            key={title}
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-all duration-300 ${active ? "border-primary/40 bg-primary/5" : "border-transparent"
                                }`}
                        >
                            <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-colors duration-300 ${active
                                        ? "bg-primary text-primary-foreground"
                                        : read
                                            ? "bg-primary/15 text-primary"
                                            : "bg-border text-muted-foreground"
                                    }`}
                            >
                                {read ? <Check className="h-2.5 w-2.5" /> : i + 1}
                            </span>
                            <span
                                className={`truncate text-xs transition-colors duration-300 ${active ? "font-semibold text-foreground" : read ? "text-muted-foreground" : "text-muted-foreground/60"
                                    }`}
                            >
                                {title}
                            </span>
                        </div>
                    )
                })}
            </div>
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
                            className={`rounded-xl border px-3 py-2 text-center text-xs font-medium transition-all duration-300 ${isCorrect
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
   5. ESTAFET — kartu kalimat, ketuk untuk ungkap pinyin lalu arti
   ============================================================ */
const ESTAFET_SENTENCE = { hanzi: "我吃饭", pinyin: "wǒ chī fàn", arti: "Saya makan nasi" }

export function EstafetDemo() {
    // 0 hanzi saja (siap diketuk), 1 pinyin terungkap, 2 arti terungkap
    const step = useStepLoop(3, 1500, 2200)
    const showPinyin = step >= 1
    const showArti = step >= 2
    const hint =
        step === 0 ? "Ketuk untuk lihat pinyin" : step === 1 ? "Ketuk lagi untuk lihat arti" : "Kalimat lengkap!"

    return (
        <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
            <div className="relative flex w-full flex-col items-center gap-1 rounded-2xl border border-border/60 bg-background/60 px-4 py-5">
                {step < 2 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                    </span>
                )}
                <span className="font-hanzi text-2xl font-bold">{ESTAFET_SENTENCE.hanzi}</span>
                <div
                    className="min-h-[1.1rem] transition-all duration-300"
                    style={{ opacity: showPinyin ? 1 : 0, transform: showPinyin ? "translateY(0)" : "translateY(4px)" }}
                >
                    <TonePinyin text={ESTAFET_SENTENCE.pinyin} className="text-sm font-semibold text-primary" />
                </div>
                <div
                    className="min-h-[1rem] text-xs text-muted-foreground transition-all duration-300"
                    style={{ opacity: showArti ? 1 : 0, transform: showArti ? "translateY(0)" : "translateY(4px)" }}
                >
                    {ESTAFET_SENTENCE.arti}
                </div>
            </div>
            <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
    )
}

/* ============================================================
   6. SIMULASI UJIAN — soal & opsi berjalan otomatis dengan timer
   ============================================================ */
const SIM_TOTAL_SOAL = 40
const SIM_QUESTIONS = [
    { hanzi: "猫", options: ["Kucing", "Anjing", "Ikan"], correct: 0 },
    { hanzi: "书", options: ["Buku", "Meja", "Pintu"], correct: 0 },
    { hanzi: "喝", options: ["Minum", "Makan", "Lari"], correct: 0 },
]

export function SimulasiDemo() {
    // per soal: 0 tampil, 1 terjawab (jawaban benar ter-highlight)
    const totalPairs = SIM_QUESTIONS.length * 2
    const step = useStepLoop(totalPairs + 1, 700, 2000)
    const showResult = step === totalPairs
    const pairIdx = Math.min(step, totalPairs - 1)
    const qIndex = Math.floor(pairIdx / 2)
    const answered = pairIdx % 2 === 1
    const question = SIM_QUESTIONS[qIndex]

    const soalKe = showResult
        ? SIM_TOTAL_SOAL
        : Math.min(SIM_TOTAL_SOAL, Math.round(((qIndex + (answered ? 1 : 0.4)) / SIM_QUESTIONS.length) * SIM_TOTAL_SOAL))
    const progressPct = (soalKe / SIM_TOTAL_SOAL) * 100
    const secondsLeft = Math.max(45 * 60 - step * 95, 0)
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

            {!showResult ? (
                <div
                    key={qIndex}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-background/60 p-3 animate-in fade-in-0 duration-300"
                >
                    <span className="font-hanzi text-2xl font-bold">{question.hanzi}</span>
                    <div className="grid w-full grid-cols-3 gap-1.5">
                        {question.options.map((opt, i) => {
                            const isCorrect = answered && i === question.correct
                            return (
                                <div
                                    key={opt}
                                    className={`rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition-colors duration-300 ${isCorrect
                                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                            : "border-border/50 bg-card text-foreground"
                                        }`}
                                >
                                    {opt}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-3 animate-in zoom-in-95 fade-in-0 duration-300">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">HSK 4 · Lulus</span>
                </div>
            )}
        </div>
    )
}

/* ============================================================
   PREPARING — transisi "menyiapkan pelajaran" antara slide intro dan
   pertanyaan placement. Brand mark yang berputar pelan + checklist yang
   tercentang satu per satu, menggantikan spinner generik.
   ============================================================ */
const PREP_TASKS = ["Menyusun jalur belajar", "Menyesuaikan tingkat kesulitan", "Menyiapkan latihan harian"]

export function PreparingLessons() {
    const step = useStepLoop(PREP_TASKS.length + 1, 550, 600)
    const doneCount = Math.min(step, PREP_TASKS.length)

    return (
        <div className="flex flex-col items-center gap-6">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                <span
                    className="absolute inline-flex h-full w-full animate-spin rounded-full border-2 border-primary/15 border-t-primary"
                    style={{ animationDuration: "1.1s" }}
                />
                <div className="flex h-9 w-9 items-center justify-center rounded-[20%] bg-primary">
                    <span className="font-hanzi text-sm font-bold text-white">木</span>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {PREP_TASKS.map((task, i) => {
                    const done = i < doneCount
                    const active = i === doneCount
                    return (
                        <div key={task} className="flex items-center gap-2.5">
                            <div
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${done ? "border-primary bg-primary" : "border-border"
                                    }`}
                            >
                                {done && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                            </div>
                            <span
                                className={`text-sm transition-colors duration-300 ${done ? "text-foreground" : active ? "text-foreground/70" : "text-muted-foreground/50"
                                    }`}
                            >
                                {task}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}