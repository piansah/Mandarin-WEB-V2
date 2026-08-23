"use client"

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

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
  const [menuOpen, setMenuOpen] = React.useState(false)
  const filterRef = React.useRef<HTMLDivElement>(null)
  const decks = sets.filter(deck => (deck.hsk_level ?? 1) === selectedLevel)

  React.useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsidePress)
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress)
  }, [])

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">HSK {selectedLevel}</h2>
        <div ref={filterRef} className="relative">
          <button type="button" aria-haspopup="listbox" aria-expanded={menuOpen} className="flex h-10 items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/15" onClick={() => setMenuOpen(open => !open)}>HSK {selectedLevel}<ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} /></button>
          {menuOpen && <div role="listbox" className="absolute right-0 z-20 mt-2 min-w-32 overflow-hidden rounded-xl border border-border/70 bg-card p-1 shadow-xl shadow-black/20">{levels.map(level => <button key={level} type="button" role="option" aria-selected={selectedLevel === level} className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${selectedLevel === level ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`} onClick={() => { setSelectedLevel(level); setMenuOpen(false) }}>HSK {level}</button>)}</div>}
        </div>
      </div>

      {decks.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Belum ada deck untuk HSK {selectedLevel}.</p> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {decks.map(deck => <Link href={`/dashboard/flashcard/${deck.id}`} key={deck.id} className="group block"><Card className="flex h-full flex-col border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"><CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2"><Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">{deck.badge ?? `HSK ${deck.hsk_level ?? 1}`}</Badge><Badge variant="secondary" className="border-transparent bg-muted text-[10px] uppercase text-muted-foreground">Belum</Badge></CardHeader><CardContent className="flex flex-1 flex-col p-4 pt-2"><h3 className="mb-1 text-sm font-bold leading-tight transition-colors group-hover:text-primary">{deck.title}</h3><p className="text-xs text-muted-foreground">{deck.description ?? ""}</p><p className="mb-4 mt-3 text-xs text-primary/80">{deck.wordCount} Kosakata · HSK {deck.hsk_level ?? 1}</p><div className="mt-auto"><Button size="sm" variant="secondary" className="h-7 w-full border-0 bg-primary/15 text-xs text-primary hover:bg-primary/25">Buka</Button></div></CardContent></Card></Link>)}
      </div>}
    </section>
  )
}
