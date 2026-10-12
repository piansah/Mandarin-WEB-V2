import { createClient } from "@/lib/supabase/browser"

// Harus sinkron dengan `type` yang dikenali di
// supabase/functions/get-user-stats/index.ts
export type ScoreType =
  | "quiz"
  | "grammar"
  | "kal"
  | "hanzi"
  | "cerita"
  | "cerita_quiz"
  | "fc_session"
  | "nada_session"
  | "speaking_session"
  | "tulis_session"
  | "nada_word"
  | "lesson"
  | "modul"
  | "minigame_snake"
  | "minigame_match"
  | "minigame_speedrun"

type SaveResult = { error: string | null; skipped?: boolean }

/**
 * Simpan skor task ke tabel `user_scores`.
 * - Kalau user belum punya skor untuk (type, key) ini → insert.
 * - Kalau sudah ada dan skor baru lebih tinggi/sama → di-upsert (overwrite).
 * - Kalau skor baru lebih rendah → dilewati (skor terbaik tetap dipertahankan).
 */
export async function saveUserScore(type: ScoreType, key: string, score: number, meta?: Record<string, unknown> | null): Promise<SaveResult> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return { error: "not-authenticated" }

  const { data: existing, error: readErr } = await supa
    .from("user_scores")
    .select("score")
    .eq("user_id", user.id)
    .eq("type", type)
    .eq("key", key)
    .maybeSingle()

  if (readErr) return { error: readErr.message }

  // Rekam streak karena user sudah mengerjakan task hari ini
  const today = new Date().toISOString().slice(0, 10)
  
  const { error: streakErr } = await supa.from("daily_streaks").upsert(
    { user_id: user.id, date: today },
    { onConflict: "user_id,date", ignoreDuplicates: true }
  )
  if (streakErr) {
    console.error("Gagal merekam daily streak:", streakErr)
  }

  if (existing && existing.score >= score) return { error: null, skipped: true }

  const { error } = await supa
    .from("user_scores")
    .upsert({ user_id: user.id, type, key, score, ...(meta && { meta: meta as unknown }) } as any, { onConflict: "user_id,type,key" }) // eslint-disable-line @typescript-eslint/no-explicit-any

  return { error: error?.message ?? null }
}

/** Ambil semua skor milik user untuk satu `type`, sebagai map key -> score. */
export async function getUserScoresByType(type: ScoreType): Promise<Record<string, number>> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return {}

  const { data, error } = await supa
    .from("user_scores")
    .select("key, score")
    .eq("user_id", user.id)
    .eq("type", type)

  if (error || !data) return {}

  const map: Record<string, number> = {}
  data.forEach((row) => {
    map[row.key] = row.score
  })
  return map
}

export type DeckPracticeScores = {
  fcDone: boolean
  quizScore: number | null
  nadaDone: boolean
  tulisDone: boolean
}

/**
 * Ambil status selesai & skor untuk 4 tipe latihan pada satu deck (fc_session, quiz, nada_session, tulis_session).
 */
export async function getDeckPracticeScores(deckKey: string | number): Promise<DeckPracticeScores> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) {
    return { fcDone: false, quizScore: null, nadaDone: false, tulisDone: false }
  }

  const { data, error } = await supa
    .from("user_scores")
    .select("type, score")
    .eq("user_id", user.id)
    .eq("key", String(deckKey))
    .in("type", ["fc_session", "quiz", "nada_session", "tulis_session"])

  if (error || !data) {
    return { fcDone: false, quizScore: null, nadaDone: false, tulisDone: false }
  }

  let fcDone = false
  let quizScore: number | null = null
  let nadaDone = false
  let tulisDone = false

  for (const row of data) {
    if (row.type === "fc_session") fcDone = true
    if (row.type === "quiz") quizScore = row.score
    if (row.type === "nada_session") nadaDone = true
    if (row.type === "tulis_session") tulisDone = true
  }

  return { fcDone, quizScore, nadaDone, tulisDone }
}

export type EstafetPracticeScores = {
  quizScore: number | null
  speakingDone: boolean
  speakingScore: number | null
}

/**
 * Ambil status selesai & skor untuk latihan pada set estafet (kal = Quiz Kalimat, speaking_session = Latihan Speaking).
 */
export async function getEstafetPracticeScores(setKey: string): Promise<EstafetPracticeScores> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) {
    return { quizScore: null, speakingDone: false, speakingScore: null }
  }

  const { data, error } = await supa
    .from("user_scores")
    .select("type, score")
    .eq("user_id", user.id)
    .eq("key", setKey)
    .in("type", ["kal", "speaking_session"])

  if (error || !data) {
    return { quizScore: null, speakingDone: false, speakingScore: null }
  }

  let quizScore: number | null = null
  let speakingDone = false
  let speakingScore: number | null = null

  for (const row of data) {
    if (row.type === "kal") quizScore = row.score
    if (row.type === "speaking_session") {
      speakingDone = true
      speakingScore = row.score
    }
  }

  return { quizScore, speakingDone, speakingScore }
}

/**
 * Ambil daftar ID kalimat yang sudah selesai dibaca untuk satu hanzi set key.
 * Data disimpan di user_scores sebagai type="hanzi_read", key=setKey, meta={ ids: number[] }.
 */
export async function getHanziReadProgress(setKey: string): Promise<number[]> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return []

  const { data } = await supa
    .from("user_scores")
    .select("meta")
    .eq("user_id", user.id)
    .eq("type", "hanzi")
    .eq("key", setKey)
    .maybeSingle()

  if (!data?.meta) return []
  const meta = data.meta as { read_ids?: number[] }
  return Array.isArray(meta.read_ids) ? meta.read_ids : []
}

/**
 * Simpan daftar ID kalimat yang sudah selesai dibaca ke Supabase.
 * Menggunakan upsert pada (user_id, type, key) agar tidak duplikat.
 */
export async function saveHanziReadProgress(setKey: string, completedIds: number[]): Promise<void> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return

  await supa
    .from("user_scores")
    .upsert(
      {
        user_id: user.id,
        type: "hanzi" as ScoreType,
        key: setKey,
        score: 0,
        meta: { read_ids: completedIds } as unknown,
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { onConflict: "user_id,type,key" }
    )
}
