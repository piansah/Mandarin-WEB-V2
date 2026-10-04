import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeNextSrsState,
  previewIntervalDays,
  computeSrsUpdate,
  DEFAULT_EASE_FACTOR,
  MIN_EASE_FACTOR,
  todayStr,
  isCardDue,
  countSwipeMastered,
  computeSessionAccuracy,
  computeSessionStats,
  recordSrsReview
} from "@/lib/srs"

describe("SM-2 SRS Algorithm", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("Sequence: Mudah x4", () => {
    let state = { repetitions: 0, intervalDays: 0, easeFactor: DEFAULT_EASE_FACTOR }
    
    state = computeNextSrsState(state, 5)
    expect(state).toEqual({ intervalDays: 1, easeFactor: 2.6, repetitions: 1 })
    
    state = computeNextSrsState(state, 5)
    expect(state).toEqual({ intervalDays: 6, easeFactor: 2.7, repetitions: 2 })
    
    state = computeNextSrsState(state, 5)
    expect(state).toEqual({ intervalDays: 16, easeFactor: 2.8, repetitions: 3 })
    
    state = computeNextSrsState(state, 5)
    expect(state).toEqual({ intervalDays: 45, easeFactor: 2.9, repetitions: 4 })
  })

  it("Sequence: Ingat x3", () => {
    let state = { repetitions: 0, intervalDays: 0, easeFactor: DEFAULT_EASE_FACTOR }
    
    state = computeNextSrsState(state, 4)
    expect(state).toEqual({ intervalDays: 1, easeFactor: 2.5, repetitions: 1 })
    
    state = computeNextSrsState(state, 4)
    expect(state).toEqual({ intervalDays: 6, easeFactor: 2.5, repetitions: 2 })
    
    state = computeNextSrsState(state, 4)
    expect(state).toEqual({ intervalDays: 15, easeFactor: 2.5, repetitions: 3 })
  })

  it("Sequence: Sulit x3", () => {
    let state = { repetitions: 0, intervalDays: 0, easeFactor: DEFAULT_EASE_FACTOR }
    
    state = computeNextSrsState(state, 3)
    expect(state).toEqual({ intervalDays: 1, easeFactor: 2.36, repetitions: 1 })
    
    state = computeNextSrsState(state, 3)
    expect(state).toEqual({ intervalDays: 6, easeFactor: 2.22, repetitions: 2 })
    
    state = computeNextSrsState(state, 3)
    expect(state).toEqual({ intervalDays: 13, easeFactor: 2.08, repetitions: 3 })
  })

  it("Sequence: Mudah x3 then Lupa", () => {
    let state = { repetitions: 0, intervalDays: 0, easeFactor: DEFAULT_EASE_FACTOR }
    
    state = computeNextSrsState(state, 5)
    state = computeNextSrsState(state, 5)
    state = computeNextSrsState(state, 5)
    expect(state).toEqual({ intervalDays: 16, easeFactor: 2.8, repetitions: 3 })
    
    state = computeNextSrsState(state, 0)
    expect(state).toEqual({ intervalDays: 1, easeFactor: 2.8, repetitions: 0 })
  })

  it("EF never drops below MIN_EASE_FACTOR after many consecutive Sulit", () => {
    let state = { repetitions: 0, intervalDays: 0, easeFactor: DEFAULT_EASE_FACTOR }
    
    for (let i = 0; i < 20; i++) {
      state = computeNextSrsState(state, 3)
    }
    
    expect(state.easeFactor).toBeGreaterThanOrEqual(MIN_EASE_FACTOR)
  })

  it("Interval never exceeds MAX_INTERVAL_DAYS", () => {
    let state = { repetitions: 0, intervalDays: 0, easeFactor: DEFAULT_EASE_FACTOR }
    
    for (let i = 0; i < 20; i++) {
      state = computeNextSrsState(state, 5)
    }
    
    expect(state.intervalDays).toBeLessThanOrEqual(365)
  })

  it("previewIntervalDays equals computeSrsUpdate().interval_days", () => {
    const state = { repetitions: 2, intervalDays: 6, easeFactor: 2.5 }
    
    for (const q of [0, 3, 4, 5] as const) {
      expect(previewIntervalDays(state, q)).toBe(computeSrsUpdate(state, q).interval_days)
    }
  })

  it("computeSrsUpdate().next_review equals local today + interval (checking timezone fix)", () => {
    vi.setSystemTime(new Date("2026-10-03T00:00:00+07:00"))
    const state = { repetitions: 2, intervalDays: 6, easeFactor: 2.5 }

    const update = computeSrsUpdate(state, 4)

    expect(update.next_review).toBe("2026-10-18")
  })

  it("todayStr respects timezone at 23:30", () => {
    vi.setSystemTime(new Date("2026-10-03T23:30:00+07:00"))
    expect(todayStr()).toBe("2026-10-03")
  })
})

