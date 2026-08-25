"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Compass, Lock, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ONBOARDING_SLIDES } from "@/lib/onboarding"
import {
  PLACEMENT_LEVEL_OPTIONS,
  HANZI_MODE_OPTIONS,
  GOAL_OPTIONS,
  tierPreview,
  submitPlacement,
  type PlacementLevel,
  type HanziMode,
  type PlacementGoal,
} from "@/lib/placement"

// 6 slide onboarding (index "intro-0".."intro-5") dijalankan dulu, baru
// masuk ke 3 pertanyaan placement + 1 slide hasil — persis urutan
// OB_ONBOARDING_SLIDES -> OB_PLACEMENT_SLIDES -> OB_RESULT_SLIDES di versi lama.
const INTRO_STEPS = ONBOARDING_SLIDES.map((_, i) => `intro-${i}` as const)
const STEPS = [...INTRO_STEPS, "level", "hanzi", "goal", "result"] as const
type Step = (typeof STEPS)[number]

export default function PlacementPage() {
  const router = useRouter()
  const [step, setStep] = React.useState<Step>(STEPS[0])
  const [level, setLevel] = React.useState<PlacementLevel | null>(null)
  const [hanziMode, setHanziMode] = React.useState<HanziMode | null>(null)
  const [goal, setGoal] = React.useState<PlacementGoal | null>(null)
  const [saving, setSaving] = React.useState(false)

  const stepIndex = STEPS.indexOf(step)
  const introIndex = step.startsWith("intro-") ? Number(step.split("-")[1]) : -1

  async function handleFinish() {
    if (level === null || hanziMode === null || goal === null) return
    setSaving(true)
    await submitPlacement({ level, hanziMode, goal })
    setSaving(false)
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 p-6">
      {introIndex === -1 && step !== "result" && (
        <div className="flex items-center gap-1.5">
          {STEPS.slice(INTRO_STEPS.length, INTRO_STEPS.length + 3).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= stepIndex - INTRO_STEPS.length ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      )}

      {introIndex >= 0 && (
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-1.5">
            {INTRO_STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= introIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-6xl">{ONBOARDING_SLIDES[introIndex].emoji}</div>
            <h1 className="text-xl font-bold tracking-tight">{ONBOARDING_SLIDES[introIndex].title}</h1>
            <p className="text-sm text-muted-foreground">{ONBOARDING_SLIDES[introIndex].desc}</p>
          </div>
          <div className="flex items-center justify-between gap-3">
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
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">Sejauh mana Mandarin kamu?</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Ini menentukan tier mana yang langsung terbuka. Nanti tetap bisa maju bertahap kok.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {PLACEMENT_LEVEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setLevel(opt.value)
                  setStep("hanzi")
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

      {step === "hanzi" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight">Mau belajar Hanzi yang mana?</h1>
            <p className="text-sm text-muted-foreground">Cuma preferensi tampilan, bisa diganti kapan saja.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {HANZI_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setHanziMode(opt.value)
                  setStep("goal")
                }}
              >
                <Card
                  className={`border-border/50 bg-card/50 backdrop-blur-sm text-center transition-all hover:border-primary/40 ${
                    hanziMode === opt.value ? "border-primary/60 bg-primary/5" : ""
                  }`}
                >
                  <CardContent className="p-4 text-sm font-semibold">{opt.title}</CardContent>
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
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight">Tujuan belajar kamu apa?</h1>
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
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setStep("hanzi")}>
            Kembali
          </Button>
        </div>
      )}

      {step === "result" && level !== null && (
        <div className="flex flex-col items-center gap-6 text-center">
          <Sparkles className="h-10 w-10 text-primary" />
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight">Tier awal kamu sudah siap!</h1>
            <p className="text-sm text-muted-foreground">
              Berdasarkan jawabanmu, ini tier yang langsung terbuka:
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
    </div>
  )
}
