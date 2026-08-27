"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"
import { saveUserScore } from "@/lib/user-scores"
import { SwipeFlashcardSession, type SwipeFlashcard } from "@/components/swipe-flashcard-session"

export default function FlashcardPracticePage() {
  const params = useParams()
  const deckId = Number(params.id)
  const supa = useSupabase()

  const [cards, setCards] = React.useState<SwipeFlashcard[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      const { data } = await supa
        .from("flashcard_cards")
        .select("id, hanzi, pinyin, arti")
        .eq("set_id", deckId)
        .order("created_at", { ascending: true })
      setCards(data ?? [])
      setLoading(false)
    }
    load()
  }, [deckId, supa])

  const wordDetailPath = React.useCallback(
    (card: SwipeFlashcard) => `/dashboard/flashcard/${deckId}/word/${card.id}`,
    [deckId]
  )

  const handleComplete = React.useCallback((stats: { hafal: number; lupa: number; ragu: number }) => {
    const total = stats.hafal + stats.lupa + stats.ragu
    const pct = total > 0 ? Math.round((stats.hafal / total) * 100) : 0
    saveUserScore("fc_session", String(deckId), pct).catch(() => {})
  }, [deckId])

  return (
    <SwipeFlashcardSession
      cards={cards}
      loading={loading}
      wordDetailPath={wordDetailPath}
      onComplete={handleComplete}
    />
  )
}
