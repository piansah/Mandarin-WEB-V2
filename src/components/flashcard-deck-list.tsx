"use client"

import * as React from "react"
import Link from "next/link"
import { Lock } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HskLevelFilter } from "@/components/hsk-level-filter"
import { getUserScoresByType } from "@/lib/user-scores"
import { useSupabase } from "@/hooks/use-supabase"
import { useUnlockedHSK, clampToUnlockedLevel, lockedLevelMessage } from "@/lib/tier-unlock"

export type FlashcardSet = {
  id: number
  title: string
  description: string | null
  hsk_level: number | null
  badge: string | null
  wordCount: number
}

export function FlashcardDeckList({ sets }: { sets: FlashcardSet[] }) {
  const supa = useSupabase()
  const unlockedHSK = useUnlockedHSK()
  const levels = [...new Set(sets.map(set => set.hsk_level ?? 1))].sort((a, b) => a - b)
  const [selectedLevel, setSelectedLevel] = React.useState(1)
  const effectiveLevel = unlockedHSK ? clampToUnlockedLevel(selectedLevel, unlockedHSK) : selectedLevel
  const isLevelLocked = !!unlockedHSK && !unlockedHSK.includes(effectiveLevel)
  const decks = sets.filter(deck => (deck.hsk_level ?? 1) === effectiveLevel)

  // Badge "%"/"Belum" di tiap kartu masih pakai skor flashcard-nya sendiri.
  // Buka-kunci Day berikutnya mengikuti skor QUIZ dari Day sebelumnya
  // Flashcard -> Quiz -> Nada/Menulis.
  const [fcScores, setFcScores] = React.useState<Record<string, number>>({})
  const [quizScores, setQuizScores] = React.useState<Record<string, number>>({})

  React.useEffect(() => {
    getUserScoresByType("fc_session").then(setFcScores)
    getUserScoresByType("quiz").then(setQuizScores)
  }, [])

  return (
    <section className="flex flex-col gap-5">
      <HskLevelFilter
        levels={levels}
        selectedLevel={effectiveLevel}
        onChange={setSelectedLevel}
        unlockedLevels={unlockedHSK ?? undefined}
      />

      {isLevelLocked ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{lockedLevelMessage(effectiveLevel)}</p>
      ) : decks.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Belum ada deck untuk HSK {effectiveLevel}.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {decks.map((deck, index) => {
            const score = fcScores[String(deck.id)]
            const isDone = score !== undefined
            const prevDeck = index > 0 ? decks[index - 1] : null
            const prevDone = !prevDeck ? true : quizScores[String(prevDeck.id)] !== undefined
            const isLocked = !prevDone

            const cardInner = (
              <Card
                className={`flex h-full flex-col border-border/50 bg-card/50 backdrop-blur-sm transition-all ${
                  isLocked ? "opacity-55" : "hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
                }`}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
                    {deck.badge ?? `HSK ${deck.hsk_level ?? 1}`}
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
                  <h3 className="mb-1 text-sm font-bold leading-tight transition-colors group-hover:text-primary">{deck.title}</h3>
                  <p className="text-xs text-muted-foreground">{deck.description ?? ""}</p>
                  <p className="mb-4 mt-3 text-xs text-primary/80">{deck.wordCount} Kosakata · HSK {deck.hsk_level ?? 1}</p>
                  <div className="mt-auto">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isLocked}
                      className="h-7 w-full border-0 bg-primary/15 text-xs text-primary hover:bg-primary/25 disabled:opacity-100"
                    >
                      {isLocked ? "Terkunci" : "Buka"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )

            if (isLocked) {
              return (
                <div key={deck.id} className="block cursor-not-allowed">
                  {cardInner}
                </div>
              )
            }

            return (
              <Link href={`/dashboard/flashcard/${deck.id}`} key={deck.id} className="group block">
                {cardInner}
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
