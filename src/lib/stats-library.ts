/**
 * STATS LIBRARY — Data layer untuk page statistik
 * 
 * Mengambil data real dari database untuk:
 * - Aktivitas mingguan (menit belajar per hari)
 * - Progress per level HSK
 * - Akurasi per fitur
 * - Kosakata perlu perhatian
 * - Pencapaian (achievements)
 */

import { createClient } from "@/lib/supabase/browser"
import { localDateStartIso, localDateString, shiftDateString } from "@/lib/local-date"

type SupabaseClient = ReturnType<typeof createClient>

export type WeeklyActivity = {
  day: string
  minutes: number
  words: number
}

export type HskProgress = {
  level: string
  total: number
  learned: number
  color: string
}

export type AccuracyItem = {
  label: string
  value: number
  color: string
}

export type DifficultWord = {
  word: string
  pinyin: string
  meaning: string
  accuracy: number
}

export type Achievement = {
  label: string
  desc: string
  done: boolean
}

export type StatsData = {
  weeklyActivity: WeeklyActivity[]
  hskProgress: HskProgress[]
  accuracyData: AccuracyItem[]
  difficultWords: DifficultWord[]
  achievements: Achievement[]
  streak: number
  bestStreak: number
  totalWordsLearned: number
  totalCards: number
  totalStudyMinutes: number
  monthlyStudyMinutes: number
}

export function todayStr(): string {
  return localDateString()
}

export function calcCurrentStreak(dates: Set<string>): number {
  const today = todayStr()
  const yesterday = shiftDateString(today, -1)
  const startFrom = dates.has(today) ? today : dates.has(yesterday) ? yesterday : null
  if (!startFrom) return 0

  let streak = 0
  let cur = startFrom
  while (dates.has(cur)) {
    streak++
    cur = shiftDateString(cur, -1)
  }
  return streak
}

export function calcBestStreak(dates: Set<string>): number {
  if (!dates.size) return 0
  const sorted = [...dates].sort()
  let best = 1
  let cur = 1
  for (let i = 1; i < sorted.length; i++) {
    if (shiftDateString(sorted[i - 1], 1) === sorted[i]) {
      cur++
      if (cur > best) best = cur
    } else {
      cur = 1
    }
  }
  return best
}

/**
 * Ambil aktivitas mingguan (7 hari terakhir)
 * - minutes: total menit belajar (dari user_scores)
 * - words: kata baru dipelajari (dari user_card_progress)
 */
async function fetchWeeklyActivity(supa: SupabaseClient, userId: string): Promise<WeeklyActivity[]> {
  const DAY_LABEL = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Min
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
  const weekEnd = new Date(monday)
  weekEnd.setDate(monday.getDate() + 7)
  const weekStartKey = localDateString(monday)
  const weekEndKey = localDateString(weekEnd)

  // Ambil satu rentang minggu; sebelumnya tiga query diulang berurutan untuk
  // tiap hari (21 request total).
  const [sessionsRes, wordsRes, streakRes] = await Promise.all([
    supa.from("user_scores").select("updated_at").eq("user_id", userId)
      .gte("updated_at", localDateStartIso(weekStartKey)).lt("updated_at", localDateStartIso(weekEndKey)),
    supa.from("user_card_progress").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gte("srs_level", 1),
    supa.from("daily_streaks").select("date").eq("user_id", userId).lte("date", weekEndKey),
  ])

  const sessionsByDate = new Map<string, number>()
  sessionsRes.data?.forEach((row) => {
    if (!row.updated_at) return
    const dateKey = localDateString(new Date(row.updated_at))
    sessionsByDate.set(dateKey, (sessionsByDate.get(dateKey) ?? 0) + 1)
  })
  const streakDates = (streakRes.data ?? []).map((row) => row.date as string)
  const totalWords = wordsRes.count ?? 0

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    const dateKey = localDateString(date)
    const totalDays = streakDates.filter((streakDate) => streakDate <= dateKey).length || 1
    const wordsPerDay = Math.round(totalWords / totalDays)
    return {
      day: DAY_LABEL[index],
      minutes: (sessionsByDate.get(dateKey) ?? 0) * 5,
      words: index === 6 ? totalWords : Math.round(wordsPerDay / 7),
    }
  })
}

/**
 * Ambil progress per level HSK
 * - total: total kartu di flashcard_sets dengan hsk_level tersebut
 * - learned: kartu dengan srs_level >= 1 di user_card_progress
 */