describe("countSwipeMastered", () => {
  it("20 cards with 14 Mudah -> 14", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>()
    const deckIds: string[] = []
    for (let i = 0; i < 20; i++) {
      const id = `card-${i}`
      deckIds.push(id)
      if (i < 14) {
        ratings.set(id, 5)
      } else {
        ratings.set(id, 4)
      }
    }
    expect(countSwipeMastered(ratings, deckIds)).toBe(14)
  })

  it("Lupa then Mudah: latest rating alone counts, but lapsed excludes it", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>()
    ratings.set("card-1", 0)
    ratings.set("card-1", 5)
    // tanpa lapsed (perilaku dasar fungsi): dihitung
    expect(countSwipeMastered(ratings, ["card-1"])).toBe(1)
    // dengan lapsed (seperti di hook): tidak dihitung
    expect(countSwipeMastered(ratings, ["card-1"], new Set(["card-1"]))).toBe(0)
  })

  it("Mudah then Sulit/Lupa not counted", () => {
    const ratings1 = new Map<string, 0 | 3 | 4 | 5>()
    ratings1.set("card-1", 5)
    ratings1.set("card-1", 3)
    expect(countSwipeMastered(ratings1, ["card-1"])).toBe(0)

    const ratings2 = new Map<string, 0 | 3 | 4 | 5>()
    ratings2.set("card-1", 5)
    ratings2.set("card-1", 0)
    expect(countSwipeMastered(ratings2, ["card-1"])).toBe(0)
  })

  it("Ingat/Sulit never count", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 4],
      ["card-2", 3]
    ])
    expect(countSwipeMastered(ratings, ["card-1", "card-2"])).toBe(0)
  })

  it("unknown ids ignored", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 5],
      ["card-2", 5],
      ["card-3", 5]
    ])
    expect(countSwipeMastered(ratings, ["card-1", "card-2"])).toBe(2)
  })

  it("duplicate deck ids counted once", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([["card-1", 5]])
    expect(countSwipeMastered(ratings, ["card-1", "card-1", "card-1"])).toBe(1)
  })

  it("result never exceeds unique deck ids", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>()
    const deckIds = ["a", "b", "c", "d", "e"]
    for (const id of deckIds) {
      ratings.set(id, 5)
    }
    const uniqueDeckIds = new Set(deckIds).size
    expect(countSwipeMastered(ratings, deckIds)).toBeLessThanOrEqual(uniqueDeckIds)
  })

  it("empty ratings returns 0", () => {
    expect(countSwipeMastered(new Map(), ["a", "b", "c"])).toBe(0)
  })

  it("empty deckIds returns 0", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([["card-1", 5]])
    expect(countSwipeMastered(ratings, [])).toBe(0)
  })

  it("lapsed card whose latest rating is Mudah is NOT counted", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 5],
      ["card-2", 5],
      ["card-3", 5]
    ])
    const lapsed = new Set<string>(["card-2"])
    expect(countSwipeMastered(ratings, ["card-1", "card-2", "card-3"], lapsed)).toBe(2)
  })

  it("without lapsed argument, behavior is unchanged", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([["card-1", 5]])
    expect(countSwipeMastered(ratings, ["card-1"])).toBe(1)
  })

  it("lapsed card with latest 0 is excluded, other Mudah still counted", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 0],
      ["card-2", 5]
    ])
    const lapsed = new Set<string>(["card-1"])
    expect(countSwipeMastered(ratings, ["card-1", "card-2"], lapsed)).toBe(1)
  })

  it("result never exceeds unique deck ids, even with lapsed set", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>()
    const deckIds = ["a", "b", "c", "d", "e"]
    for (const id of deckIds) {
      ratings.set(id, 5)
    }
    const lapsed = new Set<string>(["a", "b"])
    const uniqueDeckIds = new Set(deckIds).size
    expect(countSwipeMastered(ratings, deckIds, lapsed)).toBeLessThanOrEqual(uniqueDeckIds)
  })

  it("consistency: countSwipeMastered equals computeSessionStats.mudah when ids match ratings", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 5],
      ["card-2", 5],
      ["card-3", 4],
      ["card-4", 3],
      ["card-5", 0]
    ])
    const lapsed = new Set<string>(["card-2"])
    const deckIds = Array.from(ratings.keys())
    const mastered = countSwipeMastered(ratings, deckIds, lapsed)
    const stats = computeSessionStats(ratings, lapsed)
    expect(mastered).toBe(stats.mudah)
  })
})

