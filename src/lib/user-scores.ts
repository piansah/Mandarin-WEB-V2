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
  | "lesson"

type SaveResult = { error: string | null; skipped?: boolean }

/**
 * Simpan skor task ke tabel `user_scores`.
 * - Kalau user belum punya skor untuk (type, key) ini → insert.
 * - Kalau sudah ada dan skor baru lebih tinggi/sama → di-upsert (overwrite).
 * - Kalau skor baru lebih rendah → dilewati (skor terbaik tetap dipertahankan).
 */
export async function saveUserScore(type: ScoreType, key: string, score: number): Promise<SaveResult> {
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
  
  // Cek apakah hari ini sudah ada streak (supaya animasi hanya main 1x)
  const { data: existingStreak } = await supa
    .from("daily_streaks")
    .select("date")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle()
    
  if (!existingStreak) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("playStreakAnim", "true")
    }
  }

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
    .upsert({ user_id: user.id, type, key, score }, { onConflict: "user_id,type,key" })

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