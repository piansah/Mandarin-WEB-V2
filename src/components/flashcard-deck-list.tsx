"use client"

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HskLevelFilter } from "@/components/hsk-level-filter"
import { getUserScoresByType } from "@/lib/user-scores"

export type FlashcardSet = {
  id: number
  title: string
  description: string | null
  hsk_level: number | null
  badge: string | null
  wordCount: number
}

export function FlashcardDeckList({ sets }: { sets: FlashcardSet[] }) {
  const levels = [...new Set(sets.map(set => set.hsk_level ?? 1))].sort((a, b) => a - b)
  const [selectedLevel, setSelectedLevel] = React.useState(1)
  const decks = sets.filter(deck => (deck.hsk_level ?? 1) === selectedLevel)

  const [scores, setScores] = React.useState<Record<string, number>>({})
  React.useEffect(() => {
    getUserScoresByType("fc_session").then(setScores)
  }, [])

  return (
    <section className="flex flex-col gap-5">
      <HskLevelFilter levels={levels} selectedLevel={selectedLevel} onChange={setSelectedLevel} />

      {decks.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Belum ada deck untuk HSK {selectedLevel}.</p> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {decks.map(deck => {
          const score = scores[String(deck.id)]
          const isDone = score !== undefined
          return (
            <Link href={`/dashboard/flashcard/${deck.id}`} key={deck.id} className="group block"><Card className="flex h-full flex-col border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"><CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2"><Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">{deck.badge ?? `HSK ${deck.hsk_level ?? 1}`}</Badge>{isDone ? <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">{score}%</Badge> : <Badge variant="secondary" className="border-transparent bg-muted text-[10px] uppercase text-muted-foreground">Belum</Badge>}</CardHeader><CardContent className="flex flex-1 flex-col p-4 pt-2"><h3 className="mb-1 text-sm font-bold leading-tight transition-colors group-hover:text-primary">{deck.title}</h3><p className="text-xs text-muted-foreground">{deck.description ?? ""}</p><p className="mb-4 mt-3 text-xs text-primary/80">{deck.wordCount} Kosakata · HSK {deck.hsk_level ?? 1}</p><div className="mt-auto"><Button size="sm" variant="secondary" className="h-7 w-full border-0 bg-primary/15 text-xs text-primary hover:bg-primary/25">Buka</Button></div></CardContent></Card></Link>
          )
        })}
      </div>}
    </section>
  )
}
