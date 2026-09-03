/**
 * USER PROFILE — level, titles, badges, avatar customization
 * 
 * Sistem progresi user berdasarkan XP (total_score dari RPC get_user_stats):
 * - Level 1-10: Pemula (0-999 XP)
 * - Level 11-20: Menengah (1000-4999 XP)
 * - Level 21-30: Lanjut (5000-14999 XP)
 * - Level 31-40: Master (15000-49999 XP)
 * - Level 41+: Fasih (50000+ XP)
 * 
 * Gelar (titles) diberikan berdasarkan level dan tier yang terbuka.
 * Badge diberikan berdasarkan pencapaian spesifik (streak, quiz, dll).
 */

import { createClient } from "@/lib/supabase/browser"
import { TIER_ORDER, TIER_LABEL, fetchUnlockedTiers, type Tier } from "@/lib/tier-unlock"

export const TITLES = {
  pemula: [
    { level: 1, name: "Pemula Mandarin" },
    { level: 3, name: "Penjelajah Hanzi" },
    { level: 5, name: "Pecinta Kata" },
    { level: 8, name: "Siswa Setia" },
    { level: 10, name: "Siap Lanjut" },
  ],
  menengah: [
    { level: 11, name: "Murid Menengah" },
    { level: 13, name: "Penguasa Kosakata" },
    { level: 15, name: "Ahli Kalimat" },
    { level: 18, name: "Pendekar HSK" },
    { level: 20, name: "Siap Maju" },
  ],
  lanjut: [
    { level: 21, name: "Siswa Lanjut" },
    { level: 23, name: "Penyimak Dewa" },
    { level: 25, name: "Master Pinyin" },
    { level: 28, name: "Juara Kuis" },
    { level: 30, name: "Siap Naik" },
  ],
  master: [
    { level: 31, name: "Master Mandarin" },
    { level: 33, name: "Raja Hanzi" },
    { level: 35, name: "Dewa Kuis" },
    { level: 38, name: "Legenda Streak" },
    { level: 40, name: "Siap Tingkat Akhir" },
  ],
  fasih: [
    { level: 41, name: "Siswa Fasih" },
    { level: 45, name: "Penutur Asli" },
    { level: 50, name: "Dewa Mandarin" },
    { level: 60, name: "Legenda Abadi" },
    { level: 100, name: "Mahaguru" },
  ],
} as const

export const BADGES = {
  first_quiz: { name: "Quiz Pertama", description: "Menyelesaikan quiz pertama", icon: "🎯" },
  streak_7: { name: "Streak 7 Hari", description: "Streak belajar 7 hari berturut-turut", icon: "🔥" },
  streak_30: { name: "Streak 30 Hari", description: "Streak belajar 30 hari berturut-turut", icon: "⚡" },
  words_100: { name: "100 Kata", description: "Menghafal 100 kata", icon: "📚" },
  words_500: { name: "500 Kata", description: "Menghafal 500 kata", icon: "📖" },
  words_1000: { name: "1000 Kata", description: "Menghafal 1000 kata", icon: "📕" },
  quiz_10: { name: "10 Quiz", description: "Menyelesaikan 10 quiz", icon: "🏆" },
  quiz_50: { name: "50 Quiz", description: "Menyelesaikan 50 quiz", icon: "🥇" },
  tier_menengah: { name: "Tier Menengah", description: "Membuka tier menengah", icon: "🌟" },
  tier_lanjut: { name: "Tier Lanjut", description: "Membuka tier lanjut", icon: "💫" },
  tier_master: { name: "Tier Master", description: "Membuka tier master", icon: "✨" },
  tier_fasih: { name: "Tier Fasih", description: "Membuka tier fasih", icon: "🌟" },
} as const

export type BadgeKey = keyof typeof BADGES
export type TitleTier = keyof typeof TITLES

export interface UserProfile {
  userId: string
  displayName: string
  email: string | null
  avatar: string | null
  customAvatarUrl: string | null
  totalScore: number
  level: number
  title: string
  unlockedTiers: Tier[]
  badges: BadgeKey[]
  streak: number
  bestStreak: number
  wordsMastered: number
  quizCompleted: number
}

export interface AvatarOption {
  id: string
  emoji: string
  name: string
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "default", emoji: "👤", name: "Default" },
  { id: "student", emoji: "🎓", name: "Pelajar" },
  { id: "panda", emoji: "🐼", name: "Panda" },
  { id: "dragon", emoji: "🐉", name: "Naga" },
  { id: "cat", emoji: "🐱", name: "Kucing" },
  { id: "dog", emoji: "🐶", name: "Anjing" },
  { id: "fox", emoji: "🦊", name: "Rubah" },
  { id: "owl", emoji: "🦉", name: "Burung Hantu" },
  { id: "rabbit", emoji: "🐰", name: "Kelinci" },
  { id: "bear", emoji: "🐻", name: "Beruang" },
]

function calculateLevel(xp: number): number {
  if (xp < 1000) return Math.min(10, Math.floor(xp / 100) + 1)
  if (xp < 5000) return Math.min(20, Math.floor((xp - 1000) / 400) + 11)
  if (xp < 15000) return Math.min(30, Math.floor((xp - 5000) / 1000) + 21)
  if (xp < 50000) return Math.min(40, Math.floor((xp - 15000) / 3500) + 31)
  return Math.min(100, Math.floor((xp - 50000) / 10000) + 41)
}

