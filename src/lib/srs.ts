import type { SupabaseClient } from "@supabase/supabase-js"

export type DueFlashcard = {
  id: string
  hanzi: string
  pinyin: string
  arti: string
  setId: string | number | null
  srsLevel: number
  intervalDays?: number
  easeFactor?: number
  deckTitle?: string
  deckHskLevel?: number
  exampleSentence?: string
  examplePinyin?: string
  exampleTranslation?: string
  wordClass?: string
}

export type SrsState = {
  repetitions: number   // consecutive successful reviews (n). Stored in the existing `srs_level` column.
  intervalDays: number  // stored in `interval_days`
  easeFactor: number    // stored in `ease_factor`
}

export const DEFAULT_EASE_FACTOR = 2.5
export const MIN_EASE_FACTOR = 1.3
export const MAX_INTERVAL_DAYS = 365

export function countSwipeMastered(
  ratings: Map<string, 0 | 3 | 4 | 5>,
  deckIds: string[],
  lapsed: Set<string> = new Set()
): number {
  if (!deckIds || deckIds.length === 0) return 0

  const uniqueDeckIds = new Set(deckIds)
  let count = 0

  for (const id of uniqueDeckIds) {
    const rating = ratings.get(id)
    if (rating === 5 && !lapsed.has(id)) {
      count++
    }
  }

  return Math.min(count, uniqueDeckIds.size)
}

export function computeSessionStats(
  ratings: Map<string, 0 | 3 | 4 | 5>,
  lapsed: Set<string>
): { mudah: number; ingat: number; sulit: number; lupa: number } {
  let mudah = 0
  let ingat = 0
  let sulit = 0
  let lupa = 0

  for (const [cardId, rating] of ratings.entries()) {
    if (lapsed.has(cardId) || rating === 0) {
      lupa++
    } else if (rating === 5) {
      mudah++
    } else if (rating === 4) {
      ingat++
    } else if (rating === 3) {
      sulit++
    }
  }

  return { mudah, ingat, sulit, lupa }
}

export function computeSessionAccuracy(
  ratings: Map<string, 0 | 3 | 4 | 5>,
  lapsed: Set<string> = new Set()
): number {
  const total = ratings.size
  if (total === 0) return 0

  const stats = computeSessionStats(ratings, lapsed)
  const passCount = stats.mudah + stats.ingat

  return Math.round((passCount / total) * 100)
}

export function countSaved(
  fullDeckIds: string[],
  dbSavedIds: Set<string>,
  reviews: { cardId: string }[]
): number {
  if (!fullDeckIds || fullDeckIds.length === 0) return 0

  const uniqueDeckIds = new Set(fullDeckIds)
  const reviewIds = new Set(reviews.map(r => r.cardId))

  let count = 0
  for (const id of uniqueDeckIds) {
    if (dbSavedIds.has(id) || reviewIds.has(id)) {
      count++
    }
  }

  return Math.min(count, uniqueDeckIds.size)
}

export function getCardSrsState(card: { srsLevel?: number; intervalDays?: number; easeFactor?: number }): SrsState {
  return {
    repetitions: card.srsLevel ?? 0,
    intervalDays: card.intervalDays ?? 0,
    easeFactor: card.easeFactor ?? DEFAULT_EASE_FACTOR,
  }
}

export function isCardDue(nextReview: string | null | undefined, today: string = todayStr()): boolean {
  if (!nextReview) return true
  return nextReview <= today
}

export function toLocalDateStr(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayStr() {
  return toLocalDateStr(new Date())
}

export function addDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toLocalDateStr(d)
}

export function computeNextSrsState(state: SrsState, quality: 0 | 3 | 4 | 5): SrsState {
  let { repetitions, intervalDays, easeFactor } = state

  if (quality < 3) {
    // Lupa
    repetitions = 0
    intervalDays = 1
    // easeFactor remains unchanged in classic SM-2 on failure
  } else {
    // Passes
    if (repetitions === 0) {
      intervalDays = 1
    } else if (repetitions === 1) {
      intervalDays = 6
    } else {
      intervalDays = Math.round(intervalDays * easeFactor)
    }

    intervalDays = Math.min(Math.max(1, intervalDays), MAX_INTERVAL_DAYS)
    repetitions += 1
    
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor)
    easeFactor = Math.round(easeFactor * 100) / 100 // rounding to 2 decimals
  }

  return { repetitions, intervalDays, easeFactor }
}

export function previewIntervalDays(state: SrsState, quality: 0 | 3 | 4 | 5): number {
  return computeNextSrsState(state, quality).intervalDays
}

export function computeSrsUpdate(state: SrsState, quality: 0 | 3 | 4 | 5) {
  const nextState = computeNextSrsState(state, quality)
  return {
    srs_level: nextState.repetitions,
    interval_days: nextState.intervalDays,
    ease_factor: nextState.easeFactor,
    next_review: addDays(nextState.intervalDays),
  }
}

