"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useSupabase } from "@/hooks/use-supabase"
import { getGrammarScores } from "@/lib/grammar-scores"
import { HskLevelFilter } from "@/components/hsk-level-filter"
import { useUnlockedHSK, clampToUnlockedLevel, lockedLevelMessage } from "@/lib/tier-unlock"

type GrammarPattern = {
  id: number
  title: string
  slug: string
  hsk_level: number
  sub_title: string | null
  badge: string | null
}

export default function GrammarListPage() {
  const router = useRouter()
  const supa = useSupabase()
  const [patterns, setPatterns] = React.useState<GrammarPattern[]>([])
  const [scores, setScores] = React.useState<Record<string, number>>({})
  const [loading, setLoading] = React.useState(true)
  const [selectedLevel, setSelectedLevel] = React.useState(1)

  React.useEffect(() => {
    setScores(getGrammarScores())
  }, [])

  React.useEffect(() => {
    supa
      .from("grammar_patterns")
      .select("id, title, slug, hsk_level, sub_title, badge, sort_order")
      .order("hsk_level", { ascending: true })
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setPatterns((data ?? []) as GrammarPattern[])
        setLoading(false)
      })
  }, [supa])

  const unlockedHSK = useUnlockedHSK()
  const levels = React.useMemo(() => [...new Set(patterns.map((item) => item.hsk_level))].sort((a, b) => a - b), [patterns])
  const rawLevel = levels.includes(selectedLevel) ? selectedLevel : levels.includes(1) ? 1 : levels[0]
  const effectiveLevel = unlockedHSK ? clampToUnlockedLevel(rawLevel, unlockedHSK) : rawLevel
  const isLevelLocked = !!unlockedHSK && !unlockedHSK.includes(effectiveLevel)
  const visible = React.useMemo(() => patterns.filter((item) => item.hsk_level === effectiveLevel), [patterns, effectiveLevel])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (patterns.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Belum ada pola grammar yang tersedia.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Grammar</h1>
        </div>
        <p className="text-sm text-muted-foreground">Pelajari pola kalimat, lalu susun kata sesuai urutan yang benar.</p>
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
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Belum ada pola untuk HSK {effectiveLevel}.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((pattern, index) => {
              const score = scores[pattern.slug]
              const isDone = score !== undefined
              const prevSlug = index > 0 ? visible[index - 1].slug : null
              const prevDone = prevSlug ? scores[prevSlug] !== undefined : true
              const isLocked = !prevDone

              return (
                <button
                  key={pattern.slug}
                  type="button"
                  disabled={isLocked}
                  onClick={() => router.push(`/dashboard/practice/grammar/${pattern.slug}`)}
                  className="group block text-left disabled:cursor-not-allowed"
                >
                  <Card className={`flex h-full flex-col border-border/50 bg-card/50 backdrop-blur-sm transition-all ${isLocked ? "opacity-55" : "hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
                        {pattern.badge || `HSK ${pattern.hsk_level}`}
                      </Badge>
                      {isLocked ? (
                        <Badge variant="secondary" className="gap-1 border-transparent bg-muted text-[10px] uppercase text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          Kunci
                        </Badge>
                      ) : isDone ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
                          {score}%
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="border-transparent bg-muted text-[10px] uppercase text-muted-foreground">
                          Belum
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col p-4 pt-2">
                      <h3 className="mb-1 text-sm font-bold leading-tight transition-colors group-hover:text-primary">{pattern.title}</h3>
                      <p className="text-xs text-muted-foreground">{pattern.sub_title || "Susun kata — Grammar"}</p>
                      <div className="mt-auto pt-4">
                        <span className={`inline-flex h-7 w-full items-center justify-center rounded-md text-xs font-semibold transition-colors ${isLocked ? "bg-muted/70 text-muted-foreground" : "bg-primary/15 text-primary group-hover:bg-primary/25"}`}>
                          {isLocked ? "Terkunci" : "Mulai"}
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