"use client"

import * as React from "react"
import Link from "next/link"
import { BookMarked } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/browser"
import { HskLevelFilter } from "@/components/hsk-level-filter"
import { getCeritaProgress } from "@/lib/cerita-progress"
import { getUserScoresByType } from "@/lib/user-scores"

type CeritaSet = {
  key: string
  title: string
  title_zh: string | null
  description: string | null
  badge: string | null
  hsk_level: number
  total_chars: number | null
}

export default function CeritaListPage() {
  const [sets, setSets] = React.useState<CeritaSet[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedLevel, setSelectedLevel] = React.useState(1)
  const [progress, setProgress] = React.useState<Record<string, number>>({})
  const [quizScores, setQuizScores] = React.useState<Record<string, number>>({})

  React.useEffect(() => {
    setProgress(getCeritaProgress())
    getUserScoresByType("cerita_quiz").then(setQuizScores)
  }, [])

  React.useEffect(() => {
    const supa = createClient()
    supa
      .from("cerita_sets")
      .select("key, title, title_zh, description, badge, hsk_level, total_chars, sort_order")
      .eq("is_published", true)
      .order("hsk_level", { ascending: true })
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message)
        } else {
          setSets((data ?? []) as CeritaSet[])
        }
        setLoading(false)
      })
  }, [])

  const levels = React.useMemo(() => [...new Set(sets.map((set) => set.hsk_level))].sort((a, b) => a - b), [sets])
  const effectiveLevel = levels.includes(selectedLevel) ? selectedLevel : levels.includes(1) ? 1 : levels[0]
  const visible = React.useMemo(() => sets.filter((set) => set.hsk_level === effectiveLevel), [sets, effectiveLevel])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm text-red-400">Gagal memuat cerita: {error}</p>
      </div>
    )
  }

  if (sets.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <BookMarked className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Belum ada cerita yang tersedia.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Baca</h1>
        </div>
        <p className="text-sm text-muted-foreground">Baca cerita pendek untuk melatih pemahaman bacaan.</p>
      </div>

      <section className="flex flex-col gap-5">
        <HskLevelFilter levels={levels} selectedLevel={effectiveLevel} onChange={setSelectedLevel} />

        {visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Belum ada cerita untuk HSK {effectiveLevel}.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((set) => {
              const pct = progress[set.key]
              const quizScore = quizScores[set.key]
              const isDone = (pct !== undefined && pct >= 95) || quizScore !== undefined
              const inProgress = !isDone && pct !== undefined && pct > 0 && pct < 95
              const chars = set.total_chars ? `${set.total_chars} karakter` : "—"

              return (
                <Link key={set.key} href={`/dashboard/cerita/${set.key}`} className="group block">
                  <Card className="flex h-full flex-col border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5">
                    <CardContent className="flex flex-1 flex-col p-4">
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
                          {set.badge || `HSK ${set.hsk_level}`}
                        </Badge>
                        {isDone ? (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
                            Selesai
                          </Badge>
                        ) : inProgress ? (
                          <Badge variant="secondary" className="bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400">
                            {pct}%
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-muted text-[10px] text-muted-foreground">
                            Belum
                          </Badge>
                        )}
                      </div>
                      <h3 className="mb-1 mt-3 text-sm font-bold leading-tight transition-colors group-hover:text-primary">{set.title}</h3>
                      {set.title_zh && <p className="mb-1 font-hanzi text-sm text-muted-foreground/80">{set.title_zh}</p>}
                      <p className="mt-2 min-h-10 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{set.description ?? ""}</p>
                      <p className="mb-4 mt-3 text-xs text-primary/80">{chars}</p>
                      <span className="mt-auto inline-flex h-7 w-full items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary transition-colors group-hover:bg-primary/25">
                        Baca
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
