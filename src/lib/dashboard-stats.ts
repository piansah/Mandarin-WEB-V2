/**
 * DASHBOARD (poin 4) — pengganti `mockStats`/`recentActivity` hardcoded di
 * `dashboard/page.tsx`. Sumber data dipetakan dari `dashboard.js` project
 * lama (1565 baris) tapi disederhanakan ke apa yang benar-benar dipakai UI
 * dashboard baru:
 *
 * - streak / best streak / konsistensi / dot mingguan  → tabel `daily_streaks`
 *   (logika sama seperti `loadStreak()` / `_calcBestStreak()` /
 *   `_calcKonsistensi()` di project lama, dipindah ke TS)
 * - total skor (XP)                                    → RPC `get_user_stats`
 *   (dipakai sama persis seperti `_renderLevel()` project lama, field `xp`)
 * - kosakata dihafal & flashcard due                    → tabel
 *   `user_card_progress` (logika sama seperti `updateSrsDashboard()`,
 *   TANPA validasi ulang ke `flashcard_cards` yang di project lama cuma
 *   jaga-jaga kartu kehapus — disederhanakan)
 * - quiz diselesaikan                                   → hitung baris
 *   `user_scores` dengan type = "quiz"
 * - aktivitas terbaru                                   → 4 baris terakhir
 *   `user_scores` (urut `updated_at`), label pakai peta type→nama Indonesia
 *   + `key` mentah (BUKAN join ke tabel judul asli seperti quiz_sets/
 *   kalimat_sets/dst — disederhanakan, bisa ditingkatkan nanti kalau mau
 *   judul yang lebih rapi)
 *
 * Tier konten (badge "menengah" dkk) TIDAK dihitung di sini — dipakai
 * langsung dari `@/lib/tier-unlock` (poin 1), sesuai keputusan: dashboard
 * pakai tier konten HSK dulu, level XP + gelar menyusul di poin 5.
 */

import { createClient } from "@/lib/supabase/browser"
import { TIER_ORDER, TIER_LABEL, TIER_HSK, fetchUnlockedTiers, type Tier } from "@/lib/tier-unlock"

export type WeekDot = { day: string; active: boolean; isToday: boolean }

export type RecentActivityItem = {
  key: string
  typeLabel: string
  score: number
  timeAgo: string
}

export type DashboardStats = {
  displayName: string
  streak: number
  bestStreak: number
  consistency: number
  weekDots: WeekDot[]
  totalScore: number
  tier: Tier
  tierLabel: string
  tierHsk: string
  wordsMastered: number
  flashcardDue: number
  quizCompleted: number
  recentActivity: RecentActivityItem[]
}

const TYPE_LABEL: Record<string, string> = {
  quiz: "Quiz",
  kal: "Quiz Kalimat",
  grammar: "Grammar",
  cerita: "Cerita",
  cerita_quiz: "Quiz Cerita",
  hanzi: "Hanzi",
  fc_session: "Flashcard",
  speaking_session: "Speaking",
  nada_session: "Nada",
  tulis_session: "Tulis Hanzi",
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function calcCurrentStreak(dates: Set<string>): number {
  const today = todayStr()
  const yesterday = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })()
  const startFrom = dates.has(today) ? today : dates.has(yesterday) ? yesterday : null
  if (!startFrom) return 0

  let streak = 0
  const cur = new Date(startFrom)
  while (dates.has(cur.toISOString().slice(0, 10))) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

function calcBestStreak(dates: Set<string>): number {
  if (!dates.size) return 0
  const sorted = [...dates].sort()
  let best = 1
  let cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    prev.setDate(prev.getDate() + 1)
    if (prev.toISOString().slice(0, 10) === sorted[i]) {
      cur++
      if (cur > best) best = cur
    } else {
      cur = 1
    }
  }
  return best
}

function calcConsistency(dates: Set<string>): number {
  if (!dates.size) return 0
  const sorted = [...dates].sort()
  const first = new Date(sorted[0])
  const today = new Date(todayStr())
  const totalDays = Math.round((today.getTime() - first.getTime()) / 86_400_000) + 1
  return Math.round((dates.size / totalDays) * 100)
}

function buildWeekDots(dates: Set<string>): WeekDot[] {
  const DAY_LABEL = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
  const today = new Date()
  const todayStr_ = todayStr()
  const dayOfWeek = today.getDay() // 0 = Min
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))

  return DAY_LABEL.map((label, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dStr = d.toISOString().slice(0, 10)
    return { day: label, active: dates.has(dStr), isToday: dStr === todayStr_ }
  })
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "baru saja"
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days === 1) return "kemarin"
  return `${days} hari lalu`
}

export async function fetchDashboardStats(): Promise<DashboardStats | null> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return null

  const since = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 400)
    return d.toISOString().slice(0, 10)
  })()

  const [profileRes, streakRes, statsRpcRes, progressRes, quizCountRes, recentRes, unlockedTiers] =
    await Promise.all([
      supa.from("user_profile").select("display_name").eq("user_id", user.id).maybeSingle(),
      supa.from("daily_streaks").select("date").eq("user_id", user.id).gte("date", since),
      supa.rpc("get_user_stats"),
      supa.from("user_card_progress").select("card_id, srs_level, next_review, last_reviewed").eq("user_id", user.id),
      supa.from("user_scores").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("type", "quiz"),
      supa
        .from("user_scores")
        .select("type, key, score, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(4),
      fetchUnlockedTiers(),
    ])

  const dates = new Set((streakRes.data ?? []).map((r) => r.date as string))

  const progressByCard = new Map<string, { srs_level: number; next_review: string | null }>()
  ;(progressRes.data ?? []).forEach((row) => {
    if (!row.card_id) return
    progressByCard.set(row.card_id, { srs_level: row.srs_level, next_review: row.next_review })
  })
  const cards = [...progressByCard.values()]
  const wordsMastered = cards.filter((c) => c.srs_level >= 1).length
  const today = todayStr()
  const flashcardDue = cards.filter((c) => c.next_review && c.next_review <= today).length

  const currentTier = [...TIER_ORDER].reverse().find((t) => unlockedTiers.includes(t)) ?? TIER_ORDER[0]

  return {
    displayName: profileRes.data?.display_name ?? user.email?.split("@")[0] ?? "Pelajar",
    streak: calcCurrentStreak(dates),
    bestStreak: calcBestStreak(dates),
    consistency: calcConsistency(dates),
    weekDots: buildWeekDots(dates),
    totalScore: statsRpcRes.data?.xp ?? 0,
    tier: currentTier,
    tierLabel: TIER_LABEL[currentTier],
    tierHsk: `HSK ${TIER_HSK[currentTier].join("–")}`,
    wordsMastered,
    flashcardDue,
    quizCompleted: quizCountRes.count ?? 0,
    recentActivity: (recentRes.data ?? []).map((r) => ({
      key: r.key,
      typeLabel: TYPE_LABEL[r.type] ?? r.type,
      score: r.score,
      timeAgo: timeAgo(r.updated_at),
    })),
  }
}
