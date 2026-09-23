import type { SupabaseClient } from "@supabase/supabase-js"

export type DueFlashcard = {
  id: string
  hanzi: string
  pinyin: string
  arti: string
  setId: string | number | null
  srsLevel: number
  deckTitle?: string
  deckHskLevel?: number
  exampleSentence?: string
  examplePinyin?: string
  exampleTranslation?: string
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

// Menghitung berapa hari sampai review berikutnya untuk setiap pilihan
// penilaian (quality), berdasarkan srs_level kartu saat ini. Dipakai untuk
// menampilkan preview interval di tombol rating (mis. "4 hari") sebelum
// user benar-benar memilih.
export function previewIntervalDays(currentLevel: number, quality: 0 | 3 | 4 | 5): number {
  if (quality === 0) return 1
  if (quality === 3) return 1
  if (quality === 4) {
    const level = Math.min(INTERVALS.length - 1, Math.max(0, currentLevel))
    return INTERVALS[level] ?? 90
  }
  const level = Math.min(INTERVALS.length - 1, Math.max(0, currentLevel) + 1)
  return INTERVALS[level] ?? 180
}

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
    // NOTE: key is always normalized to string here, and read back with
    // String(card.id) below. Previously this stored the raw card_id type,
    // which could silently fail to match if card_id came back as a number.
    progressByCard.set(String(row.card_id), { srs_level: row.srs_level ?? 0 })
  }

  const cardIds = [...progressByCard.keys()]
  const cards: DueFlashcard[] = []

  for (let i = 0; i < cardIds.length; i += 100) {
    const chunk = cardIds.slice(i, i + 100)
    const { data } = await supa
      .from("flashcard_cards")
      .select("id, hanzi, pinyin, arti, set_id")
      .in("id", chunk)

    // Fetch deck info for all unique set_ids
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

    // Fetch example sentences from word_examples (exact match logic like detail kosakata)
    const hanziList = (data ?? []).map(c => c.hanzi).filter(Boolean)
    const exampleMap = new Map<string, { hanzi: string; pinyin: string; arti: string }>()

    if (hanziList.length > 0) {
      for (const hanzi of hanziList) {
        // Use same logic as detail kosakata: fetch both exact and partial match in parallel
        const [directRes, partialRes] = await Promise.all([
          supa.from("word_examples").select("id, hanzi, pinyin, arti").eq("word_hanzi", hanzi).order("id").limit(1),
          supa.from("word_examples").select("id, hanzi, pinyin, arti").ilike("hanzi", `%${hanzi}%`).order("id").limit(1),
        ])

        // Combine results like detail kosakata, but only keep 1 example
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
      cards.push({
        id: String(card.id),
        hanzi: card.hanzi ?? "",
        pinyin: card.pinyin ?? "",
        arti: card.arti ?? "",
        setId: card.set_id ?? null,
        srsLevel: progressByCard.get(String(card.id))?.srs_level ?? 0,
        deckTitle: deckInfo?.title,
        deckHskLevel: deckInfo?.hsk_level,
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
  reviews: { cardId: string; quality: 0 | 3 | 4 | 5; currentLevel: number }[],
  sessionId?: string
) {
  if (reviews.length === 0) return

  // 1. Dapatkan progress yang ada untuk batch ini
  const cardIds = reviews.map(r => r.cardId)
  const { data: existingProgress } = await supa
    .from("user_card_progress")
    .select("card_id")
    .eq("user_id", userId)
    .in("card_id", cardIds)

  const existingCardIds = new Set(existingProgress?.map(p => String(p.card_id)) || [])

  const upserts = reviews.map(review => {
    const update = computeSrsUpdate(review.currentLevel, review.quality)
    return {
      user_id: userId,
      card_id: review.cardId,
      ...update,
      last_reviewed: todayStr(),
      ...(sessionId && { session_id: sessionId }),
    }
  })

  // 2. Pisahkan mana yang insert baru dan mana yang update
  const inserts = upserts.filter(u => !existingCardIds.has(String(u.card_id)))
  const updates = upserts.filter(u => existingCardIds.has(String(u.card_id)))

  if (inserts.length > 0) {
    await supa.from("user_card_progress").insert(inserts)
  }

  // Supabase update array tidak semudah insert, jadi upsert per baris atau gunakan upsert()
  // Tapi karena user_id & card_id mungkin jadi primary key, kita bisa pakai upsert() jika ada constraint.
  // Jika tidak, karena kita tidak punya id progressnya, upsert mungkin akan insert baru jika
  // tidak ada conflict. Cara aman:
  if (updates.length > 0) {
    for (const update of updates) {
      await supa
        .from("user_card_progress")
        .update({
          srs_level: update.srs_level,
          next_review: update.next_review,
          last_reviewed: update.last_reviewed,
          session_id: update.session_id,
        })
        .eq("user_id", userId)
        .eq("card_id", update.card_id)
    }
  }

  // Rekam streak (user menyelesaikan task/review card)
  const { data: existingStreak } = await supa
    .from("daily_streaks")
    .select("date")
    .eq("user_id", userId)
    .eq("date", todayStr())
    .maybeSingle()
    
  if (!existingStreak) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("playStreakAnim", "true")
    }
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
  cardId: string,
  quality: 0 | 3 | 4 | 5,
  currentLevel: number,
  sessionId?: string
) {
  const update = computeSrsUpdate(currentLevel, quality)
  const payload = {
    ...update,
    last_reviewed: todayStr(),
    ...(sessionId && { session_id: sessionId }),
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
  } else {
    await supa.from("user_card_progress").insert({
      user_id: userId,
      card_id: cardId,
      ...payload,
    })
  }

  // Rekam streak (user menyelesaikan task/review card)
  const { data: existingStreak } = await supa
    .from("daily_streaks")
    .select("date")
    .eq("user_id", userId)
    .eq("date", todayStr())
    .maybeSingle()
    
  if (!existingStreak) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("playStreakAnim", "true")
    }
  }

  const { error: streakErr } = await supa.from("daily_streaks").upsert(
    { user_id: userId, date: todayStr() },
    { onConflict: "user_id,date", ignoreDuplicates: true }
  )
  if (streakErr) {
    console.error("Gagal merekam daily streak di srs:", streakErr)
  }
}