"use client"

import * as React from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { fetchDueFlashcards, recordSrsReview, type DueFlashcard } from "@/lib/srs"
import { SwipeFlashcardSession, type SwipeFlashcard } from "@/components/swipe-flashcard-session"

export default function ReviewPage() {
  const supa = useSupabase()
  const [cards, setCards] = React.useState<DueFlashcard[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      const { data: { user } } = await supa.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      const due = await fetchDueFlashcards(supa, user.id)
      setCards(due)
      setLoading(false)
    }
    load()
  }, [supa])

  const handleReview = React.useCallback(async (card: SwipeFlashcard, quality: 0 | 3 | 5) => {
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return
    await recordSrsReview(supa, user.id, String(card.id), quality, card.srsLevel ?? 0)
  }, [supa])

  const wordDetailPath = React.useCallback((card: SwipeFlashcard) => {
    if (card.setId == null) return null
    return `/dashboard/flashcard/${card.setId}/word/${card.id}`
  }, [])

  return (
    <SwipeFlashcardSession
      cards={cards}
      loading={loading}
      emptyTitle="Semua kartu sudah direview!"
      emptyEmoji="✅"
      wordDetailPath={wordDetailPath}
      onReview={handleReview}
    />
  )
}
