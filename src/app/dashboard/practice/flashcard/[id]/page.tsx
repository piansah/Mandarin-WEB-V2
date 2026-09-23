"use client"

import * as React from "react"
import { useParams, useSearchParams } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"
import { saveUserScore } from "@/lib/user-scores"
import { recordSrsReviewBatch } from "@/lib/srs"
import { SwipeFlashcardSession, type SwipeFlashcard } from "@/components/swipe-flashcard-session"

export default function FlashcardPracticePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const deckId = Number(params.id)
  const isPersonal = searchParams.get("personal") === "true"
  const supa = useSupabase()

  const [cards, setCards] = React.useState<SwipeFlashcard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [deckTitle, setDeckTitle] = React.useState<string>("Kartu Hafalan")
  const [deckLevel, setDeckLevel] = React.useState<string>("Level A1")
  const [allCardIds, setAllCardIds] = React.useState<string[]>([])
  const [sessionId, setSessionId] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      const { data: { user } } = await supa.auth.getUser()
      setUserId(user?.id ?? null)

      // Generate unique session ID
      const newSessionId = crypto.randomUUID()
      setSessionId(newSessionId)

      // eslint-disable-next-line
      let rawCards: any[] = []
      const srsLevelByCard = new Map<string, number>()
      const reviewedCardIds = new Set<string>()
      const deckHskLevel: number | undefined = undefined

      if (isPersonal) {
        // For personal decks, fetch from personal_cards table
        const { data: personalCards } = await supa
          .from("personal_cards")
          .select("id, hanzi, pinyin, arti, word_class")
          .eq("deck_id", deckId)
          .order("created_at", { ascending: true })

        rawCards = personalCards ?? []
        setDeckTitle("Deck Personal")
        setDeckLevel("Latihan Bebas")
      } else {
        // For regular flashcard decks
        const { data: setData } = await supa
          .from("flashcard_sets")
          .select("title, description, hsk_level")
          .eq("id", deckId)
          .maybeSingle()

        const deckHskLevel: number | undefined = setData?.hsk_level ?? undefined

        if (setData) {
          setDeckTitle(setData.title ?? "Kartu Hafalan")
          const parts = [setData.description, setData.hsk_level ? `HSK ${setData.hsk_level}` : null].filter(Boolean)
          setDeckLevel(parts.length > 0 ? parts.join(" - ") : "Level A1")
        }

        // word_class ditambahkan agar bisa ditampilkan sebagai
        // "HSK {level} - {word_class}" di atas kartu.
        const { data } = await supa
          .from("flashcard_cards")
          .select("id, hanzi, pinyin, arti, word_class")
          .eq("set_id", deckId)
          .order("created_at", { ascending: true })

        rawCards = data ?? []

        // Fetch this user's existing SRS progress for these cards so reviews
        // continue from the correct level instead of always resetting to 0.
        // Baris yang ADA di sini juga dipakai untuk menandai kartu yang
        // "belum pernah dibuka" (isNew) — kartu tanpa baris progress sama
        // sekali dianggap baru, terlepas dari nilai srs_level-nya.
        if (user?.id && rawCards.length > 0) {
          const { data: progressRows } = await supa
            .from("user_card_progress")
            .select("card_id, srs_level")
            .eq("user_id", user.id)
            .in("card_id", rawCards.map(c => String(c.id)))

          for (const row of progressRows ?? []) {
            if (row.card_id) {
              srsLevelByCard.set(String(row.card_id), row.srs_level ?? 0)
              reviewedCardIds.add(String(row.card_id))
            }
          }
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
          deckHskLevel: isPersonal ? undefined : deckHskLevel,
          wordClass: card.word_class ?? undefined,
          // Kartu baru = belum pernah punya baris di user_card_progress.
          // Jika belum login, semua kartu ditampilkan sebagai kartu baru.
          isNew: user?.id ? !reviewedCardIds.has(String(card.id)) : true,
        }
      })

      setCards(cardsWithExamples)
      setAllCardIds(rawCards.map(c => String(c.id)))
      setLoading(false)
    }
    load()
  }, [deckId, supa, isPersonal])

  const wordDetailPath = React.useCallback(
    (card: SwipeFlashcard) => `/dashboard/flashcard/${deckId}/word/${card.id}`,
    [deckId]
  )

  const handleComplete = React.useCallback(async (
    stats: { hafal: number; lupa: number; ragu: number; sulit: number },
    reviews: { cardId: string; quality: 0 | 3 | 4 | 5; currentLevel: number }[]
  ) => {
    // For personal decks, don't save scores or SRS progress
    if (isPersonal) return

    const total = stats.hafal + stats.lupa + stats.ragu + stats.sulit
    const pct = total > 0 ? Math.round((stats.hafal / total) * 100) : 0
    saveUserScore("fc_session", String(deckId), pct).catch(() => { })
    
    if (userId && reviews.length > 0) {
      await recordSrsReviewBatch(supa, userId, reviews, sessionId ?? undefined)
    }
  }, [deckId, isPersonal, userId, sessionId, supa])

  return (
    <SwipeFlashcardSession
      cards={cards}
      loading={loading}
      wordDetailPath={wordDetailPath}
      onComplete={handleComplete}
      deckTitle={deckTitle}
      deckLevel={deckLevel}
      userId={userId}
      deckCardIds={allCardIds}
      deckId={isPersonal ? undefined : deckId}
    />
  )
}