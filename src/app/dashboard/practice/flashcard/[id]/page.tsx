"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"
import { saveUserScore } from "@/lib/user-scores"
import {
  SwipeFlashcardSession,
  type SwipeFlashcard,
} from "@/components/swipe-flashcard-session"

export default function FlashcardPracticePage() {
  const params = useParams()
  const deckId = Number(params.id)
  const supa = useSupabase()

  const [cards, setCards] = React.useState<SwipeFlashcard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [deckTitle, setDeckTitle] = React.useState("Kartu Hafalan")
  const [deckLevel, setDeckLevel] = React.useState("Level A1")

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      try {
        const {
          data: { user },
        } = await supa.auth.getUser()

        if (cancelled) return

        setUserId(user?.id ?? null)
        const { data: setData } = await supa
          .from("flashcard_sets")
          .select("title, description, hsk_level")
          .eq("id", deckId)
          .maybeSingle()

        if (cancelled) return

        if (setData) {
          setDeckTitle(setData.title ?? "Kartu Hafalan")

          const parts = [
            setData.description,
            setData.hsk_level ? `HSK ${setData.hsk_level}` : null,
          ].filter(Boolean)

          setDeckLevel(
            parts.length > 0
              ? parts.join(" - ")
              : "Level A1"
          )
        }
        const { data, error } = await supa
          .from("flashcard_cards")
          .select("id, hanzi, pinyin, arti")
          .eq("set_id", deckId)
          .order("created_at", { ascending: true })

        if (error) {
          console.error("Failed to load flashcards:", error)
          setCards([])
          return
        }

        const rawCards = data ?? []

        const hanziList = rawCards
          .map((card) => card.hanzi)
          .filter(
            (hanzi): hanzi is string =>
              Boolean(hanzi && hanzi.trim())
          )

        const exampleMap = new Map<
          string,
          {
            hanzi: string
            pinyin: string
            arti: string
          }
        >()

        if (hanziList.length > 0) {
          await Promise.all(
            hanziList.map(async (hanzi) => {
              const [directRes, partialRes] =
                await Promise.all([
                  supa
                    .from("word_examples")
                    .select("id, hanzi, pinyin, arti")
                    .eq("word_hanzi", hanzi)
                    .order("id", { ascending: true })
                    .limit(1),

                  supa
                    .from("word_examples")
                    .select("id, hanzi, pinyin, arti")
                    .ilike("hanzi", `%${hanzi}%`)
                    .order("id", { ascending: true })
                    .limit(1),
                ])

              const example =
                directRes.data?.[0] ??
                partialRes.data?.[0]

              if (example) {
                exampleMap.set(hanzi, {
                  hanzi: example.hanzi ?? "",
                  pinyin: example.pinyin ?? "",
                  arti: example.arti ?? "",
                })
              }
            })
          )
        }

        if (cancelled) return

        const cardsWithExamples: SwipeFlashcard[] =
          rawCards.map((card) => {
            const example = card.hanzi
              ? exampleMap.get(card.hanzi)
              : undefined

            return {
              ...card,

              exampleSentence:
                example?.hanzi || undefined,

              examplePinyin:
                example?.pinyin || undefined,

              exampleTranslation:
                example?.arti || undefined,
            }
          })

        setCards(cardsWithExamples)
      } catch (error) {
        console.error("Failed to load flashcard session:", error)
        setCards([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (
      Number.isFinite(deckId) &&
      deckId > 0
    ) {
      load()
    } else {
      setLoading(false)
    }

    return () => {
      cancelled = true
    }
  }, [deckId, supa])

  const wordDetailPath = React.useCallback(
    (card: SwipeFlashcard) =>
      `/dashboard/flashcard/${deckId}/word/${card.id}`,
    [deckId]
  )

  const handleComplete = React.useCallback(
    (stats: {
      hafal: number
      lupa: number
      ragu: number
    }) => {
      const total =
        stats.hafal +
        stats.lupa +
        stats.ragu

      const pct =
        total > 0
          ? Math.round((stats.hafal / total) * 100)
          : 0

      saveUserScore(
        "fc_session",
        String(deckId),
        pct
      ).catch((error) => {
        console.error(
          "Failed to save flashcard score:",
          error
        )
      })
    },
    [deckId]
  )

  return (
    <SwipeFlashcardSession
      cards={cards}
      loading={loading}
      wordDetailPath={wordDetailPath}
      onComplete={handleComplete}
      deckTitle={deckTitle}
      deckLevel={deckLevel}
      userId={userId}
    />
  )
}

