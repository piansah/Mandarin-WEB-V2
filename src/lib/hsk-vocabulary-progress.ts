import type { createClient } from "@/lib/supabase/browser"

type SupabaseClient = ReturnType<typeof createClient>

export type HskVocabularyProgress = {
  learned: number
  total: number
  learnedByLevel: Map<number, number>
  totalByLevel: Map<number, number>
}

/** Count unique HSK cards that have a classifiable saved SRS rating. */
export async function fetchHskVocabularyProgress(
  supa: SupabaseClient,
  userId: string,
): Promise<HskVocabularyProgress> {
  const { data: decks, error: decksError } = await supa
    .from("flashcard_sets")
    .select("id, hsk_level")
    .eq("is_default", true)
    .not("hsk_level", "is", null)
  if (decksError) throw decksError

  const deckIdsByLevel = new Map<number, number[]>()
  const setLevelById = new Map<string, number>()
  for (const deck of decks ?? []) {
    if (deck.hsk_level == null) continue
    const levelDeckIds = deckIdsByLevel.get(deck.hsk_level) ?? []
    levelDeckIds.push(deck.id)
    deckIdsByLevel.set(deck.hsk_level, levelDeckIds)
    setLevelById.set(String(deck.id), deck.hsk_level)
  }

  const levels = [...deckIdsByLevel.keys()]
  const [totalResults, progressRows] = await Promise.all([
    Promise.all(levels.map(async level => {
      const { count, error } = await supa
        .from("flashcard_cards")
        .select("id", { count: "exact", head: true })
        .in("set_id", deckIdsByLevel.get(level) ?? [])
      if (error) throw error
      return [level, count ?? 0] as const
    })),
    (async () => {
      const rows: { card_id: string | null; last_quality: number | null }[] = []
      const pageSize = 1000
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supa
          .from("user_card_progress")
          .select("card_id, last_quality")
          .eq("user_id", userId)
          .order("card_id", { ascending: true })
          .range(from, from + pageSize - 1)
        if (error) throw error
        rows.push(...(data ?? []))
        if (!data || data.length < pageSize) break
      }
      return rows
    })(),
  ])

  const totalByLevel = new Map(totalResults)
  const learnedByLevel = new Map(levels.map(level => [level, 0]))
  const uniqueCardIds = [...new Set(progressRows
    .filter(row => row.last_quality != null)
    .map(row => row.card_id)
    .filter((id): id is string => id != null)
    .map(String))]
  const chunks = Array.from({ length: Math.ceil(uniqueCardIds.length / 250) }, (_, index) =>
    uniqueCardIds.slice(index * 250, (index + 1) * 250)
  )
  const cardResults = await Promise.all(chunks.map(chunk =>
    supa.from("flashcard_cards").select("id, set_id").in("id", chunk)
  ))

  const learnedCardIds = new Set<string>()
  for (const result of cardResults) {
    if (result.error) throw result.error
    for (const card of result.data ?? []) {
      const level = setLevelById.get(String(card.set_id))
      if (level == null) continue
      const cardId = String(card.id)
      if (learnedCardIds.has(cardId)) continue
      learnedCardIds.add(cardId)
      learnedByLevel.set(level, (learnedByLevel.get(level) ?? 0) + 1)
    }
  }

  return {
    learned: learnedCardIds.size,
    total: [...totalByLevel.values()].reduce((sum, count) => sum + count, 0),
    learnedByLevel,
    totalByLevel,
  }
}
