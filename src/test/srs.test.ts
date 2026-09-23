/**
 * Test untuk logika SRS (Spaced Repetition System)
 * Menguji computeSrsUpdate dan previewIntervalDays dari src/lib/srs.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { computeSrsUpdate, previewIntervalDays } from "@/lib/srs"

// Freeze tanggal agar test deterministik
const FIXED_DATE = new Date("2024-01-15T10:00:00.000Z")

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_DATE)
})

afterEach(() => {
  vi.useRealTimers()
})

function addDaysToFixed(n: number): string {
  const d = new Date(FIXED_DATE)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

describe("computeSrsUpdate", () => {
  describe("quality = 0 (Lupa)", () => {
    it("harus reset srs_level ke 0 dan next_review besok", () => {
      const result = computeSrsUpdate(5, 0)
      expect(result.srs_level).toBe(0)
      expect(result.next_review).toBe(addDaysToFixed(1))
    })

    it("tetap reset ke 0 meskipun level sudah tinggi", () => {
      const result = computeSrsUpdate(9, 0)
      expect(result.srs_level).toBe(0)
    })

    it("tetap reset ke 0 meskipun level 0", () => {
      const result = computeSrsUpdate(0, 0)
      expect(result.srs_level).toBe(0)
      expect(result.next_review).toBe(addDaysToFixed(1))
    })
  })

  describe("quality = 3 (Sulit/Ragu)", () => {
    it("harus mempertahankan srs_level yang ada", () => {
      const result = computeSrsUpdate(3, 3)
      expect(result.srs_level).toBe(3)
      expect(result.next_review).toBe(addDaysToFixed(1))
    })

    it("tidak boleh turun level", () => {
      const result = computeSrsUpdate(5, 3)
      expect(result.srs_level).toBe(5)
    })

    it("mempertahankan level 0", () => {
      const result = computeSrsUpdate(0, 3)
      expect(result.srs_level).toBe(0)
      expect(result.next_review).toBe(addDaysToFixed(1))
    })
  })

  describe("quality = 4 (Ingat/Normal)", () => {
    it("mempertahankan level dan review sesuai interval saat ini", () => {
      const result = computeSrsUpdate(2, 4)
      expect(result.srs_level).toBe(2)
      expect(result.next_review).toBe(addDaysToFixed(2))
    })

    it("level 0 tetap level 0, review 1 hari", () => {
      const result = computeSrsUpdate(0, 4)
      expect(result.srs_level).toBe(0)
      expect(result.next_review).toBe(addDaysToFixed(1))
    })
  })

  describe("quality = 5 (Hafal/Mudah)", () => {
    it("harus naik 1 level", () => {
      const result = computeSrsUpdate(2, 5)
      expect(result.srs_level).toBe(3)
      expect(result.next_review).toBe(addDaysToFixed(4))
    })

    it("dari level 0 naik ke level 1", () => {
      const result = computeSrsUpdate(0, 5)
      expect(result.srs_level).toBe(1)
      expect(result.next_review).toBe(addDaysToFixed(1))
    })

    it("tidak melebihi INTERVALS.length - 1", () => {
      const result = computeSrsUpdate(9, 5)
      expect(result.srs_level).toBe(9)
    })
  })
})

describe("previewIntervalDays", () => {
  it("quality 0 selalu 1 hari", () => {
    expect(previewIntervalDays(0, 0)).toBe(1)
    expect(previewIntervalDays(5, 0)).toBe(1)
    expect(previewIntervalDays(9, 0)).toBe(1)
  })

  it("quality 3 selalu 1 hari", () => {
    expect(previewIntervalDays(0, 3)).toBe(1)
    expect(previewIntervalDays(5, 3)).toBe(1)
  })

  it("quality 4 menggunakan interval level saat ini", () => {
    expect(previewIntervalDays(0, 4)).toBe(1)
    expect(previewIntervalDays(2, 4)).toBe(2)
    expect(previewIntervalDays(4, 4)).toBe(7)
  })

  it("quality 5 menggunakan interval level berikutnya", () => {
    expect(previewIntervalDays(0, 5)).toBe(1)
    expect(previewIntervalDays(2, 5)).toBe(4)
    expect(previewIntervalDays(4, 5)).toBe(15)
  })

  it("tidak boleh crash di level negatif", () => {
    expect(() => previewIntervalDays(-1, 5)).not.toThrow()
    expect(() => previewIntervalDays(-5, 0)).not.toThrow()
  })
})