describe("computeSessionStats", () => {
  it("empty inputs -> all zeros", () => {
    expect(computeSessionStats(new Map(), new Set())).toEqual({ mudah: 0, ingat: 0, sulit: 0, lupa: 0 })
  })

  it("Lupa then Mudah (card in lapsed, latest 5) -> counted as lupa", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 5],
      ["card-2", 5],
      ["card-3", 5]
    ])
    const lapsed = new Set(["card-2"])
    expect(computeSessionStats(ratings, lapsed)).toEqual({ mudah: 2, ingat: 0, sulit: 0, lupa: 1 })
  })

  it("Never-lapsed Mudah -> mudah", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 5],
      ["card-2", 5],
      ["card-3", 5]
    ])
    const lapsed = new Set<string>()
    expect(computeSessionStats(ratings, lapsed)).toEqual({ mudah: 3, ingat: 0, sulit: 0, lupa: 0 })
  })

  it("Ingat/Sulit unaffected when not lapsed", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 4],
      ["card-2", 3]
    ])
    const lapsed = new Set<string>()
    expect(computeSessionStats(ratings, lapsed)).toEqual({ mudah: 0, ingat: 1, sulit: 1, lupa: 0 })
  })

  it("Latest rating 0 without being in lapsed -> lupa", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 0],
      ["card-2", 5]
    ])
    const lapsed = new Set<string>()
    expect(computeSessionStats(ratings, lapsed)).toEqual({ mudah: 1, ingat: 0, sulit: 0, lupa: 1 })
  })

  it("Totals always equal ratings.size", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 5],
      ["card-2", 4],
      ["card-3", 3],
      ["card-4", 0],
      ["card-5", 5]
    ])
    const lapsed = new Set<string>(["card-3"])
    const stats = computeSessionStats(ratings, lapsed)
    const total = stats.mudah + stats.ingat + stats.sulit + stats.lupa
    expect(total).toBe(ratings.size)
  })

  it("Example: 13 Mudah + 2 Ingat + 2 Sulit + 3 lapsed (latest Mudah)", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>()
    const lapsed = new Set<string>()
    for (let i = 0; i < 13; i++) {
      ratings.set(`mudah-${i}`, 5)
    }
    for (let i = 0; i < 2; i++) {
      ratings.set(`ingat-${i}`, 4)
    }
    for (let i = 0; i < 2; i++) {
      ratings.set(`sulit-${i}`, 3)
    }
    for (let i = 0; i < 3; i++) {
      ratings.set(`lapsed-${i}`, 5)
      lapsed.add(`lapsed-${i}`)
    }
    const stats = computeSessionStats(ratings, lapsed)
    expect(stats).toEqual({ mudah: 13, ingat: 2, sulit: 2, lupa: 3 })
    expect(stats.mudah + stats.ingat + stats.sulit + stats.lupa).toBe(20)
    expect(computeSessionAccuracy(ratings, lapsed)).toBe(75)
  })
})

describe("computeSessionAccuracy", () => {
  it("empty map -> 0", () => {
    expect(computeSessionAccuracy(new Map())).toBe(0)
  })

  it("3 of 4 passing -> 75", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 5],
      ["card-2", 4],
      ["card-3", 4],
      ["card-4", 0]
    ])
    expect(computeSessionAccuracy(ratings)).toBe(75)
  })

  it("all Lupa -> 0", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 0],
      ["card-2", 0],
      ["card-3", 0]
    ])
    expect(computeSessionAccuracy(ratings, new Set<string>())).toBe(0)
  })

  it("all Mudah -> 100", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 5],
      ["card-2", 5],
      ["card-3", 5]
    ])
    expect(computeSessionAccuracy(ratings, new Set<string>())).toBe(100)
  })

  it("all Ingat -> 100", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 4],
      ["card-2", 4],
      ["card-3", 4]
    ])
    expect(computeSessionAccuracy(ratings, new Set<string>())).toBe(100)
  })

  it("mixed ratings -> correct percentage", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 5],
      ["card-2", 4],
      ["card-3", 3],
      ["card-4", 0],
      ["card-5", 5]
    ])
    expect(computeSessionAccuracy(ratings)).toBe(60)
  })

  it("with lapsed: lapsed-then-Mudah counts as lupa, not mudah", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 5],
      ["card-2", 5],
      ["card-3", 5]
    ])
    const lapsed = new Set<string>(["card-2"])
    expect(computeSessionAccuracy(ratings, lapsed)).toBe(67)
  })

  it("with lapsed: never-lapsed Mudah counts as mudah", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 5],
      ["card-2", 5],
      ["card-3", 5]
    ])
    const lapsed = new Set<string>()
    expect(computeSessionAccuracy(ratings, lapsed)).toBe(100)
  })

  it("with lapsed: Ingat/Sulit unaffected when not lapsed", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 4],
      ["card-2", 3]
    ])
    const lapsed = new Set<string>()
    expect(computeSessionAccuracy(ratings, lapsed)).toBe(50)
  })

  it("with lapsed: latest rating 0 without being in lapsed -> lupa", () => {
    const ratings = new Map<string, 0 | 3 | 4 | 5>([
      ["card-1", 0],
      ["card-2", 5]
    ])
    const lapsed = new Set<string>()
    expect(computeSessionAccuracy(ratings, lapsed)).toBe(50)
  })
})

