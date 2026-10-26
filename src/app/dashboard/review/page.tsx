"use client"

/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/* 
   page.tsx -- Review - SRS Daily Review Session */

import * as React from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { fetchDueFlashcards, recordSrsReviewBatch, type SrsState } from "@/lib/srs"
import { SwipeFlashcardSession, type SwipeFlashcard } from "@/components/swipe-flashcard-session"

export default function ReviewPage() {
  const supa = useSupabase()
  const [cards, setCards] = React.useState<SwipeFlashcard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [loadError, setLoadError] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error } = await supa.auth.getUser()
        if (error) throw error
        if (!user) return

        setUserId(user.id)
        const due = await fetchDueFlashcards(supa, user.id)
        const swipeCards: SwipeFlashcard[] = due.map(card => ({
          id: card.id,
          hanzi: card.hanzi,
          pinyin: card.pinyin,
          arti: card.arti,
          catatan: card.catatan,
          setId: card.setId,
          srsLevel: card.srsLevel,
          intervalDays: card.intervalDays,
          easeFactor: card.easeFactor,
          exampleSentence: card.exampleSentence,
          examplePinyin: card.examplePinyin,
          exampleTranslation: card.exampleTranslation,
          deckTitle: card.deckTitle,
          deckHskLevel: card.deckHskLevel,
          wordClass: card.wordClass,
        }))
        setCards(swipeCards)
      } catch (error) {
        console.error("Gagal memuat review kosakata:", error)
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supa])

  const handleComplete = React.useCallback(async (
    stats: { mudah: number; lupa: number; sulit: number; ingat: number },
    reviews: { cardId: string; quality: 0 | 3 | 4 | 5; state: SrsState }[]
  ) => {
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return

    if (reviews.length > 0) {
      await recordSrsReviewBatch(supa, user.id, reviews)
    }
  }, [supa])

  const wordDetailPath = React.useCallback((card: SwipeFlashcard) => {
    if (card.setId == null) return null
    return `/dashboard/flashcard/${card.setId}/word/${card.id}`
  }, [])

  return (
    <SwipeFlashcardSession
      cards={cards}
      loading={loading}
      emptyTitle={loadError ? "Review kosakata gagal dimuat" : "Semua kartu sudah direview!"}
      emptyEmoji={loadError ? "⚠️" : "✅"}
      wordDetailPath={wordDetailPath}
      onComplete={handleComplete}
      deckTitle="Review Kosakata"
      deckLevel="Tinjau kartu yang perlu diulang"
      userId={userId}
    />
  )
}