function getTitleForLevel(level: number, unlockedTiers: Tier[]): string {
  const highestTier = getHighestUnlockedTier(unlockedTiers)
  const tierTitles = TITLES[highestTier] || TITLES.pemula
  
  for (let i = tierTitles.length - 1; i >= 0; i--) {
    if (level >= tierTitles[i].level) {
      return tierTitles[i].name
    }
  }
  return tierTitles[0]?.name || "Pemula Mandarin"
}

function getHighestUnlockedTier(tiers: Tier[]): Tier {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    if (tiers.includes(TIER_ORDER[i])) return TIER_ORDER[i]
  }
  return "pemula"
}

function calculateBadges(
  streak: number,
  bestStreak: number,
  wordsMastered: number,
  quizCompleted: number,
  unlockedTiers: Tier[]
): BadgeKey[] {
  const badges: BadgeKey[] = []
  
  if (quizCompleted > 0) badges.push("first_quiz")
  if (streak >= 7 || bestStreak >= 7) badges.push("streak_7")
  if (streak >= 30 || bestStreak >= 30) badges.push("streak_30")
  if (wordsMastered >= 100) badges.push("words_100")
  if (wordsMastered >= 500) badges.push("words_500")
  if (wordsMastered >= 1000) badges.push("words_1000")
  if (quizCompleted >= 10) badges.push("quiz_10")
  if (quizCompleted >= 50) badges.push("quiz_50")
  if (unlockedTiers.includes("menengah")) badges.push("tier_menengah")
  if (unlockedTiers.includes("lanjut")) badges.push("tier_lanjut")
  if (unlockedTiers.includes("master")) badges.push("tier_master")
  if (unlockedTiers.includes("fasih")) badges.push("tier_fasih")
  
  return badges
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return null

  const [profileRes, statsRpcRes, streakRes, progressRes, quizCountRes, unlockedTiers] =
    await Promise.all([
      supa.from("user_profile").select("display_name, selected_avatar, custom_avatar_url").eq("user_id", user.id).maybeSingle(),
      supa.rpc("get_user_stats"),
      supa.from("daily_streaks").select("date").eq("user_id", user.id).gte("date", new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10)),
      supa.from("user_card_progress").select("srs_level").eq("user_id", user.id),
      supa.from("user_scores").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("type", "quiz"),
      fetchUnlockedTiers(),
    ])

  const totalScore = statsRpcRes.data?.xp ?? 0
  const level = calculateLevel(totalScore)
  const dates = new Set((streakRes.data ?? []).map((r) => r.date as string))
  
  const streak = (() => {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const startFrom = dates.has(today) ? today : dates.has(yesterday) ? yesterday : null
    if (!startFrom) return 0
    let streak = 0
    const cur = new Date(startFrom)
    while (dates.has(cur.toISOString().slice(0, 10))) {
      streak++
      cur.setDate(cur.getDate() - 1)
    }
    return streak
  })()

  const bestStreak = (() => {
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
  })()

  const wordsMastered = (progressRes.data ?? []).filter((c) => c.srs_level >= 1).length
  const quizCompleted = quizCountRes.count ?? 0

  return {
    userId: user.id,
    displayName: profileRes.data?.display_name ?? user.email?.split("@")[0] ?? "Pelajar",
    email: user.email ?? null,
    avatar: profileRes.data?.selected_avatar ?? null,
    customAvatarUrl: profileRes.data?.custom_avatar_url ?? null,
    totalScore,
    level,
    title: getTitleForLevel(level, unlockedTiers),
    unlockedTiers,
    badges: calculateBadges(streak, bestStreak, wordsMastered, quizCompleted, unlockedTiers),
    streak,
    bestStreak,
    wordsMastered,
    quizCompleted,
  }
}

export async function updateAvatar(avatarId: string): Promise<{ error: string | null }> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return { error: "Belum login" }

  const avatar = AVATAR_OPTIONS.find((opt) => opt.id === avatarId)?.emoji ?? null
  const { error } = await supa
    .from("user_profile")
    .upsert(
      { 
        user_id: user.id, 
        selected_avatar: avatar, 
        custom_avatar_url: null, // Hapus URL custom agar emoji bisa tampil
        updated_at: new Date().toISOString() 
      },
      { onConflict: "user_id" },
    )
  return { error: error?.message ?? null }
}

export async function updateProfileName(name: string): Promise<{ error: string | null }> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return { error: "Belum login" }

  const { error } = await supa
    .from("user_profile")
    .upsert(
      { user_id: user.id, display_name: name, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
  return { error: error?.message ?? null }
}

export async function uploadAvatarPhoto(
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return { url: null, error: "Belum login" }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const path = `${user.id}/profile.${ext}`

  // Upload (upsert agar foto lama langsung tertimpa)
  const { error: uploadError } = await supa.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return { url: null, error: uploadError.message }

  const { data: urlData } = supa.storage.from("avatars").getPublicUrl(path)
  // Tambahkan cache-busting agar browser tidak pakai foto lama
  const cacheBustedUrl = `${urlData.publicUrl}?t=${Date.now()}`

  const { error: dbError } = await supa
    .from("user_profile")
    .upsert(
      { user_id: user.id, custom_avatar_url: cacheBustedUrl, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )

  if (dbError) return { url: null, error: dbError.message }
  return { url: cacheBustedUrl, error: null }
}
