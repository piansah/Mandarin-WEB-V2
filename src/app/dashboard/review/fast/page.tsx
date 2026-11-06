"use client"

/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/* 
   page.tsx -- Review Fast Mode - Rapid Review Session */

import * as React from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { fetchDueFlashcards, recordSrsReviewBatch, SRS_REVIEW_BATCH_SIZE, type DueFlashcard, type SrsState } from "@/lib/srs"
import { SwipeFlashcardSession, type SwipeFlashcard } from "@/components/swipe-flashcard-session"

export default function FastReviewPage() {
  const supa = useSupabase()
  const [cards, setCards] = React.useState<SwipeFlashcard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [batchIndex, setBatchIndex] = React.useState(0)

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
        catatan: card.catatan,
        setId: card.setId,
        srsLevel: card.srsLevel,
        intervalDays: card.intervalDays,
        easeFactor: card.easeFactor,
        nextReview: card.nextReview,
        exampleSentence: card.exampleSentence,
        examplePinyin: card.examplePinyin,
        exampleTranslation: card.exampleTranslation,
        deckTitle: card.deckTitle,
        deckHskLevel: card.deckHskLevel,
        wordClass: card.wordClass,
      }))
      setCards(swipeCards)
      setLoading(false)
    }
    load()
  }, [supa])

  const handleComplete = React.useCallback(async (
    stats: { mudah: number; lupa: number; sulit: number; ingat: number },
    reviews: { cardId: string; quality: 0 | 3 | 4 | 5; state: SrsState }[]
  ) => {
    const { data: { user } } = await supa.auth.getUser()
    if (!user) throw new Error("Sesi login berakhir sebelum penilaian tersimpan.")

    if (reviews.length > 0) {
      await recordSrsReviewBatch(supa, user.id, reviews)
    }
  }, [supa])

  const wordDetailPath = React.useCallback((card: SwipeFlashcard) => {
    if (card.setId == null) return null
    return `/dashboard/flashcard/${card.setId}/word/${card.id}`
  }, [])

  const totalSessions = Math.ceil(cards.length / SRS_REVIEW_BATCH_SIZE)
  const batchStart = batchIndex * SRS_REVIEW_BATCH_SIZE
  const activeCards = cards.slice(batchStart, batchStart + SRS_REVIEW_BATCH_SIZE)
  const remainingCount = Math.max(0, cards.length - batchStart - activeCards.length)
  const storageKey = "review-fast"
  const deckTitle = activeCards.length > 0 ? activeCards[0].deckTitle : "Review Kartu"
  const deckLevel = activeCards.length > 0 && activeCards[0].deckHskLevel ? `Level HSK ${activeCards[0].deckHskLevel}` : "Mode Cepat - SRS"

  return (
    <SwipeFlashcardSession
      key={`${storageKey}-batch-${batchIndex}`}
      cards={activeCards}
      loading={loading}
      emptyTitle="Semua kartu sudah direview!"
      emptyEmoji="✅"
      wordDetailPath={wordDetailPath}
      onComplete={handleComplete}
      deckTitle={deckTitle}
      deckLevel={deckLevel}
      userId={userId}
      disableSwipe={false}
      deckCardIds={activeCards.map(card => String(card.id))}
      storageKey={storageKey}
      reviewBatch={{
        sessionNumber: batchIndex + 1,
        totalSessions,
        remainingCount,
        onContinue: () => setBatchIndex(index => index + 1),
      }}
    />
  )
}
