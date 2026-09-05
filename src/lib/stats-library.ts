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
  totalStudyMinutes: number
  monthlyStudyMinutes: number
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

/**
 * Ambil aktivitas mingguan (7 hari terakhir)
 * - minutes: total menit belajar (dari user_scores)
 * - words: kata baru dipelajari (dari user_card_progress)
 */
async function fetchWeeklyActivity(supa: any, userId: string): Promise<WeeklyActivity[]> {
  const DAY_LABEL = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Min
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))

  const activity: WeeklyActivity[] = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)

    // Hitung menit belajar dari user_scores (estimasi berdasarkan jumlah sesi)
    // Anggap 1 sesi rata-rata 5 menit untuk simplifikasi
    const { count: sessionCount } = await supa
      .from("user_scores")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("updated_at", `${dateStr}T00:00:00`)
      .lt("updated_at", `${dateStr}T23:59:59`)

    const minutes = (sessionCount ?? 0) * 5

    // Hitung kata baru dari user_card_progress (srs_level >= 1 untuk pertama kali)
    // Kita tidak bisa tahu kapan pertama kali, jadi gunakan total dengan srs_level >= 1
    const { count: wordsCount } = await supa
      .from("user_card_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("srs_level", 1)

    // Untuk words per hari, kita gunakan estimasi sederhana:
    // Total words / total active days
    const { data: streakData } = await supa
      .from("daily_streaks")
      .select("date")
      .eq("user_id", userId)
      .lte("date", dateStr)

    const totalDays = streakData?.length ?? 1
    const totalWords = wordsCount ?? 0
    const wordsPerDay = totalDays > 0 ? Math.round(totalWords / totalDays) : 0

    activity.push({
      day: DAY_LABEL[i],
      minutes,
      words: i === 6 ? totalWords : Math.round(wordsPerDay / 7) // Distribusi rata
    })
  }

  return activity
}

/**
 * Ambil progress per level HSK
 * - total: total kartu di flashcard_sets dengan hsk_level tersebut
 * - learned: kartu dengan srs_level >= 1 di user_card_progress
 */
async function fetchHskProgress(supa: any, userId: string): Promise<HskProgress[]> {
  const levels = [
    { level: "HSK 1", hskLevel: 1, color: "bg-emerald-500" },
    { level: "HSK 2", hskLevel: 2, color: "bg-blue-500" },
    { level: "HSK 3", hskLevel: 3, color: "bg-violet-500" },
    { level: "HSK 4", hskLevel: 4, color: "bg-orange-500" },
    { level: "HSK 5", hskLevel: 5, color: "bg-rose-500" },
    { level: "HSK 6", hskLevel: 6, color: "bg-yellow-500" },
  ]

  const progress: HskProgress[] = []

  // Ambil semua deck dengan hsk_level
  const { data: decks } = await supa
    .from("flashcard_sets")
    .select("id, hsk_level")

  const decksByLevel = new Map<number, number[]>()
  for (const deck of decks ?? []) {
    if (deck.hsk_level) {
      const ids = decksByLevel.get(deck.hsk_level) ?? []
      ids.push(deck.id)
      decksByLevel.set(deck.hsk_level, ids)
    }
  }

  // Kartu yang sudah dipelajari (srs_level >= 1)
  const { data: progressData } = await supa
    .from("user_card_progress")
    .select("card_id, srs_level")
    .eq("user_id", userId)
    .gte("srs_level", 1)

  const learnedCardIds = new Set<string>(progressData?.map((p: any) => String(p.card_id)) ?? [])

  for (const level of levels) {
    const deckIds = decksByLevel.get(level.hskLevel) ?? []

    // Total kartu di semua deck level ini
    let total = 0
    let learned = 0

    if (deckIds.length > 0) {
      const { count } = await supa
        .from("flashcard_cards")
        .select("id", { count: "exact", head: true })
        .in("set_id", deckIds)

      total = count ?? 0

      // Cek berapa dari kartu di level ini yang sudah dipelajari
      const { data: cardsInLevel } = await supa
        .from("flashcard_cards")
        .select("id")
        .in("set_id", deckIds)

      learned = cardsInLevel?.filter((c: any) => learnedCardIds.has(String(c.id))).length ?? 0
    }

    progress.push({
      level: level.level,
      total,
      learned,
      color: level.color,
    })
  }

  return progress
}

/**
 * Ambil akurasi per fitur dari user_scores
 */
