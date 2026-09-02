"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Clock, Compass, Lock, PartyPopper, Target } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ONBOARDING_SLIDES } from "@/lib/onboarding"
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
// slide hasil. Urutan ini persis mengikuti OB_ONBOARDING_SLIDES ->
// OB_PLACEMENT_SLIDES -> OB_RESULT_SLIDES di versi lama, minus pertanyaan
// preferensi Hanzi yang sudah tidak relevan untuk pengalaman multi-bahasa,
// plus pertanyaan target belajar harian yang baru.
const INTRO_STEPS = ONBOARDING_SLIDES.map((_, i) => `intro-${i}` as const)
const STEPS = [...INTRO_STEPS, "level", "time", "goal", "result"] as const
type Step = (typeof STEPS)[number]

const TOTAL_STEPS = STEPS.length

export default function PlacementPage() {
  const router = useRouter()
  const [step, setStep] = React.useState<Step>(STEPS[0])
  const [level, setLevel] = React.useState<PlacementLevel | null>(null)
  const [dailyGoal, setDailyGoal] = React.useState<PlacementDailyGoal | null>(null)
  const [goal, setGoal] = React.useState<PlacementGoal | null>(null)
  const [saving, setSaving] = React.useState(false)

  const stepIndex = STEPS.indexOf(step)
  const introIndex = step.startsWith("intro-") ? Number(step.split("-")[1]) : -1
  const progressPct = Math.round(((stepIndex + 1) / TOTAL_STEPS) * 100)

  async function handleFinish() {
    if (level === null || dailyGoal === null || goal === null) return
    setSaving(true)
    await submitPlacement({ level, dailyGoal, goal })
    setSaving(false)
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6 px-6 py-10">
      {/* Brand mark — konsisten dengan sidebar, memberi konteks "course"
          yang jelas meski sidebar utama sedang disembunyikan. */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[20%] bg-primary">
          <span className="font-hanzi text-sm font-bold text-white">木</span>
        </div>
        <span className="text-sm font-bold tracking-wide">
          <span>JOURNEY LEARNING</span>
          <span className="ml-0.5 text-primary">.</span>
        </span>
      </div>

      {/* Progress bar tunggal untuk seluruh alur (intro + placement +
          hasil) — kesan "course progress" yang profesional, bukan
          sekadar dot per bagian. */}
      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <Card
        key={step}
        className="animate-in fade-in-0 slide-in-from-bottom-3 rounded-3xl border-border/50 bg-card/70 p-2 shadow-xl ring-1 ring-foreground/5 backdrop-blur-sm duration-300"
      >
        <CardContent className="flex flex-col gap-7 p-6 sm:p-8">
          {introIndex >= 0 && (
            <div className="flex flex-col items-center gap-5 text-center">
              <div
                key={`icon-${introIndex}`}
                className="flex h-20 w-20 animate-in zoom-in-50 items-center justify-center rounded-2xl bg-primary/10 text-4xl duration-300"
              >
                {ONBOARDING_SLIDES[introIndex].emoji}
              </div>
              <div className="flex flex-col items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight">{ONBOARDING_SLIDES[introIndex].title}</h1>
                <Badge variant="secondary" className="uppercase tracking-wide">
                  {ONBOARDING_SLIDES[introIndex].pill}
                </Badge>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {ONBOARDING_SLIDES[introIndex].desc}
                </p>
              </div>
              <div className="flex w-full items-center justify-between gap-3 pt-1">
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
                    setStep(introIndex < INTRO_STEPS.length - 1 ? INTRO_STEPS[introIndex + 1] : "level")
                  }
                >
                  {introIndex < INTRO_STEPS.length - 1 ? "Lanjut" : "Mulai"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === "level" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <Compass className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold tracking-tight">Sejauh mana levelmu saat ini?</h1>
                <Badge variant="secondary" className="uppercase tracking-wide">
                  Langkah 1 dari 3
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Ini menentukan tingkat mana yang langsung terbuka. Nanti tetap bisa maju bertahap kok.
                </p>
              </div>
              <div className="flex flex-col gap-2">
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
                      <CardContent className="flex items-center justify-between gap-3 p-4">
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
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <Clock className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold tracking-tight">Berapa lama kamu mau belajar tiap hari?</h1>
                <Badge variant="secondary" className="uppercase tracking-wide">
                  Langkah 2 dari 3
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Ini jadi target harianmu — bisa diubah kapan saja lewat Settings.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
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
                      <CardContent className="flex flex-col items-center gap-0.5 p-4">
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
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <Target className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold tracking-tight">Tujuan belajar kamu apa?</h1>
                <Badge variant="secondary" className="uppercase tracking-wide">
                  Langkah 3 dari 3
                </Badge>
                <p className="text-sm text-muted-foreground">Bantu kami memahami kebutuhanmu.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                      <CardContent className="p-4 text-sm font-semibold">{opt.title}</CardContent>
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
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 animate-in zoom-in-50 items-center justify-center rounded-2xl bg-primary/10 duration-300">
                <PartyPopper className="h-8 w-8 text-primary" />
              </div>
              <div className="flex flex-col items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight">Tingkat awal kamu sudah siap!</h1>
                <Badge variant="secondary" className="uppercase tracking-wide">
                  Selesai
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Berdasarkan jawabanmu, ini tingkat yang langsung terbuka:
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 text-left">
                {tierPreview(level).map((t) => (
                  <div
                    key={t.tier}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
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
        </CardContent>
      </Card>
    </div>
  )
}
