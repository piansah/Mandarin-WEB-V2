"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Lock, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/browser"

type KalimatSet = {
  key: string
  title: string
  sub: string
  hsk_level: number
  unlock_after: number | null
}

type ScoreMap = Record<string, number>

function getLocalScores(): ScoreMap {
  if (typeof window === "undefined") return {}
  try {
    const state = JSON.parse(localStorage.getItem("hsk_kal_state") ?? "{}")
    const scores: ScoreMap = {}
    for (const [key, val] of Object.entries(state)) {
      const s = val as {
        answered?: Record<string, boolean>
        kalAnswered?: Record<string, boolean>
        submitted?: boolean
      }
      const answered = s.answered ?? s.kalAnswered
      if (s.submitted && answered) scores[key] = Object.values(answered).filter(Boolean).length
    }
    return scores
  } catch {
    return {}
  }
}

export default function CumulativeQuizListPage() {
  const router = useRouter()
  const [sets, setSets] = React.useState<KalimatSet[]>([])
  const [scores, setScores] = React.useState<ScoreMap>({})
  const [loading, setLoading] = React.useState(true)
  const [selectedLevel, setSelectedLevel] = React.useState(1)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const filterRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setScores(getLocalScores())
  }, [])

  React.useEffect(() => {
    const supa = createClient()
    supa
      .from("kalimat_sets")
      .select("key, title, sub, hsk_level, unlock_after")
      .order("hsk_level", { ascending: true })
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setSets(data ?? [])
        setLoading(false)
      })
  }, [])

  React.useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsidePress)
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress)
  }, [])

  const levels = React.useMemo(() => [...new Set(sets.map((set) => set.hsk_level))].sort((a, b) => a - b), [sets])
  const effectiveLevel = levels.includes(selectedLevel) ? selectedLevel : levels.includes(1) ? 1 : levels[0]
  const visibleSets = React.useMemo(() => sets.filter((set) => set.hsk_level === effectiveLevel), [sets, effectiveLevel])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (sets.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="text-5xl">📭</div>
        <p className="text-sm text-muted-foreground">Belum ada quiz kumulatif yang tersedia.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Quiz Kumulatif</h1>
        </div>
        <p className="text-sm text-muted-foreground">60 soal · 4 bagian · latihan kalimat kumulatif</p>
      </div>

      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">HSK {effectiveLevel}</h2>
          <div ref={filterRef} className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              className="flex h-10 items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
              onClick={() => setMenuOpen((open) => !open)}
            >
              HSK {effectiveLevel}
              <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>
            {menuOpen && (
              <div role="listbox" className="absolute right-0 z-20 mt-2 min-w-32 overflow-hidden rounded-xl border border-border/70 bg-card p-1 shadow-xl shadow-black/20">
                {levels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    role="option"
                    aria-selected={effectiveLevel === level}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${effectiveLevel === level ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
                    onClick={() => {
                      setSelectedLevel(level)
                      setMenuOpen(false)
                    }}
                  >
                    HSK {level}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {visibleSets.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Belum ada quiz kumulatif untuk HSK {effectiveLevel}.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleSets.map((set, index) => {
              const score = scores[set.key]
              const isDone = score !== undefined
              const prevKey = index > 0 ? visibleSets[index - 1].key : null
              const prevDone = prevKey ? scores[prevKey] !== undefined : true
              const isLocked = !prevDone

              return (
                <button
                  key={set.key}
                  type="button"
                  disabled={isLocked}
                  onClick={() => router.push(`/dashboard/practice/quiz/review/${set.key}`)}
                  className="group block text-left disabled:cursor-not-allowed"
                >
                  <Card className={`flex h-full flex-col border-border/50 bg-card/50 backdrop-blur-sm transition-all ${isLocked ? "opacity-55" : "hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">HSK {set.hsk_level}</Badge>
                      {isLocked ? (
                        <Badge variant="secondary" className="gap-1 border-transparent bg-muted text-[10px] uppercase text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          Kunci
                        </Badge>
                      ) : isDone ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">{score}/60</Badge>
                      ) : (
                        <Badge variant="secondary" className="border-transparent bg-muted text-[10px] uppercase text-muted-foreground">Belum</Badge>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col p-4 pt-2">
                      <h3 className="mb-1 text-sm font-bold leading-tight transition-colors group-hover:text-primary">{set.title}</h3>
                      <p className="text-xs text-muted-foreground">{set.sub}</p>
                      <p className="mb-4 mt-3 text-xs text-primary/80">60 Soal · HSK {set.hsk_level}</p>
                      <div className="mt-auto">
                        <span className={`inline-flex h-7 w-full items-center justify-center rounded-md text-xs font-semibold text-primary transition-colors ${isLocked ? "bg-muted/70 text-muted-foreground" : "bg-primary/15 group-hover:bg-primary/25"}`}>
                          {isLocked ? "Terkunci" : "Buka"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