async function fetchHskProgress(supa: SupabaseClient, userId: string): Promise<HskProgress[]> {
  const levels = [
    { level: "HSK 1", hskLevel: 1, color: "bg-emerald-500" },
    { level: "HSK 2", hskLevel: 2, color: "bg-blue-500" },
    { level: "HSK 3", hskLevel: 3, color: "bg-violet-500" },
    { level: "HSK 4", hskLevel: 4, color: "bg-orange-500" },
    { level: "HSK 5", hskLevel: 5, color: "bg-rose-500" },
    { level: "HSK 6", hskLevel: 6, color: "bg-yellow-500" },
  ]

  // Data deck dan progres user tidak saling bergantung.
  const [decksRes, progressRes] = await Promise.all([
    supa.from("flashcard_sets").select("id, hsk_level"),
    supa.from("user_card_progress").select("card_id").eq("user_id", userId).gte("srs_level", 1),
  ])
  const decks = decksRes.data

  const decksByLevel = new Map<number, number[]>()
  for (const deck of decks ?? []) {
    if (deck.hsk_level) {
      const ids = decksByLevel.get(deck.hsk_level) ?? []
      ids.push(deck.id)
      decksByLevel.set(deck.hsk_level, ids)
    }
  }

  const learnedCardIds = new Set<string>((progressRes.data ?? []).map((row) => String(row.card_id)))
  const cardsByLevel = await Promise.all(levels.map((level) => {
    const deckIds = decksByLevel.get(level.hskLevel) ?? []
    return deckIds.length
      ? supa.from("flashcard_cards").select("id", { count: "exact" }).in("set_id", deckIds)
      : Promise.resolve({ data: [], count: 0 })
  }))

  return levels.map((level, index) => ({
    level: level.level,
    total: cardsByLevel[index].count ?? 0,
    learned: cardsByLevel[index].data?.filter((card) => learnedCardIds.has(String(card.id))).length ?? 0,
    color: level.color,
  }))
}

/**
 * Ambil akurasi per fitur dari user_scores
 */
async function fetchAccuracyData(supa: SupabaseClient, userId: string): Promise<AccuracyItem[]> {
  const typeMap: Record<string, { label: string; color: string }> = {
    fc_session: { label: "Flashcard", color: "bg-emerald-500" },
    quiz: { label: "Kuis Modul", color: "bg-blue-500" },
    grammar: { label: "Grammar", color: "bg-violet-500" },
    kal: { label: "Estafet", color: "bg-orange-500" },
    nada_session: { label: "Nada", color: "bg-pink-500" },
    tulis_session: { label: "Tulis", color: "bg-cyan-500" },
  }

  const entries = Object.entries(typeMap)
  const results = await Promise.all(entries.map(([type]) =>
    supa.from("user_scores").select("score").eq("user_id", userId).eq("type", type),
  ))

  return entries.flatMap(([type, info], index) => {
    const scores = results[index].data?.map((row) => row.score ?? 0)
    if (!scores?.length) return []
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
    return [{ label: info.label, value: Math.round(average), color: info.color }]
  })
}

/**
 * Ambil kosakata yang perlu perhatian (akurasi rendah)
 * Dihitung dari user_card_progress dengan srs_level rendah
 */
async function fetchDifficultWords(supa: SupabaseClient, userId: string): Promise<DifficultWord[]> {
  // Ambil kartu dengan srs_level rendah (0-2) = sering salah/lupa
  const { data: progressData } = await supa
    .from("user_card_progress")
    .select("card_id, srs_level")
    .eq("user_id", userId)
    .lte("srs_level", 2)
    .order("srs_level", { ascending: true })
    .limit(10)

  if (!progressData || progressData.length === 0) return []

  const cardIds = progressData.map((p: { card_id: string | number; srs_level: number }) => String(p.card_id))
  const { data: cards } = await supa
    .from("flashcard_cards")
    .select("id, hanzi, pinyin, arti")
    .in("id", cardIds)

  const difficultWords: DifficultWord[] = []

  for (const card of cards ?? []) {
    const progress = progressData.find((p: { card_id: string | number; srs_level: number }) => p.card_id === card.id)
    // Hitung akurasi berdasarkan srs_level (0 = sangat sulit, 2 = agak sulit)
    const accuracy = 30 + (progress?.srs_level ?? 0) * 20 // 30%, 50%, 70%

    difficultWords.push({
      word: card.hanzi ?? "",
      pinyin: card.pinyin ?? "",
      meaning: card.arti ?? "",
      accuracy,
    })
  }

  return difficultWords.slice(0, 5)
}

/**
 * Ambil pencapaian (achievements)
 */