describe("isCardDue", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("new card (no next_review) is due", () => {
    vi.setSystemTime(new Date("2026-10-03T12:00:00+07:00"))
    expect(isCardDue(null)).toBe(true)
    expect(isCardDue(undefined)).toBe(true)
  })

  it("card due today is due", () => {
    vi.setSystemTime(new Date("2026-10-03T12:00:00+07:00"))
    expect(isCardDue("2026-10-03")).toBe(true)
  })

  it("overdue card is due", () => {
    vi.setSystemTime(new Date("2026-10-03T12:00:00+07:00"))
    expect(isCardDue("2026-10-01")).toBe(true)
    expect(isCardDue("2026-09-30")).toBe(true)
  })

  it("card due tomorrow is not due", () => {
    vi.setSystemTime(new Date("2026-10-03T12:00:00+07:00"))
    expect(isCardDue("2026-10-04")).toBe(false)
    expect(isCardDue("2026-10-10")).toBe(false)
  })

  it("timezone edge case at 23:30 +07:00", () => {
    vi.setSystemTime(new Date("2026-10-03T23:30:00+07:00"))
    expect(isCardDue("2026-10-03")).toBe(true)
    expect(isCardDue("2026-10-04")).toBe(false)
  })

  it("custom today parameter", () => {
    expect(isCardDue("2026-10-03", "2026-10-03")).toBe(true)
    expect(isCardDue("2026-10-03", "2026-10-04")).toBe(true)
    expect(isCardDue("2026-10-04", "2026-10-03")).toBe(false)
  })
})

describe("recordSrsReview", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("upserts correct payload with session_id", async () => {
    vi.setSystemTime(new Date("2026-10-03T12:00:00+07:00"))
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi.fn(() => ({ upsert: upsertMock }))
    const supa = { from: fromMock } as unknown as SupabaseClient

    const review = {
      cardId: "test-card",
      quality: 5 as const,
      state: { repetitions: 0, intervalDays: 0, easeFactor: 2.5 }
    }
    const userId = "user-123"
    const sessionId = "session-456"

    await recordSrsReview(supa, userId, review, sessionId)

    expect(fromMock).toHaveBeenCalledWith("user_card_progress")
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        card_id: review.cardId,
        srs_level: 1,
        interval_days: 1,
        ease_factor: 2.6,
        next_review: "2026-10-04",
        last_reviewed: "2026-10-03",
        session_id: sessionId
      }),
      { onConflict: "user_id,card_id" }
    )
  })

  it("upserts without session_id when not provided", async () => {
    vi.setSystemTime(new Date("2026-10-03T12:00:00+07:00"))
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi.fn(() => ({ upsert: upsertMock }))
    const supa = { from: fromMock } as unknown as SupabaseClient

    const review = {
      cardId: "test-card",
      quality: 5 as const,
      state: { repetitions: 0, intervalDays: 0, easeFactor: 2.5 }
    }
    const userId = "user-123"

    await recordSrsReview(supa, userId, review)

    expect(upsertMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ session_id: expect.anything() }),
      { onConflict: "user_id,card_id" }
    )
  })

  it("throws when upsert returns error", async () => {
    vi.setSystemTime(new Date("2026-10-03T12:00:00+07:00"))
    const upsertMock = vi.fn().mockResolvedValue({ error: { message: "DB error" } })
    const fromMock = vi.fn(() => ({ upsert: upsertMock }))
    const supa = { from: fromMock } as unknown as SupabaseClient

    const review = {
      cardId: "test-card",
      quality: 5 as const,
      state: { repetitions: 0, intervalDays: 0, easeFactor: 2.5 }
    }
    const userId = "user-123"

    await expect(recordSrsReview(supa, userId, review)).rejects.toThrow()
  })
})
