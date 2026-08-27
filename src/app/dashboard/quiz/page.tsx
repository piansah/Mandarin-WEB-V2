"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Lock, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useSupabase } from "@/hooks/use-supabase"
import { HskLevelFilter } from "@/components/hsk-level-filter"
import { useUnlockedHSK, clampToUnlockedLevel, lockedLevelMessage } from "@/lib/tier-unlock"

type QuizSet = {
  id: number
  key: string
  title: string
  sub: string
  badge: string
  hsk_level: number
}

type ScoreMap = Record<string, number>

function getLocalScores(): ScoreMap {
  if (typeof window === "undefined") return {}
  try {
    const state = JSON.parse(localStorage.getItem("hsk_quiz_state") ?? "{}")
    const scores: ScoreMap = {}
    for (const [key, val] of Object.entries(state)) {
      const s = val as { answered?: Record<string, boolean>; submitted?: boolean }
      if (s.submitted && s.answered) {
        scores[key] = Object.values(s.answered).filter(Boolean).length
      }
    }
    return scores
  } catch { return {} }
}

export default function QuizListPage() {
  const router = useRouter()
  const supa = useSupabase()
  const [sets, setSets] = React.useState<QuizSet[]>([])
  const [scores, setScores] = React.useState<ScoreMap>({})
  const [loading, setLoading] = React.useState(true)
  const [selectedLevel, setSelectedLevel] = React.useState(1)

  React.useEffect(() => {
    setScores(getLocalScores())
  }, [])

  React.useEffect(() => {
    supa
      .from("quiz_sets")
      .select("id, key, title, sub, badge, hsk_level")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setSets(data ?? [])
        setLoading(false)
      })
  }, [supa])

  const unlockedHSK = useUnlockedHSK()
  const levels = React.useMemo(() => [...new Set(sets.map((set) => set.hsk_level))].sort((a, b) => a - b), [sets])
  const rawLevel = levels.includes(selectedLevel) ? selectedLevel : levels.includes(1) ? 1 : levels[0]
  const effectiveLevel = unlockedHSK ? clampToUnlockedLevel(rawLevel, unlockedHSK) : rawLevel
  const isLevelLocked = !!unlockedHSK && !unlockedHSK.includes(effectiveLevel)
  const visibleQuizzes = React.useMemo(() => sets.filter((set) => set.hsk_level === effectiveLevel), [sets, effectiveLevel])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (sets.length === 0) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4 min-h-[50vh] text-center p-8">
        <div className="text-5xl">📭</div>
        <p className="text-muted-foreground text-sm">Belum ada quiz yang tersedia.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Quiz Harian</h1>
        </div>
        <p className="text-sm text-muted-foreground">100 soal · 4 bagian · Pinyin, Hanzi, Kalimat</p>
      </div>

      <section className="flex flex-col gap-5">
        <HskLevelFilter
          levels={levels}
          selectedLevel={effectiveLevel}
          onChange={setSelectedLevel}
          unlockedLevels={unlockedHSK ?? undefined}
        />

        {isLevelLocked ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{lockedLevelMessage(effectiveLevel)}</p>
        ) : visibleQuizzes.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Belum ada quiz untuk HSK {effectiveLevel}.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleQuizzes.map((quiz, index) => {
              const score = scores[quiz.key]
              const isDone = score !== undefined
              const prevKey = index > 0 ? visibleQuizzes[index - 1].key : null
              const prevDone = prevKey ? scores[prevKey] !== undefined : true
              const isLocked = !prevDone

              return (
                <button
                  key={quiz.key}
                  type="button"
                  disabled={isLocked}
                  onClick={() => router.push(`/dashboard/practice/quiz/${quiz.key}`)}
                  className="group block text-left disabled:cursor-not-allowed"
                >
                  <Card className={`flex h-full flex-col border-border/50 bg-card/50 backdrop-blur-sm transition-all ${isLocked ? "opacity-55" : "hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
                        {quiz.badge || `HSK ${quiz.hsk_level}`}
                      </Badge>
                      {isLocked ? (
                        <Badge variant="secondary" className="gap-1 border-transparent bg-muted text-[10px] uppercase text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          Kunci
                        </Badge>
                      ) : isDone ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
                          {score}/100
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="border-transparent bg-muted text-[10px] uppercase text-muted-foreground">
                          Belum
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col p-4 pt-2">
                      <h3 className="mb-1 text-sm font-bold leading-tight transition-colors group-hover:text-primary">{quiz.title}</h3>
                      <p className="text-xs text-muted-foreground">{quiz.sub}</p>
                      <p className="mb-4 mt-3 text-xs text-primary/80">100 Soal · HSK {quiz.hsk_level}</p>
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
