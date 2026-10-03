import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { 
  computeNextSrsState, 
  previewIntervalDays, 
  computeSrsUpdate, 
  DEFAULT_EASE_FACTOR, 
  MIN_EASE_FACTOR,
  toLocalDateStr,
  todayStr,
  isMastered,
  countMastered,
  SrsState
} from "@/lib/srs"

describe("SM-2 SRS Algorithm", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Midnight WIB
    vi.setSystemTime(new Date("2026-10-03T00:00:00+07:00"))
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
    const state = { repetitions: 2, intervalDays: 6, easeFactor: 2.5 }
    
    // Test for a passing grade, should add intervalDays (15 days for q=4)
    const update = computeSrsUpdate(state, 4)
    
    // In local time (+07:00), 2026-10-03 + 15 days is 2026-10-18
    expect(update.next_review).toBe("2026-10-18")
  })
})

describe("Mastered Counting", () => {
  it("isMastered returns true for >= 21, false otherwise", () => {
    expect(isMastered(20)).toBe(false)
    expect(isMastered(21)).toBe(true)
    expect(isMastered(30)).toBe(true)
    expect(isMastered(0)).toBe(false)
    expect(isMastered(null)).toBe(false)
    expect(isMastered(undefined)).toBe(false)
  })

  it("countMastered correctly evaluates based on reviews and DB", () => {
    const dbIntervals = new Map<string, number>([
      ["a", 30],
      ["b", 5],
      ["c", 21]
    ])
    
    // DB intervals {a:30, b:5, c:21}, no reviews, deckIds = [a,b,c] -> 2
    expect(countMastered(["a", "b", "c"], dbIntervals, [])).toBe(2)
    
    // Empty deckIds -> 0
    expect(countMastered([], dbIntervals, [])).toBe(0)

    // DB intervals present but not in deckIds are not counted
    expect(countMastered(["b"], dbIntervals, [])).toBe(0)
    
    // Duplicated ids in deckIds are counted once
    expect(countMastered(["a", "a", "c"], dbIntervals, [])).toBe(2)

    // Review with quality: 5 makes a non-mastered DB card count as mastered
    const reviews1: { cardId: string; quality: 0 | 3 | 4 | 5; state: SrsState }[] = [
      { cardId: "b", quality: 5, state: { repetitions: 2, intervalDays: 6, easeFactor: 2.5 } } // computeSrsUpdate will give interval 15 (not mastered yet)
    ]
    // Wait, interval 6 * 2.5 = 15. That is < 21. Let's make it bigger.
    const reviews2: { cardId: string; quality: 0 | 3 | 4 | 5; state: SrsState }[] = [
      { cardId: "b", quality: 5, state: { repetitions: 3, intervalDays: 15, easeFactor: 2.5 } } // computeSrsUpdate gives 15 * 2.5 = 38 >= 21
    ]
    expect(countMastered(["a", "b", "c"], dbIntervals, reviews2)).toBe(3)

    // Review with quality: 0 makes a DB-mastered card count as NOT mastered
    const reviews3: { cardId: string; quality: 0 | 3 | 4 | 5; state: SrsState }[] = [
      { cardId: "a", quality: 0, state: { repetitions: 5, intervalDays: 30, easeFactor: 2.5 } } // Lupa -> 1
    ]
    expect(countMastered(["a", "b", "c"], dbIntervals, reviews3)).toBe(1) // only 'c' remains mastered

    // Two reviews for the same cardId: only the last one counts
    const reviews4: { cardId: string; quality: 0 | 3 | 4 | 5; state: SrsState }[] = [
      { cardId: "b", quality: 5, state: { repetitions: 3, intervalDays: 15, easeFactor: 2.5 } }, // would be mastered
      { cardId: "b", quality: 0, state: { repetitions: 4, intervalDays: 38, easeFactor: 2.6 } }  // then failed
    ]
    expect(countMastered(["a", "b", "c"], dbIntervals, reviews4)).toBe(2) // 'a' and 'c' are mastered from DB, 'b' failed
  })
})
