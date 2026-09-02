"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Clock, Compass, Lock, PartyPopper, Target } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ONBOARDING_SLIDES } from "@/lib/onboarding"
import {
  VocabDemo,
  FlashcardDemo,
  ModulDemo,
  QuizDemo,
  EstafetDemo,
  SimulasiDemo,
  WelcomeDemo,
  PreparingLessons,
} from "@/components/onboarding-mini-demos"
import {
  PLACEMENT_LEVEL_OPTIONS,
  DAILY_GOAL_OPTIONS,
  GOAL_OPTIONS,
  tierPreview,
  submitPlacement,
  type PlacementLevel,
  type PlacementDailyGoal,
  type PlacementGoal,
} from "@/lib/placement"

// Slide intro (index "intro-0"..) dijalankan dulu — satu slide per fitur
// utama (lihat ONBOARDING_SLIDES) — baru masuk ke pertanyaan placement +
// slide hasil. "loading" adalah layar transisi singkat antara intro dan
// placement (bukan bagian dari progres manapun), lalu OB_PLACEMENT_SLIDES ->
// OB_RESULT_SLIDES di versi lama, minus pertanyaan preferensi Hanzi yang
// sudah tidak relevan untuk pengalaman multi-bahasa, plus pertanyaan target
// belajar harian yang baru.
const INTRO_STEPS = ONBOARDING_SLIDES.map((_, i) => `intro-${i}` as const)
const PLACEMENT_STEPS = ["level", "time", "goal", "result"] as const
const STEPS = [...INTRO_STEPS, "loading", ...PLACEMENT_STEPS] as const

// Mini demo animasi untuk tiap slide intro (1-6). Index harus sinkron
// dengan urutan di ONBOARDING_SLIDES (lib/onboarding.ts): 0 Selamat
// datang, 1 Daftar Kata, 2 Flashcard, 3 Modul Belajar, 4 Quiz, 5 Estafet,
// 6 Simulasi Ujian. Slide 0 (Selamat datang) ditangani terpisah lewat
// <WelcomeDemo /> tanpa card pembungkus — lihat render di bawah. Ikon
// emoji tetap dipertahankan sebagai fallback bila ada slide baru ditambah
// tanpa demo maupun penanganan khusus.
const INTRO_DEMOS: Partial<Record<number, React.ComponentType>> = {
  1: VocabDemo,
  2: FlashcardDemo,
  3: ModulDemo,
  4: QuizDemo,
  5: EstafetDemo,
  6: SimulasiDemo,
}
type Step = (typeof STEPS)[number]