async function fetchAchievements(supa: SupabaseClient, userId: string): Promise<Achievement[]> {
  const [streakRes, wordsRes, quizRes, decksRes] = await Promise.all([
    supa.from("daily_streaks").select("date").eq("user_id", userId),
    supa.from("user_card_progress").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gte("srs_level", 1),
    supa.from("user_scores").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("type", "quiz"),
    supa.from("flashcard_sets").select("id").eq("hsk_level", 1),
  ])

  const achievements: Achievement[] = []
  const streakData = streakRes.data
  const dates = new Set<string>(streakData?.map((s: { date: string }) => s.date) ?? [])
  const currentStreak = calcCurrentStreak(dates)
  achievements.push({
    label: "Streak 7 Hari",
    desc: "Belajar 7 hari berturut-turut",
    done: currentStreak >= 7,
  })

  // Streak 30 hari
  achievements.push({
    label: "Streak 30 Hari",
    desc: "Belajar 30 hari berturut-turut",
    done: currentStreak >= 30,
  })

  achievements.push({
    label: "100 Kata Pertama",
    desc: "Pelajari 100 kata unik",
    done: (wordsRes.count ?? 0) >= 100,
  })

  achievements.push({
    label: "Modul Pertama",
    desc: "Selesaikan 1 modul belajar",
    done: (quizRes.count ?? 0) >= 1,
  })

  // HSK 1 tuntas
  const hsk1Decks = decksRes.data
  const hsk1DeckIds = hsk1Decks?.map((d: { id: number }) => d.id) ?? []
  let hsk1Total = 0
  let hsk1Learned = 0

  if (hsk1DeckIds.length > 0) {
    const [countRes, cardsRes, progressRes] = await Promise.all([
      supa.from("flashcard_cards").select("id", { count: "exact", head: true }).in("set_id", hsk1DeckIds),
      supa.from("flashcard_cards").select("id").in("set_id", hsk1DeckIds),
      supa.from("user_card_progress").select("card_id").eq("user_id", userId).gte("srs_level", 1),
    ])
    hsk1Total = countRes.count ?? 0
    const hsk1CardIds = new Set<string>((cardsRes.data ?? []).map((card) => String(card.id)))
    hsk1Learned = [...new Set(progressRes.data?.map((row) => String(row.card_id)) ?? [])]
      .filter((cardId) => hsk1CardIds.has(cardId)).length
  }

  achievements.push({
    label: "HSK 1 Tuntas",
    desc: "Kuasai seluruh kosakata HSK 1",
    done: hsk1Total > 0 && hsk1Learned >= hsk1Total,
  })

  return achievements
}

/**
 * Fungsi utama untuk mengambil semua data statistik
 */
export async function fetchStatsData(): Promise<StatsData | null> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return null

  // Ambil data streak
  const since = (() => {
    return shiftDateString(localDateString(), -400)
  })()

  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartStr = localDateString(monthStart)
  const [streakRes, learnedRes, cardsRes, sessionsRes, monthlySessionsRes] = await Promise.all([
    supa.from("daily_streaks").select("date").eq("user_id", user.id).gte("date", since),
    supa.from("user_card_progress").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("srs_level", 1),
    supa.from("flashcard_cards").select("id", { count: "exact", head: true }),
    supa.from("user_scores").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supa.from("user_scores").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("updated_at", localDateStartIso(monthStartStr)),
  ])

  const streakData = streakRes.data
  const dates = new Set(streakData?.map((r) => r.date as string) ?? [])
  const streak = calcCurrentStreak(dates)
  const bestStreak = calcBestStreak(dates)

  // Total menit belajar (estimasi dari total sesi)
  const totalStudyMinutes = (sessionsRes.count ?? 0) * 5
  const monthlyStudyMinutes = (monthlySessionsRes.count ?? 0) * 5

  // Ambil semua data statistik secara paralel
  const [weeklyActivity, hskProgress, accuracyData, difficultWords, achievements] =
    await Promise.all([
      fetchWeeklyActivity(supa, user.id),
      fetchHskProgress(supa, user.id),
      fetchAccuracyData(supa, user.id),
      fetchDifficultWords(supa, user.id),
      fetchAchievements(supa, user.id),
    ])

  return {
    weeklyActivity,
    hskProgress,
    accuracyData,
    difficultWords,
    achievements,
    streak,
    bestStreak,
    totalWordsLearned: learnedRes.count ?? 0,
    totalCards: cardsRes.count ?? 0,
    totalStudyMinutes,
    monthlyStudyMinutes,
  }
}
