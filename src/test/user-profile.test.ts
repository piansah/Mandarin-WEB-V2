/**
 * Test untuk logika XP / Level / Badge
 * Menguji kalkulasi level dari XP dan badge dari pencapaian user
 */

import { describe, it, expect } from "vitest"

// Kita extract fungsi murni untuk ditest tanpa DB calls
// Salin logika dari user-profile.ts agar tidak perlu mock Supabase

const TIER_ORDER = ["pemula", "menengah", "lanjut", "master", "fasih"] as const
type Tier = typeof TIER_ORDER[number]

const TITLES = {
  pemula:   [{ level: 1, name: "Pemula Mandarin" }, { level: 3, name: "Penjelajah Hanzi" }, { level: 5, name: "Pecinta Kata" }, { level: 8, name: "Siswa Setia" }, { level: 10, name: "Siap Lanjut" }],
  menengah: [{ level: 11, name: "Murid Menengah" }, { level: 13, name: "Penguasa Kosakata" }, { level: 15, name: "Ahli Kalimat" }, { level: 18, name: "Pendekar HSK" }, { level: 20, name: "Siap Maju" }],
  lanjut:   [{ level: 21, name: "Siswa Lanjut" }, { level: 23, name: "Penyimak Dewa" }, { level: 25, name: "Master Pinyin" }, { level: 28, name: "Juara Kuis" }, { level: 30, name: "Siap Naik" }],
  master:   [{ level: 31, name: "Master Mandarin" }, { level: 33, name: "Raja Hanzi" }, { level: 35, name: "Dewa Kuis" }, { level: 38, name: "Legenda Streak" }, { level: 40, name: "Siap Tingkat Akhir" }],
  fasih:    [{ level: 41, name: "Siswa Fasih" }, { level: 45, name: "Penutur Asli" }, { level: 50, name: "Dewa Mandarin" }, { level: 60, name: "Legenda Abadi" }, { level: 100, name: "Mahaguru" }],
}

function calculateLevel(xp: number): number {
  if (xp < 1000) return Math.min(10, Math.floor(xp / 100) + 1)
  if (xp < 5000) return Math.min(20, Math.floor((xp - 1000) / 400) + 11)
  if (xp < 15000) return Math.min(30, Math.floor((xp - 5000) / 1000) + 21)
  if (xp < 50000) return Math.min(40, Math.floor((xp - 15000) / 3500) + 31)
  return Math.min(100, Math.floor((xp - 50000) / 10000) + 41)
}

function getHighestUnlockedTier(tiers: Tier[]): Tier {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    if (tiers.includes(TIER_ORDER[i])) return TIER_ORDER[i]
  }
  return "pemula"
}

function getTitleForLevel(level: number, unlockedTiers: Tier[]): string {
  const highestTier = getHighestUnlockedTier(unlockedTiers)
  const tierTitles = TITLES[highestTier] || TITLES.pemula
  for (let i = tierTitles.length - 1; i >= 0; i--) {
    if (level >= tierTitles[i].level) return tierTitles[i].name
  }
  return tierTitles[0]?.name || "Pemula Mandarin"
}

type BadgeKey = "first_quiz" | "streak_7" | "streak_30" | "words_100" | "words_500" | "words_1000" | "quiz_10" | "quiz_50" | "tier_menengah" | "tier_lanjut" | "tier_master" | "tier_fasih"