// Progress bar dipakai berulang di tiap step, ditaruh di bawah teks
// (judul/badge/deskripsi) dan sebelum area interaktif (opsi/tombol).
// Onboarding (intro fitur) dan placement (level/waktu/tujuan/hasil) punya
// progres masing-masing yang independen — bukan satu bar gabungan — supaya
// tiap bagian terasa sebagai alur pendek sendiri, bukan satu proses panjang.
function StepProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function PlacementPage() {
  const router = useRouter()
  const [step, setStep] = React.useState<Step>(STEPS[0])
  const [level, setLevel] = React.useState<PlacementLevel | null>(null)
  const [dailyGoal, setDailyGoal] = React.useState<PlacementDailyGoal | null>(null)
  const [goal, setGoal] = React.useState<PlacementGoal | null>(null)
  const [saving, setSaving] = React.useState(false)

  const introIndex = step.startsWith("intro-") ? Number(step.split("-")[1]) : -1
  const introProgressPct = introIndex >= 0 ? Math.round(((introIndex + 1) / INTRO_STEPS.length) * 100) : 0
  const placementIndex = (PLACEMENT_STEPS as readonly string[]).indexOf(step)
  const placementProgressPct =
    placementIndex >= 0 ? Math.round(((placementIndex + 1) / PLACEMENT_STEPS.length) * 100) : 0

  // Layar transisi "menyiapkan pelajaran" setelah slide intro terakhir,
  // sebelum pertanyaan placement muncul — auto lanjut, tidak perlu tombol.
  // Durasi disamakan dengan animasi checklist di <PreparingLessons /> biar
  // transisinya terasa selesai, bukan terpotong.
  React.useEffect(() => {
    if (step !== "loading") return
    const t = setTimeout(() => setStep("level"), 2300)
    return () => clearTimeout(t)
  }, [step])

  async function handleFinish() {
    if (level === null || dailyGoal === null || goal === null) return
    setSaving(true)
    await submitPlacement({ level, dailyGoal, goal })
    setSaving(false)
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6 px-6 py-8">
      <div key={step} className="flex flex-col gap-5 animate-in fade-in-0 slide-in-from-bottom-3 duration-300">
        {introIndex >= 0 && (
          <div className="flex flex-col items-center gap-4 text-center">
            {introIndex === 0 ? (
              <div key="demo-0" className="w-full animate-in fade-in-0 zoom-in-95 duration-300">
                <WelcomeDemo />
              </div>
            ) : INTRO_DEMOS[introIndex] ? (
              <Card
                key={`demo-${introIndex}`}
                className="flex min-h-[240px] w-full flex-col justify-center animate-in fade-in-0 slide-in-from-bottom-2 rounded-3xl border-border/50 bg-card/70 p-4 shadow-xl ring-1 ring-foreground/5 backdrop-blur-sm duration-300"
              >
                <CardContent className="p-0">{React.createElement(INTRO_DEMOS[introIndex]!)}</CardContent>
              </Card>
            ) : (
              <div
                key={`icon-${introIndex}`}
                className="flex h-20 w-20 animate-in zoom-in-50 items-center justify-center rounded-2xl bg-primary/10 text-4xl duration-300"
              >
                {ONBOARDING_SLIDES[introIndex].emoji}
              </div>
            )}
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{ONBOARDING_SLIDES[introIndex].title}</h1>
              <Badge variant="secondary" className="uppercase tracking-wide">
                {ONBOARDING_SLIDES[introIndex].pill}
              </Badge>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {ONBOARDING_SLIDES[introIndex].desc}
              </p>
            </div>
            <StepProgressBar pct={introProgressPct} />
            <div className="flex w-full items-center justify-between gap-3">
              {introIndex > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setStep(INTRO_STEPS[introIndex - 1])}>
                  Kembali
                </Button>
              ) : (
                <span />
              )}
              <Button
                className="gap-1.5"
                onClick={() =>
                  setStep(introIndex < INTRO_STEPS.length - 1 ? INTRO_STEPS[introIndex + 1] : "loading")
                }
              >
                {introIndex < INTRO_STEPS.length - 1 ? "Lanjut" : "Mulai"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center gap-5 py-10 text-center">
            <PreparingLessons />
            <p className="text-sm font-medium text-muted-foreground">Menyiapkan pelajaran untukmu...</p>
          </div>
        )}

        {step === "level" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <Compass className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold tracking-tight">Sejauh mana levelmu saat ini?</h1>
              <Badge variant="secondary" className="uppercase tracking-wide">
                Langkah 1 dari 3
              </Badge>
              <p className="text-xs text-muted-foreground">
                Ini menentukan tingkat mana yang langsung terbuka. Nanti tetap bisa maju bertahap kok.
              </p>
            </div>
            <StepProgressBar pct={placementProgressPct} />
            <div className="flex flex-col gap-1.5">
              {PLACEMENT_LEVEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setLevel(opt.value)
                    setStep("time")
                  }}
                  className="text-left"
                >
                  <Card
                    className={`border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/40 ${
                      level === opt.value ? "border-primary/60 bg-primary/5" : ""
                    }`}
                  >
                    <CardContent className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <p className="text-sm font-semibold">{opt.title}</p>
                        <p className="text-xs text-muted-foreground">{opt.sub}</p>
                      </div>
                      {level === opt.value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "time" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <Clock className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold tracking-tight">Berapa lama kamu mau belajar tiap hari?</h1>
              <Badge variant="secondary" className="uppercase tracking-wide">
                Langkah 2 dari 3
              </Badge>
              <p className="text-xs text-muted-foreground">
                Ini jadi target harianmu — bisa diubah kapan saja lewat Settings.
              </p>
            </div>
            <StepProgressBar pct={placementProgressPct} />
            <div className="grid grid-cols-2 gap-1.5">
              {DAILY_GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setDailyGoal(opt.value)
                    setStep("goal")
                  }}
                >
                  <Card
                    className={`border-border/50 bg-card/50 backdrop-blur-sm text-center transition-all hover:border-primary/40 ${
                      dailyGoal === opt.value ? "border-primary/60 bg-primary/5" : ""
                    }`}
                  >
                    <CardContent className="flex flex-col items-center gap-0.5 p-3">
                      <p className="text-sm font-semibold">{opt.title}</p>
                      <p className="text-xs text-muted-foreground">{opt.sub}</p>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setStep("level")}>
              Kembali
            </Button>
          </div>
        )}

        {step === "goal" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <Target className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold tracking-tight">Tujuan belajar kamu apa?</h1>
              <Badge variant="secondary" className="uppercase tracking-wide">
                Langkah 3 dari 3
              </Badge>
              <p className="text-xs text-muted-foreground">Bantu kami memahami kebutuhanmu.</p>
            </div>
            <StepProgressBar pct={placementProgressPct} />
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setGoal(opt.value)
                    setStep("result")
                  }}
                >
                  <Card
                    className={`border-border/50 bg-card/50 backdrop-blur-sm text-center transition-all hover:border-primary/40 ${
                      goal === opt.value ? "border-primary/60 bg-primary/5" : ""
                    }`}
                  >
                    <CardContent className="p-3 text-sm font-semibold">{opt.title}</CardContent>
                  </Card>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setStep("time")}>
              Kembali
            </Button>
          </div>
        )}

        {step === "result" && level !== null && (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-16 w-16 animate-in zoom-in-50 items-center justify-center rounded-2xl bg-primary/10 duration-300">
              <PartyPopper className="h-8 w-8 text-primary" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">Tingkat awal kamu sudah siap!</h1>
              <Badge variant="secondary" className="uppercase tracking-wide">
                Selesai
              </Badge>
              <p className="text-xs text-muted-foreground">
                Berdasarkan jawabanmu, ini tingkat yang langsung terbuka:
              </p>
            </div>
            <StepProgressBar pct={placementProgressPct} />
            <div className="flex w-full flex-col gap-1.5 text-left">
              {tierPreview(level).map((t) => (
                <div
                  key={t.tier}
                  className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${
                    t.unlocked ? "border-primary/40 bg-primary/5" : "border-border/50 bg-muted/30"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.hsk}</p>
                  </div>
                  {t.unlocked ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
            <Button className="w-full" disabled={saving} onClick={handleFinish}>
              {saving ? "Menyimpan..." : "Mulai Belajar"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}