"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"
import { saveUserScore } from "@/lib/user-scores"
import { recordSrsReview } from "@/lib/srs"
import { SwipeFlashcardSession, type SwipeFlashcard } from "@/components/swipe-flashcard-session"

export default function FlashcardPracticePage() {
  const params = useParams()
  const deckId = Number(params.id)
  const supa = useSupabase()

  const [cards, setCards] = React.useState<SwipeFlashcard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [deckTitle, setDeckTitle] = React.useState<string>("Kartu Hafalan")
  const [deckLevel, setDeckLevel] = React.useState<string>("Level A1")

  React.useEffect(() => {
    async function load() {
      const { data: { user } } = await supa.auth.getUser()
      setUserId(user?.id ?? null)

      const { data: setData } = await supa
        .from("flashcard_sets")
        .select("title, description, hsk_level")
        .eq("id", deckId)
        .maybeSingle()

      if (setData) {
        setDeckTitle(setData.title ?? "Kartu Hafalan")
        const parts = [setData.description, setData.hsk_level ? `HSK ${setData.hsk_level}` : null].filter(Boolean)
        setDeckLevel(parts.length > 0 ? parts.join(" - ") : "Level A1")
      }

      const { data } = await supa
        .from("flashcard_cards")
        .select("id, hanzi, pinyin, arti")
        .eq("set_id", deckId)
        .order("created_at", { ascending: true })

      const rawCards = data ?? []

      // Fetch this user's existing SRS progress for these cards so reviews
      // continue from the correct level instead of always resetting to 0.
      const srsLevelByCard = new Map<string, number>()
      if (user?.id && rawCards.length > 0) {
        const { data: progressRows } = await supa
          .from("user_card_progress")
          .select("card_id, srs_level")
          .eq("user_id", user.id)
          .in("card_id", rawCards.map(c => String(c.id)))

        for (const row of progressRows ?? []) {
          if (row.card_id) srsLevelByCard.set(String(row.card_id), row.srs_level ?? 0)
        }
      }

      const hanziList = rawCards.map(c => c.hanzi).filter(Boolean)
      const exampleMap = new Map<string, { hanzi: string; pinyin: string; arti: string }>()

      if (hanziList.length > 0) {
        await Promise.all(
          hanziList.map(async (hanzi) => {
            const [directRes, partialRes] = await Promise.all([
              supa.from("word_examples").select("id, hanzi, pinyin, arti").eq("word_hanzi", hanzi).order("id").limit(1),
              supa.from("word_examples").select("id, hanzi, pinyin, arti").ilike("hanzi", `%${hanzi}%`).order("id").limit(1),
            ])
            const first = directRes.data?.[0] ?? partialRes.data?.[0]
            if (first) {
              exampleMap.set(hanzi, { hanzi: first.hanzi ?? "", pinyin: first.pinyin ?? "", arti: first.arti ?? "" })
            }
          })
        )
      }

      const cardsWithExamples: SwipeFlashcard[] = rawCards.map(card => {
        const ex = card.hanzi ? exampleMap.get(card.hanzi) : undefined
        return {
          ...card,
          srsLevel: srsLevelByCard.get(String(card.id)) ?? 0,
          exampleSentence: ex?.hanzi,
          examplePinyin: ex?.pinyin,
          exampleTranslation: ex?.arti,
        }
      })

      setCards(cardsWithExamples)
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
    saveUserScore("fc_session", String(deckId), pct).catch(() => { })
  }, [deckId])

  // Persists each rating to user_card_progress (srs_level + next_review).
  // Without this, "Jatuh Tempo Hari Ini" never updates because no due date
  // is ever written for cards reviewed in this practice session.
  const handleReview = React.useCallback(async (card: SwipeFlashcard, quality: 0 | 3 | 4 | 5) => {
    if (!userId) return
    await recordSrsReview(supa, userId, String(card.id), quality, card.srsLevel ?? 0)
  }, [supa, userId])

  return (
    <SwipeFlashcardSession
      cards={cards}
      loading={loading}
      wordDetailPath={wordDetailPath}
      onReview={handleReview}
      onComplete={handleComplete}
      deckTitle={deckTitle}
      deckLevel={deckLevel}
      userId={userId}
      deckCardIds={cards.map(c => String(c.id))}
    />
  )
}