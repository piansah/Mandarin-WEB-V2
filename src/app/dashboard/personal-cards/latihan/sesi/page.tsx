"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { PageLoader } from "@/components/page-loader"
import { SwipeFlashcardSession, type SwipeFlashcard } from "@/components/swipe-flashcard-session"
import { useSupabase } from "@/hooks/use-supabase"
import { fetchFallbackWordExamples } from "@/lib/word-example-fallback"

type DeckRow = { id: number; title: string; hsk_level: number | null }
type CardRow = {
  id: string | number
  hanzi: string | null
  pinyin: string | null
  arti: string | null
  catatan: string | null
  set_id: number | null
  word_class: string | null
}

function CustomFlashcardSessionContent() {
  const supa = useSupabase()
  const searchParams = useSearchParams()
  const deckParam = searchParams.get("decks") ?? ""
  const [cards, setCards] = React.useState<SwipeFlashcard[]>([])
  const [deckCount, setDeckCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const deckIds = [...new Set(deckParam.split(",").map(Number).filter(id => Number.isInteger(id) && id > 0))]

    async function loadCards() {
      setLoading(true)
      if (deckIds.length === 0) {
        setCards([])
        setDeckCount(0)
        setLoading(false)
        return
      }

      const { data: deckRows, error: deckError } = await supa
        .from("flashcard_sets")
        .select("id, title, hsk_level")
        .eq("is_default", true)
        .in("id", deckIds)

      if (deckError) {
        if (!cancelled) {
          setLoadError(true)
          setLoading(false)
        }
        return
      }

      const validDecks = (deckRows ?? []) as DeckRow[]
      const validDeckIds = validDecks.map(deck => deck.id)
      if (validDeckIds.length === 0) {
        if (!cancelled) {
          setCards([])
          setDeckCount(0)
          setLoading(false)
        }
        return
      }

      const { data: cardRows, error: cardError } = await supa
        .from("flashcard_cards")
        .select("id, hanzi, pinyin, arti, catatan, set_id, word_class")
        .in("set_id", validDeckIds)
        .order("created_at", { ascending: true })

      if (cardError) {
        if (!cancelled) {
          setLoadError(true)
          setLoading(false)
        }
        return
      }

      const rawCards = (cardRows ?? []) as CardRow[]
      const hanziList = [...new Set(rawCards.map(card => card.hanzi).filter((hanzi): hanzi is string => Boolean(hanzi)))]
      const exampleMap = new Map<string, { hanzi: string; pinyin: string; arti: string }>()

      if (hanziList.length > 0) {
        const { data: exactExamples } = await supa
          .from("word_examples")
          .select("id, word_hanzi, hanzi, pinyin, arti")
          .in("word_hanzi", hanziList)
          .order("id", { ascending: true })

        for (const example of exactExamples ?? []) {
          if (!example.word_hanzi || exampleMap.has(example.word_hanzi)) continue
          exampleMap.set(example.word_hanzi, {
            hanzi: example.hanzi ?? "",
            pinyin: example.pinyin ?? "",
            arti: example.arti ?? "",
          })
        }

        const missingHanzi = hanziList.filter(hanzi => !exampleMap.has(hanzi))
        const fallbackExamples = await fetchFallbackWordExamples(supa, missingHanzi)

        for (const hanzi of missingHanzi) {
          const example = fallbackExamples.get(hanzi)
          if (!example) continue
          exampleMap.set(hanzi, {
            hanzi: example.hanzi ?? "",
            pinyin: example.pinyin ?? "",
            arti: example.arti ?? "",
          })
        }
      }

      const deckById = new Map(validDecks.map(deck => [deck.id, deck]))
      const deckOrder = new Map(deckIds.map((id, index) => [id, index]))
      const sortedRows = rawCards.sort((a, b) =>
        (deckOrder.get(a.set_id ?? -1) ?? Number.MAX_SAFE_INTEGER)
        - (deckOrder.get(b.set_id ?? -1) ?? Number.MAX_SAFE_INTEGER)
      )
      const loadedCards = sortedRows.map(row => {
        const deck = row.set_id == null ? null : deckById.get(row.set_id)
        const example = row.hanzi ? exampleMap.get(row.hanzi) : undefined
        return {
          id: row.id,
          hanzi: row.hanzi ?? "",
          pinyin: row.pinyin ?? "",
          arti: row.arti ?? "",
          catatan: row.catatan,
          exampleSentence: example?.hanzi,
          examplePinyin: example?.pinyin,
          exampleTranslation: example?.arti,
          setId: row.set_id,
          deckTitle: deck?.title,
          deckHskLevel: deck?.hsk_level ?? undefined,
          wordClass: row.word_class ?? undefined,
        }
      })

      if (!cancelled) {
        setCards(loadedCards)
        setDeckCount(validDecks.length)
        setLoading(false)
      }
    }

    void loadCards()
    return () => { cancelled = true }
  }, [supa, deckParam])

  if (loading) return <PageLoader />

  const deckCardIds = cards.map(card => String(card.id))
  const emptyTitle = loadError
    ? "Latihan custom gagal dimuat"
    : "Pilih deck terlebih dahulu"

  return (
    <SwipeFlashcardSession
      cards={cards}
      loading={false}
      emptyTitle={emptyTitle}
      emptyEmoji={loadError ? "⚠️" : "📚"}
      deckTitle="Latihan Flashcard Custom"
      deckLevel={`${deckCount} deck · ${cards.length} kosakata · tanpa penilaian`}
      deckCardIds={deckCardIds}
      studyOnly
    />
  )
}

export default function CustomFlashcardSessionPage() {
  return (
    <React.Suspense fallback={<PageLoader />}>
      <CustomFlashcardSessionContent />
    </React.Suspense>
  )
}
