import { describe, it, expect } from "vitest"
import { countSaved } from "@/lib/srs"

describe("countSaved", () => {
  it("counts ids only in dbSavedIds", () => {
    const fullDeckIds = ["1", "2", "3"]
    const dbSavedIds = new Set<string>(["1", "2"])
    const reviews: { cardId: string }[] = []
    expect(countSaved(fullDeckIds, dbSavedIds, reviews)).toBe(2)
  })

  it("counts ids only in reviews", () => {
    const fullDeckIds = ["1", "2", "3"]
    const dbSavedIds = new Set<string>()
    const reviews: { cardId: string }[] = [{ cardId: "1" }, { cardId: "2" }]
    expect(countSaved(fullDeckIds, dbSavedIds, reviews)).toBe(2)
  })

  it("counts an id in both dbSavedIds and reviews only once", () => {
    const fullDeckIds = ["1", "2", "3"]
    const dbSavedIds = new Set<string>(["1", "2"])
    const reviews: { cardId: string }[] = [{ cardId: "1" }]
    expect(countSaved(fullDeckIds, dbSavedIds, reviews)).toBe(2)
  })

  it("ignores ids outside fullDeckIds (extra db ids)", () => {
    const fullDeckIds = ["1", "2", "3"]
    const dbSavedIds = new Set<string>(["1", "2", "4", "5"])
    const reviews: { cardId: string }[] = []
    expect(countSaved(fullDeckIds, dbSavedIds, reviews)).toBe(2)
  })

  it("ignores ids outside fullDeckIds (extra review ids)", () => {
    const fullDeckIds = ["1", "2", "3"]
    const dbSavedIds = new Set<string>()
    const reviews: { cardId: string }[] = [{ cardId: "1" }, { cardId: "4" }, { cardId: "5" }]
    expect(countSaved(fullDeckIds, dbSavedIds, reviews)).toBe(1)
  })

  it("returns 0 for empty fullDeckIds", () => {
    const fullDeckIds: string[] = []
    const dbSavedIds = new Set<string>(["1", "2"])
    const reviews: { cardId: string }[] = [{ cardId: "1" }]
    expect(countSaved(fullDeckIds, dbSavedIds, reviews)).toBe(0)
  })

  it("counts duplicated ids in fullDeckIds only once", () => {
    const fullDeckIds = ["1", "1", "2", "2", "3"]
    const dbSavedIds = new Set<string>(["1", "2", "3"])
    const reviews: { cardId: string }[] = []
    expect(countSaved(fullDeckIds, dbSavedIds, reviews)).toBe(3)
  })

  it("full deck of 21 with 21 saved returns 21", () => {
    const fullDeckIds = Array.from({ length: 21 }, (_, i) => String(i + 1))
    const dbSavedIds = new Set<string>(fullDeckIds)
    const reviews: { cardId: string }[] = []
    expect(countSaved(fullDeckIds, dbSavedIds, reviews)).toBe(21)
  })

  it("after reset (empty sets, no reviews) returns 0", () => {
    const fullDeckIds = Array.from({ length: 21 }, (_, i) => String(i + 1))
    const dbSavedIds = new Set<string>()
    const reviews: { cardId: string }[] = []
    expect(countSaved(fullDeckIds, dbSavedIds, reviews)).toBe(0)
  })

  it("never exceeds fullDeckIds.length", () => {
    const fullDeckIds = ["1", "2", "3"]
    const dbSavedIds = new Set<string>(["1", "2", "3", "4", "5"])
    const reviews: { cardId: string }[] = [{ cardId: "1" }, { cardId: "6" }]
    expect(countSaved(fullDeckIds, dbSavedIds, reviews)).toBe(3)
  })
})