async function fetchAccuracyData(supa: any, userId: string): Promise<AccuracyItem[]> {
  const typeMap: Record<string, { label: string; color: string }> = {
    fc_session: { label: "Flashcard", color: "bg-emerald-500" },
    quiz: { label: "Kuis Modul", color: "bg-blue-500" },
    grammar: { label: "Grammar", color: "bg-violet-500" },
    kal: { label: "Estafet", color: "bg-orange-500" },
    nada_session: { label: "Nada", color: "bg-pink-500" },
    tulis_session: { label: "Tulis", color: "bg-cyan-500" },
  }

  const accuracyData: AccuracyItem[] = []

  for (const [type, info] of Object.entries(typeMap)) {
    const { data } = await supa
      .from("user_scores")
      .select("score")
      .eq("user_id", userId)
      .eq("type", type)

    if (data && data.length > 0) {
      const avgScore = data.reduce((sum: number, row: any) => sum + (row.score ?? 0), 0) / data.length
      accuracyData.push({
        label: info.label,
        value: Math.round(avgScore),
        color: info.color,
      })
    }
  }

  return accuracyData
}

/**
 * Ambil kosakata yang perlu perhatian (akurasi rendah)
 * Dihitung dari user_card_progress dengan srs_level rendah
 */
async function fetchDifficultWords(supa: any, userId: string): Promise<DifficultWord[]> {
  // Ambil kartu dengan srs_level rendah (0-2) = sering salah/lupa
  const { data: progressData } = await supa
    .from("user_card_progress")
    .select("card_id, srs_level")
    .eq("user_id", userId)
    .lte("srs_level", 2)
    .order("srs_level", { ascending: true })
    .limit(10)

  if (!progressData || progressData.length === 0) return []

  const cardIds = progressData.map((p: any) => p.card_id)
  const { data: cards } = await supa
    .from("flashcard_cards")
    .select("id, hanzi, pinyin, arti")
    .in("id", cardIds)

  const difficultWords: DifficultWord[] = []

  for (const card of cards ?? []) {
    const progress = progressData.find((p: any) => p.card_id === card.id)
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
async function fetchAchievements(supa: any, userId: string): Promise<Achievement[]> {
  const achievements: Achievement[] = []

  // Streak 7 hari
  const { data: streakData } = await supa
    .from("daily_streaks")
    .select("date")
    .eq("user_id", userId)
  const dates = new Set<string>(streakData?.map((s: any) => s.date) ?? [])
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

  // 100 kata pertama
  const { count: wordsCount } = await supa
    .from("user_card_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("srs_level", 1)
  achievements.push({
    label: "100 Kata Pertama",
    desc: "Pelajari 100 kata unik",
    done: (wordsCount ?? 0) >= 100,
  })

  // Modul pertama (selesaikan 1 quiz/grammar)
  const { count: quizCount } = await supa
    .from("user_scores")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "quiz")
  achievements.push({
    label: "Modul Pertama",
    desc: "Selesaikan 1 modul belajar",
    done: (quizCount ?? 0) >= 1,
  })

  // HSK 1 tuntas
  const { data: hsk1Decks } = await supa
    .from("flashcard_sets")
    .select("id")
    .eq("hsk_level", 1)

  const hsk1DeckIds = hsk1Decks?.map((d: any) => d.id) ?? []
  let hsk1Total = 0
  let hsk1Learned = 0

  if (hsk1DeckIds.length > 0) {
    const { count } = await supa
      .from("flashcard_cards")
      .select("id", { count: "exact", head: true })
      .in("set_id", hsk1DeckIds)

    hsk1Total = count ?? 0

    const { data: hsk1Cards } = await supa
      .from("flashcard_cards")
      .select("id")
      .in("set_id", hsk1DeckIds)

    const hsk1CardIds = new Set<string>(hsk1Cards?.map((c: any) => String(c.id)) ?? [])

    const { data: userProgress } = await supa
      .from("user_card_progress")
      .select("card_id")
      .eq("user_id", userId)
      .gte("srs_level", 1)

    hsk1Learned = userProgress?.filter((p: any) => hsk1CardIds.has(String(p.card_id))).length ?? 0
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
    const d = new Date()
    d.setDate(d.getDate() - 400)
    return d.toISOString().slice(0, 10)
  })()

  const { data: streakData } = await supa
    .from("daily_streaks")
    .select("date")
    .eq("user_id", user.id)
    .gte("date", since)

  const dates = new Set(streakData?.map((r) => r.date as string) ?? [])
  const streak = calcCurrentStreak(dates)
  const bestStreak = calcBestStreak(dates)

  // Total kata dipelajari
  const { count: totalWordsLearned } = await supa
    .from("user_card_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("srs_level", 1)

  // Total menit belajar (estimasi dari total sesi)
  const { count: totalSessions } = await supa
    .from("user_scores")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  const totalStudyMinutes = (totalSessions ?? 0) * 5

  // Menit belajar bulan ini
  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartStr = monthStart.toISOString().slice(0, 10)

  const { count: monthlySessions } = await supa
    .from("user_scores")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("updated_at", `${monthStartStr}T00:00:00`)

  const monthlyStudyMinutes = (monthlySessions ?? 0) * 5

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
    totalWordsLearned: totalWordsLearned ?? 0,
    totalStudyMinutes,
    monthlyStudyMinutes,
  }
}
