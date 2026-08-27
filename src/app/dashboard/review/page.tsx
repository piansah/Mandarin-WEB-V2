"use client"

import * as React from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { fetchDueFlashcards, recordSrsReview, type DueFlashcard } from "@/lib/srs"
import { SwipeFlashcardSession, type SwipeFlashcard } from "@/components/swipe-flashcard-session"

export default function ReviewPage() {
  const supa = useSupabase()
  const [cards, setCards] = React.useState<SwipeFlashcard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [userId, setUserId] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      const { data: { user } } = await supa.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      setUserId(user.id)
      const due = await fetchDueFlashcards(supa, user.id)
      // Convert DueFlashcard to SwipeFlashcard
      const swipeCards: SwipeFlashcard[] = due.map(card => ({
        id: card.id,
        hanzi: card.hanzi,
        pinyin: card.pinyin,
        arti: card.arti,
        setId: card.setId,
        srsLevel: card.srsLevel,
        exampleSentence: card.exampleSentence,
        examplePinyin: card.examplePinyin,
        exampleTranslation: card.exampleTranslation,
        deckTitle: card.deckTitle,
        deckHskLevel: card.deckHskLevel,
      }))
      setCards(swipeCards)
      setLoading(false)
    }
    load()
  }, [supa])

  const handleReview = React.useCallback(async (card: SwipeFlashcard, quality: 0 | 3 | 4 | 5) => {
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return
    await recordSrsReview(supa, user.id, String(card.id), quality, card.srsLevel ?? 0)
  }, [supa])

  const wordDetailPath = React.useCallback((card: SwipeFlashcard) => {
    if (card.setId == null) return null
    return `/dashboard/flashcard/${card.setId}/word/${card.id}`
  }, [])

  const deckTitle = cards.length > 0 ? cards[0].deckTitle : "Review Kartu"
  const deckLevel = cards.length > 0 && cards[0].deckHskLevel ? `Level HSK ${cards[0].deckHskLevel}` : "SRS - Kartu Jatuh Tempo"

  return (
    <SwipeFlashcardSession
      cards={cards}
      loading={loading}
      emptyTitle="Semua kartu sudah direview!"
      emptyEmoji="✅"
      wordDetailPath={wordDetailPath}
      onReview={handleReview}
      deckTitle={deckTitle}
      deckLevel={deckLevel}
      userId={userId}
      disableSwipe={true}
    />
  )
}