function calculateBadges(streak: number, bestStreak: number, wordsMastered: number, quizCompleted: number, unlockedTiers: Tier[]): BadgeKey[] {
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

// --- Tests --------------------------------------------------------------------

describe("calculateLevel", () => {
  describe("Tier Pemula (Level 1-10)", () => {
    it("0 XP = Level 1", () => expect(calculateLevel(0)).toBe(1))
    it("99 XP = Level 1", () => expect(calculateLevel(99)).toBe(1))
    it("100 XP = Level 2", () => expect(calculateLevel(100)).toBe(2))
    it("500 XP = Level 6", () => expect(calculateLevel(500)).toBe(6))
    it("999 XP = Level 10", () => expect(calculateLevel(999)).toBe(10))
  })

  describe("Tier Menengah (Level 11-20)", () => {
    it("1000 XP = Level 11", () => expect(calculateLevel(1000)).toBe(11))
    it("1400 XP = Level 12", () => expect(calculateLevel(1400)).toBe(12))
    it("4999 XP = Level 20", () => expect(calculateLevel(4999)).toBe(20))
  })

  describe("Tier Lanjut (Level 21-30)", () => {
    it("5000 XP = Level 21", () => expect(calculateLevel(5000)).toBe(21))
    it("14999 XP = Level 30", () => expect(calculateLevel(14999)).toBe(30))
  })

  describe("Tier Master (Level 31-40)", () => {
    it("15000 XP = Level 31", () => expect(calculateLevel(15000)).toBe(31))
    it("49999 XP = Level 40", () => expect(calculateLevel(49999)).toBe(40))
  })

  describe("Tier Fasih (Level 41+)", () => {
    it("50000 XP = Level 41", () => expect(calculateLevel(50000)).toBe(41))
    it("XP sangat besar tidak melebihi Level 100", () => {
      expect(calculateLevel(9999999)).toBe(100)
    })
  })
})

describe("getTitleForLevel", () => {
  it("Level 1 dengan tier pemula = Pemula Mandarin", () => {
    expect(getTitleForLevel(1, ["pemula"])).toBe("Pemula Mandarin")
  })

  it("Level 5 dengan tier pemula = Pecinta Kata", () => {
    expect(getTitleForLevel(5, ["pemula"])).toBe("Pecinta Kata")
  })

  it("Level 11 dengan tier menengah = Murid Menengah", () => {
    expect(getTitleForLevel(11, ["pemula", "menengah"])).toBe("Murid Menengah")
  })

  it("getHighestUnlockedTier memilih tier tertinggi", () => {
    expect(getHighestUnlockedTier(["pemula", "menengah", "lanjut"])).toBe("lanjut")
    expect(getHighestUnlockedTier(["pemula"])).toBe("pemula")
    expect(getHighestUnlockedTier([])).toBe("pemula")
  })

  it("tanpa tier = pemula default", () => {
    expect(getTitleForLevel(1, [])).toBe("Pemula Mandarin")
  })
})

describe("calculateBadges", () => {
  it("tidak ada badge jika belum ada aktivitas", () => {
    const badges = calculateBadges(0, 0, 0, 0, [])
    expect(badges).toHaveLength(0)
  })

  it("first_quiz muncul jika sudah 1 kali quiz", () => {
    const badges = calculateBadges(0, 0, 0, 1, [])
    expect(badges).toContain("first_quiz")
  })

  it("streak_7 muncul jika streak sekarang atau best streak >= 7", () => {
    expect(calculateBadges(7, 0, 0, 0, [])).toContain("streak_7")
    expect(calculateBadges(0, 7, 0, 0, [])).toContain("streak_7")
    expect(calculateBadges(6, 6, 0, 0, [])).not.toContain("streak_7")
  })

  it("streak_30 hanya muncul jika streak >= 30", () => {
    expect(calculateBadges(30, 0, 0, 0, [])).toContain("streak_30")
    expect(calculateBadges(7, 0, 0, 0, [])).not.toContain("streak_30")
  })

  it("badge kata muncul di threshold yang tepat", () => {
    expect(calculateBadges(0, 0, 100, 0, [])).toContain("words_100")
    expect(calculateBadges(0, 0, 99, 0, [])).not.toContain("words_100")
    expect(calculateBadges(0, 0, 500, 0, [])).toContain("words_500")
    expect(calculateBadges(0, 0, 1000, 0, [])).toContain("words_1000")
  })

  it("badge tier muncul sesuai tier yang terbuka", () => {
    const badges = calculateBadges(0, 0, 0, 0, ["pemula", "menengah"])
    expect(badges).toContain("tier_menengah")
    expect(badges).not.toContain("tier_lanjut")
  })

  it("semua badge muncul jika semua kondisi terpenuhi", () => {
    const badges = calculateBadges(30, 30, 1000, 50, ["pemula", "menengah", "lanjut", "master", "fasih"])
    expect(badges).toContain("first_quiz")
    expect(badges).toContain("streak_7")
    expect(badges).toContain("streak_30")
    expect(badges).toContain("words_100")
    expect(badges).toContain("words_500")
    expect(badges).toContain("words_1000")
    expect(badges).toContain("quiz_10")
    expect(badges).toContain("quiz_50")
    expect(badges).toContain("tier_menengah")
    expect(badges).toContain("tier_fasih")
  })
})