export async function fetchDueFlashcards(
  supa: SupabaseClient,
  userId: string
): Promise<DueFlashcard[]> {
  const today = todayStr()
  const { data: progressRows } = await supa
    .from("user_card_progress")
    .select("card_id, next_review, last_reviewed, srs_level, interval_days, ease_factor")
    .eq("user_id", userId)
    .lte("next_review", today)
    .order("next_review", { ascending: true })

  if (!progressRows?.length) return []

  const progressByCard = new Map<string, { srs_level: number; interval_days: number; ease_factor: number }>()
  for (const row of progressRows) {
    if (!row.card_id) continue
    progressByCard.set(String(row.card_id), { 
      srs_level: row.srs_level ?? 0,
      interval_days: row.interval_days ?? 1,
      ease_factor: row.ease_factor ?? DEFAULT_EASE_FACTOR,
    })
  }

  const cardIds = [...progressByCard.keys()]
  const cards: DueFlashcard[] = []

  for (let i = 0; i < cardIds.length; i += 100) {
    const chunk = cardIds.slice(i, i + 100)
    const { data } = await supa
      .from("flashcard_cards")
      .select("id, hanzi, pinyin, arti, set_id, word_class")
      .in("id", chunk)

    const uniqueSetIds = [...new Set((data ?? []).map(c => c.set_id).filter(Boolean))]
    const deckInfoMap = new Map<string | number, { title: string; hsk_level: number }>()

    if (uniqueSetIds.length > 0) {
      const { data: deckData } = await supa
        .from("flashcard_sets")
        .select("id, title, hsk_level")
        .in("id", uniqueSetIds)

      for (const deck of deckData ?? []) {
        deckInfoMap.set(deck.id, { title: deck.title ?? "", hsk_level: deck.hsk_level ?? 0 })
      }
    }

    const hanziList = (data ?? []).map(c => c.hanzi).filter(Boolean)
    const exampleMap = new Map<string, { hanzi: string; pinyin: string; arti: string }>()

    if (hanziList.length > 0) {
      for (const hanzi of hanziList) {
        const [directRes, partialRes] = await Promise.all([
          supa.from("word_examples").select("id, hanzi, pinyin, arti").eq("word_hanzi", hanzi).order("id").limit(1),
          supa.from("word_examples").select("id, hanzi, pinyin, arti").ilike("hanzi", `%${hanzi}%`).order("id").limit(1),
        ])

        const seen = new Set<string>()
        const allExamples = [...(directRes.data ?? []), ...(partialRes.data ?? [])].filter(item => {
          const key = `${item.id}-${item.hanzi}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        if (allExamples.length > 0) {
          exampleMap.set(hanzi, {
            hanzi: allExamples[0].hanzi ?? "",
            pinyin: allExamples[0].pinyin ?? "",
            arti: allExamples[0].arti ?? "",
          })
        }
      }
    }

    for (const card of data ?? []) {
      const deckInfo = card.set_id ? deckInfoMap.get(card.set_id) : null
      const example = card.hanzi ? exampleMap.get(card.hanzi) : null
      const progress = progressByCard.get(String(card.id))
      
      cards.push({
        id: String(card.id),
        hanzi: card.hanzi ?? "",
        pinyin: card.pinyin ?? "",
        arti: card.arti ?? "",
        setId: card.set_id ?? null,
        srsLevel: progress?.srs_level ?? 0,
        intervalDays: progress?.interval_days ?? 1,
        easeFactor: progress?.ease_factor ?? DEFAULT_EASE_FACTOR,
        deckTitle: deckInfo?.title,
        deckHskLevel: deckInfo?.hsk_level,
        wordClass: card.word_class ?? undefined,
        exampleSentence: example?.hanzi,
        examplePinyin: example?.pinyin,
        exampleTranslation: example?.arti,
      })
    }
  }

  return cards
}

export async function recordSrsReviewBatch(
  supa: SupabaseClient,
  userId: string,
  reviews: { cardId: string; quality: 0 | 3 | 4 | 5; state: SrsState }[],
  sessionId?: string | null
) {
  if (reviews.length === 0) return

  const upserts = reviews.map(review => {
    const update = computeSrsUpdate(review.state, review.quality)
    return {
      user_id: userId,
      card_id: review.cardId,
      ...update,
      last_reviewed: todayStr(),
      ...(sessionId && { session_id: sessionId }),
    }
  })

  const { error } = await supa
    .from("user_card_progress")
    .upsert(upserts, { onConflict: "user_id,card_id" })

  if (error) {
    console.error("Gagal menyimpan progress SRS:", error)
    throw error
  }

  const { error: streakErr } = await supa.from("daily_streaks").upsert(
    { user_id: userId, date: todayStr() },
    { onConflict: "user_id,date", ignoreDuplicates: true }
  )

  if (streakErr) {
    console.error("Gagal merekam daily streak di srs:", streakErr)
  }
}

export async function recordSrsReview(
  supa: SupabaseClient,
  userId: string,
  review: { cardId: string; quality: 0 | 3 | 4 | 5; state: SrsState },
  sessionId?: string | null
) {
  const update = computeSrsUpdate(review.state, review.quality)
  const { error } = await supa
    .from("user_card_progress")
    .upsert({
      user_id: userId,
      card_id: review.cardId,
      ...update,
      last_reviewed: todayStr(),
      ...(sessionId && { session_id: sessionId }),
    }, { onConflict: "user_id,card_id" })

  if (error) {
    console.error("Gagal menyimpan progress SRS untuk kartu:", review.cardId, error)
    throw error
  }
}