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

      const rawCards = data ?? []
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