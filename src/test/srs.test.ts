import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { 
  computeNextSrsState, 
  previewIntervalDays, 
  computeSrsUpdate, 
  DEFAULT_EASE_FACTOR, 
  MIN_EASE_FACTOR,
  toLocalDateStr,
  todayStr
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
