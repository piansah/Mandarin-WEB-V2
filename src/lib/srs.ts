import type { SupabaseClient } from "@supabase/supabase-js"

export type DueFlashcard = {
  id: string
  hanzi: string
  pinyin: string
  arti: string
  setId: string | number | null
  srsLevel: number
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const INTERVALS = [1, 1, 2, 4, 7, 15, 30, 60, 90, 180]

export function computeSrsUpdate(currentLevel: number, quality: 0 | 3 | 4 | 5) {
  if (quality === 0) {
    return { srs_level: 0, next_review: addDays(1) }
  }
  if (quality === 3) {
    const level = Math.max(0, currentLevel)
    return { srs_level: level, next_review: addDays(1) }
  }
  if (quality === 4) {
    const level = Math.min(INTERVALS.length - 1, Math.max(0, currentLevel))
    return { srs_level: level, next_review: addDays(INTERVALS[level] ?? 90) }
  }
  const level = Math.min(INTERVALS.length - 1, Math.max(0, currentLevel) + 1)
  return { srs_level: level, next_review: addDays(INTERVALS[level] ?? 180) }
}

export async function fetchDueFlashcards(
  supa: SupabaseClient,
  userId: string
): Promise<DueFlashcard[]> {
  const today = todayStr()
  const { data: progressRows } = await supa
    .from("user_card_progress")
    .select("card_id, next_review, last_reviewed, srs_level")
    .eq("user_id", userId)
    .lte("next_review", today)
    .order("next_review", { ascending: true })

  if (!progressRows?.length) return []

  const progressByCard = new Map<string, { srs_level: number }>()
  for (const row of progressRows) {
    if (!row.card_id) continue
    progressByCard.set(row.card_id, { srs_level: row.srs_level ?? 0 })
  }

  const cardIds = [...progressByCard.keys()]
  const cards: DueFlashcard[] = []

  for (let i = 0; i < cardIds.length; i += 100) {
    const chunk = cardIds.slice(i, i + 100)
    const { data } = await supa
      .from("flashcard_cards")
      .select("id, hanzi, pinyin, arti, set_id")
      .in("id", chunk)

    for (const card of data ?? []) {
      cards.push({
        id: String(card.id),
        hanzi: card.hanzi ?? "",
        pinyin: card.pinyin ?? "",
        arti: card.arti ?? "",
        setId: card.set_id ?? null,
        srsLevel: progressByCard.get(String(card.id))?.srs_level ?? 0,
      })
    }
  }

  return cards
}

export async function recordSrsReview(
  supa: SupabaseClient,
  userId: string,
  cardId: string,
  quality: 0 | 3 | 4 | 5,
  currentLevel: number
) {
  const update = computeSrsUpdate(currentLevel, quality)
  const payload = {
    ...update,
    last_reviewed: todayStr(),
  }

  const { data: existing } = await supa
    .from("user_card_progress")
    .select("card_id")
    .eq("user_id", userId)
    .eq("card_id", cardId)
    .limit(1)

  if (existing && existing.length > 0) {
    await supa
      .from("user_card_progress")
      .update(payload)
      .eq("user_id", userId)
      .eq("card_id", cardId)
    return
  }

  await supa.from("user_card_progress").insert({
    user_id: userId,
    card_id: cardId,
    ...payload,
  })
}
