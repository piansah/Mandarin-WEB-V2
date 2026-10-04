import { describe, expect, it } from "vitest"
import {
  isHanChar,
  extractFirstHan,
  getPartner,
  isMultiChar,
  rankWords,
  mergeWords,
  rankExamples,
  mergeExamples,
  highlightSegments,
  layoutChildren,
  buildEdgeLabelTransform,
  type VocabularyWord,
  type ExampleSentence,
  type GraphNode,
} from "@/lib/hanzi-map"

describe("isHanChar", () => {
  it("returns true for Han character", () => {
    expect(isHanChar("学")).toBe(true)
  })

  it("returns true for string containing Han character", () => {
    expect(isHanChar("学生")).toBe(true)
  })

  it("returns false for latin characters", () => {
    expect(isHanChar("abc")).toBe(false)
  })

  it("returns false for digits", () => {
    expect(isHanChar("123")).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(isHanChar("")).toBe(false)
  })

  it("returns true for surrogate-pair Han character", () => {
    expect(isHanChar("𠮷")).toBe(true)
  })
})

describe("extractFirstHan", () => {
  it("returns first Han character", () => {
    expect(extractFirstHan("学")).toBe("学")
  })

  it("returns first Han from multiple characters", () => {
    expect(extractFirstHan("学生")).toBe("学")
  })

  it("returns first Han from mixed string", () => {
    expect(extractFirstHan("abc学")).toBe("学")
  })

  it("returns null for latin characters", () => {
    expect(extractFirstHan("abc")).toBe(null)
  })

  it("returns null for digits", () => {
    expect(extractFirstHan("123")).toBe(null)
  })

  it("returns null for empty string", () => {
    expect(extractFirstHan("")).toBe(null)
  })

  it("returns null for surrogate-pair Han character (should still work)", () => {
    expect(extractFirstHan("𠮷")).toBe("𠮷")
  })
})

describe("getPartner", () => {
  it("returns partner for 2-char word", () => {
    expect(getPartner("学生", "学")).toBe("生")
  })

  it("returns partner for 2-char word (reverse)", () => {
    expect(getPartner("学生", "生")).toBe("学")
  })

  it("returns null for 1-char word", () => {
    expect(getPartner("学", "学")).toBe(null)
  })

  it("returns null for 3+ char word", () => {
    expect(getPartner("大学生", "学")).toBe(null)
  })

  it("returns null for repeated char word", () => {
    expect(getPartner("学学", "学")).toBe(null)
  })

  it("returns null when center not in word", () => {
    expect(getPartner("学生", "人")).toBe(null)
  })
})

describe("isMultiChar", () => {
  it("returns true for 2 Han characters", () => {
    expect(isMultiChar("学生")).toBe(true)
  })

  it("returns true for 3+ Han characters", () => {
    expect(isMultiChar("大学生")).toBe(true)
  })

  it("returns false for 1 Han character", () => {
    expect(isMultiChar("学")).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(isMultiChar("")).toBe(false)
  })

  it("returns false for latin characters", () => {
    expect(isMultiChar("abc")).toBe(false)
  })
})

describe("rankWords", () => {
  it("flashcard words before compound", () => {
    const words: VocabularyWord[] = [
      { id: 1, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "compound" },
      { id: 2, hanzi: "同学", pinyin: "tóngxué", arti: "teman", source: "flashcard" },
    ]
    const ranked = rankWords(words)
    expect(ranked[0].source).toBe("flashcard")
    expect(ranked[1].source).toBe("compound")
  })

  it("2-char words before longer", () => {
    const words: VocabularyWord[] = [
      { id: 1, hanzi: "大学生", pinyin: "dàxuéshēng", arti: "mahasiswa", source: "flashcard" },
      { id: 2, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "flashcard" },
    ]
    const ranked = rankWords(words)
    expect(ranked[0].hanzi).toBe("学生")
    expect(ranked[1].hanzi).toBe("大学生")
  })

  it("higher frequency first", () => {
    const words: VocabularyWord[] = [
      { id: 1, hanzi: "同学", pinyin: "tóngxué", arti: "teman", source: "flashcard", frequency: 100 },
      { id: 2, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "flashcard", frequency: 200 },
    ]
    const ranked = rankWords(words)
    expect(ranked[0].hanzi).toBe("学生")
    expect(ranked[1].hanzi).toBe("同学")
  })

  it("null frequency treated as 0", () => {
    const words: VocabularyWord[] = [
      { id: 1, hanzi: "同学", pinyin: "tóngxué", arti: "teman", source: "flashcard", frequency: null },
      { id: 2, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "flashcard", frequency: 100 },
    ]
    const ranked = rankWords(words)
    expect(ranked[0].hanzi).toBe("学生")
    expect(ranked[1].hanzi).toBe("同学")
  })

  it("stable tie-break by hanzi (localeCompare)", () => {
    const words: VocabularyWord[] = [
      { id: 1, hanzi: "同学", pinyin: "tóngxué", arti: "teman", source: "flashcard" },
      { id: 2, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "flashcard" },
    ]
    const ranked = rankWords(words)
    // localeCompare sorts Chinese characters by Unicode code point and locale rules
    expect(ranked[0].hanzi).toBe("同学")
    expect(ranked[1].hanzi).toBe("学生")
  })
})

describe("mergeWords", () => {
  it("dedupes by hanzi, flashcard wins", () => {
    const flashcard: VocabularyWord[] = [
      { id: 1, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "flashcard" },
    ]
    const compound: VocabularyWord[] = [
      { id: 2, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "compound" },
    ]
    const merged = mergeWords(flashcard, compound, 8, "学")
    expect(merged).toHaveLength(1)
    expect(merged[0].source).toBe("flashcard")
  })

  it("compounds fill remaining slots", () => {
    const flashcard: VocabularyWord[] = [
      { id: 1, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "flashcard" },
    ]
    const compound: VocabularyWord[] = [
      { id: 2, hanzi: "同学", pinyin: "tóngxué", arti: "teman", source: "compound" },
      { id: 3, hanzi: "大学", pinyin: "dàxué", arti: "universitas", source: "compound" },
    ]
    const merged = mergeWords(flashcard, compound, 3, "学")
    expect(merged).toHaveLength(3)
    expect(merged[0].source).toBe("flashcard")
    expect(merged[1].source).toBe("compound")
    expect(merged[2].source).toBe("compound")
  })

  it("flashcards-only when >= limit", () => {
    const flashcard: VocabularyWord[] = [
      { id: 1, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "flashcard" },
      { id: 2, hanzi: "同学", pinyin: "tóngxué", arti: "teman", source: "flashcard" },
      { id: 3, hanzi: "大学", pinyin: "dàxué", arti: "universitas", source: "flashcard" },
      { id: 4, hanzi: "中学", pinyin: "zhōngxué", arti: "SMP", source: "flashcard" },
      { id: 5, hanzi: "小学", pinyin: "xiǎoxué", arti: "SD", source: "flashcard" },
      { id: 6, hanzi: "上学", pinyin: "shàngxué", arti: "sekolah", source: "flashcard" },
      { id: 7, hanzi: "放学", pinyin: "fàngxué", arti: "pulang sekolah", source: "flashcard" },
      { id: 8, hanzi: "学校", pinyin: "xuéxiào", arti: "sekolah", source: "flashcard" },
    ]
    const compound: VocabularyWord[] = [
      { id: 9, hanzi: "同学", pinyin: "tóngxué", arti: "teman", source: "compound" },
    ]
    const merged = mergeWords(flashcard, compound, 8, "学")
    expect(merged).toHaveLength(8)
    expect(merged.every(w => w.source === "flashcard")).toBe(true)
  })

  it("compounds-only when flashcards empty", () => {
    const flashcard: VocabularyWord[] = []
    const compound: VocabularyWord[] = [
      { id: 1, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "compound" },
      { id: 2, hanzi: "同学", pinyin: "tóngxué", arti: "teman", source: "compound" },
    ]
    const merged = mergeWords(flashcard, compound, 8, "学")
    expect(merged).toHaveLength(2)
    expect(merged.every(w => w.source === "compound")).toBe(true)
  })

  it("excludes words equal to center char", () => {
    const flashcard: VocabularyWord[] = [
      { id: 1, hanzi: "学", pinyin: "xué", arti: "belajar", source: "flashcard" },
      { id: 2, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "flashcard" },
    ]
    const merged = mergeWords(flashcard, [], 8, "学")
    expect(merged).toHaveLength(1)
    expect(merged[0].hanzi).toBe("学生")
  })

  it("excludes words not containing center char", () => {
    const flashcard: VocabularyWord[] = [
      { id: 1, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "flashcard" },
      { id: 2, hanzi: "人", pinyin: "rén", arti: "orang", source: "flashcard" },
    ]
    const merged = mergeWords(flashcard, [], 8, "学")
    expect(merged).toHaveLength(1)
    expect(merged[0].hanzi).toBe("学生")
  })

  it("excludes 1-char words", () => {
    const flashcard: VocabularyWord[] = [
      { id: 1, hanzi: "学", pinyin: "xué", arti: "belajar", source: "flashcard" },
      { id: 2, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "flashcard" },
    ]
    const merged = mergeWords(flashcard, [], 8, "学")
    expect(merged).toHaveLength(1)
    expect(merged[0].hanzi).toBe("学生")
  })
})

describe("rankExamples", () => {
  it("longer items first", () => {
    const examples: ExampleSentence[] = [
      { id: 1, hanzi: "学", pinyin: "xué", arti: "belajar", source: "hanzi_items" },
      { id: 2, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "hanzi_items" },
    ]
    const ranked = rankExamples(examples)
    expect(ranked[0].hanzi).toBe("学生")
    expect(ranked[1].hanzi).toBe("学")
  })

  it("hanzi_items first", () => {
    const examples: ExampleSentence[] = [
      { id: 1, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "word_examples" },
      { id: 2, hanzi: "同学", pinyin: "tóngxué", arti: "teman", source: "hanzi_items" },
    ]
    const ranked = rankExamples(examples)
    expect(ranked[0].source).toBe("hanzi_items")
    expect(ranked[1].source).toBe("word_examples")
  })

  it("stable tie-break by id", () => {
    const examples: ExampleSentence[] = [
      { id: 2, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "hanzi_items" },
      { id: 1, hanzi: "同学", pinyin: "tóngxué", arti: "teman", source: "hanzi_items" },
    ]
    const ranked = rankExamples(examples)
    expect(ranked[0].id).toBe(1)
    expect(ranked[1].id).toBe(2)
  })
})

describe("mergeExamples", () => {
  it("dedupes by exact hanzi, hanzi_items wins", () => {
    const hanziItems: ExampleSentence[] = [
      { id: 1, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "hanzi_items" },
    ]
    const wordExamples: ExampleSentence[] = [
      { id: 2, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "word_examples" },
    ]
    const merged = mergeExamples(hanziItems, wordExamples, 8, "学")
    expect(merged).toHaveLength(1)
    expect(merged[0].source).toBe("hanzi_items")
  })

  it("word_examples only fill remaining slots", () => {
    const hanziItems: ExampleSentence[] = [
      { id: 1, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "hanzi_items" },
    ]
    const wordExamples: ExampleSentence[] = [
      { id: 2, hanzi: "同学", pinyin: "tóngxué", arti: "teman", source: "word_examples" },
      { id: 3, hanzi: "大学", pinyin: "dàxué", arti: "universitas", source: "word_examples" },
    ]
    const merged = mergeExamples(hanziItems, wordExamples, 3, "学")
    expect(merged).toHaveLength(3)
    expect(merged[0].source).toBe("hanzi_items")
    expect(merged[1].source).toBe("word_examples")
    expect(merged[2].source).toBe("word_examples")
  })

  it("excludes items equal to bare word from hanzi_items", () => {
    const hanziItems: ExampleSentence[] = [
      { id: 1, hanzi: "学", pinyin: "xué", arti: "belajar", source: "hanzi_items" },
      { id: 2, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "hanzi_items" },
    ]
    const merged = mergeExamples(hanziItems, [], 8, "学")
    expect(merged).toHaveLength(1)
    expect(merged[0].hanzi).toBe("学生")
  })

  it("excludes empty hanzi", () => {
    const hanziItems: ExampleSentence[] = [
      { id: 1, hanzi: "", pinyin: "", arti: "", source: "hanzi_items" },
      { id: 2, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "hanzi_items" },
    ]
    const merged = mergeExamples(hanziItems, [], 8, "学")
    expect(merged).toHaveLength(1)
    expect(merged[0].hanzi).toBe("学生")
  })

  it("allows null pinyin and arti", () => {
    const wordExamples: ExampleSentence[] = [
      { id: 1, hanzi: "学生", pinyin: null, arti: null, source: "word_examples" },
    ]
    const merged = mergeExamples([], wordExamples, 8, "学")
    expect(merged).toHaveLength(1)
    expect(merged[0].pinyin).toBe(null)
    expect(merged[0].arti).toBe(null)
  })

  it("word_examples-only when hanzi_items empty", () => {
    const hanziItems: ExampleSentence[] = []
    const wordExamples: ExampleSentence[] = [
      { id: 1, hanzi: "学生", pinyin: "xuéshēng", arti: "siswa", source: "word_examples" },
    ]
    const merged = mergeExamples(hanziItems, wordExamples, 8, "学")
    expect(merged).toHaveLength(1)
    expect(merged[0].source).toBe("word_examples")
  })

  it("max limit respected", () => {
    const hanziItems: ExampleSentence[] = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      hanzi: `词${i}`,
      pinyin: "pinyin",
      arti: "arti",
      source: "hanzi_items" as const,
    }))
    const merged = mergeExamples(hanziItems, [], 8, "学")
    expect(merged).toHaveLength(8)
  })
})

describe("highlightSegments", () => {
  it("highlights word at start", () => {
    const segments = highlightSegments("学生很好", "学生")
    expect(segments).toEqual([
      { text: "学生", isMatch: true },
      { text: "很好", isMatch: false },
    ])
  })

  it("highlights word in middle", () => {
    const segments = highlightSegments("我是学生", "学生")
    expect(segments).toEqual([
      { text: "我是", isMatch: false },
      { text: "学生", isMatch: true },
    ])
  })

  it("highlights word at end", () => {
    const segments = highlightSegments("这个学生", "学生")
    expect(segments).toEqual([
      { text: "这个", isMatch: false },
      { text: "学生", isMatch: true },
    ])
  })

  it("highlights multiple occurrences", () => {
    const segments = highlightSegments("学生好学生", "学生")
    expect(segments).toEqual([
      { text: "学生", isMatch: true },
      { text: "好", isMatch: false },
      { text: "学生", isMatch: true },
    ])
  })

  it("no match returns single segment", () => {
    const segments = highlightSegments("你好", "学生")
    expect(segments).toEqual([{ text: "你好", isMatch: false }])
  })

  it("empty word returns single segment", () => {
    const segments = highlightSegments("你好", "")
    expect(segments).toEqual([{ text: "你好", isMatch: false }])
  })

  it("empty text returns single segment", () => {
    const segments = highlightSegments("", "学生")
    expect(segments).toEqual([{ text: "", isMatch: false }])
  })

  it("handles surrogate-pair characters", () => {
    const segments = highlightSegments("𠮷字", "𠮷")
    expect(segments).toEqual([
      { text: "𠮷", isMatch: true },
      { text: "字", isMatch: false },
    ])
  })

  it("handles regex special characters safely", () => {
    const segments = highlightSegments("学生.*", "学生")
    expect(segments).toEqual([
      { text: "学生", isMatch: true },
      { text: ".*", isMatch: false },
    ])
  })
})

describe("layoutChildren", () => {
  it("positions n=1 node at parent angle", () => {
    const parent: GraphNode = {
      id: "root",
      hanzi: "学",
      depth: 0,
      x: 0,
      y: 0,
      parentId: null,
      isLeaf: false,
      isExpanded: false,
      isExhausted: false,
      isLoading: false,
    }
    const existing = new Map<string, GraphNode>([["root", parent]])
    const result = layoutChildren(parent, ["生"], 0, existing)
    const child = result.get("生")
    expect(child).toBeDefined()
    expect(child?.x).toBeGreaterThan(0)
    expect(child?.y).toBe(0)
  })

  it("positions n=8 nodes evenly spread", () => {
    const parent: GraphNode = {
      id: "root",
      hanzi: "学",
      depth: 0,
      x: 0,
      y: 0,
      parentId: null,
      isLeaf: false,
      isExpanded: false,
      isExhausted: false,
      isLoading: false,
    }
    const existing = new Map<string, GraphNode>([["root", parent]])
    const children = ["生", "同", "大", "小", "中", "上", "校", "习"]
    const result = layoutChildren(parent, children, 0, existing)
    expect(result.size).toBe(9) // root + 8 children
  })

  it("does not move existing nodes", () => {
    const parent: GraphNode = {
      id: "root",
      hanzi: "学",
      depth: 0,
      x: 0,
      y: 0,
      parentId: null,
      isLeaf: false,
      isExpanded: false,
      isExhausted: false,
      isLoading: false,
    }
    const existingChild: GraphNode = {
      id: "生",
      hanzi: "生",
      depth: 1,
      x: 100,
      y: 0,
      parentId: "root",
      isLeaf: false,
      isExpanded: false,
      isExhausted: false,
      isLoading: false,
    }
    const existing = new Map<string, GraphNode>([["root", parent], ["生", existingChild]])
    const result = layoutChildren(parent, ["生", "同"], 0, existing)
    const child = result.get("生")
    expect(child?.x).toBe(100)
    expect(child?.y).toBe(0)
  })

  it("deterministic positions", () => {
    const parent: GraphNode = {
      id: "root",
      hanzi: "学",
      depth: 0,
      x: 0,
      y: 0,
      parentId: null,
      isLeaf: false,
      isExpanded: false,
      isExhausted: false,
      isLoading: false,
    }
    const existing = new Map<string, GraphNode>([["root", parent]])
    const children = ["生", "同"]
    const result1 = layoutChildren(parent, children, 0, existing)
    const result2 = layoutChildren(parent, children, 0, existing)
    expect(result1.get("生")?.x).toBe(result2.get("生")?.x)
    expect(result1.get("生")?.y).toBe(result2.get("生")?.y)
  })

  it("radius increases with depth", () => {
    const parent: GraphNode = {
      id: "root",
      hanzi: "学",
      depth: 0,
      x: 0,
      y: 0,
      parentId: null,
      isLeaf: false,
      isExpanded: false,
      isExhausted: false,
      isLoading: false,
    }
    const existing = new Map<string, GraphNode>([["root", parent]])
    const result1 = layoutChildren(parent, ["生"], 0, existing)
    const result2 = layoutChildren(parent, ["同"], 1, existing)
    const distance1 = Math.sqrt((result1.get("生")?.x || 0) ** 2 + (result1.get("生")?.y || 0) ** 2)
    const distance2 = Math.sqrt((result2.get("同")?.x || 0) ** 2 + (result2.get("同")?.y || 0) ** 2)
    expect(distance2).toBeGreaterThan(distance1)
  })
})

describe("buildEdgeLabelTransform", () => {
  it("calculates midpoint", () => {
    const result = buildEdgeLabelTransform(0, 0, 100, 0)
    expect(result.x).toBe(50)
    expect(result.y).toBe(0)
  })

  it("calculates rotation for horizontal line", () => {
    const result = buildEdgeLabelTransform(0, 0, 100, 0)
    expect(result.rotation).toBe(0)
  })

  it("calculates rotation for vertical line", () => {
    const result = buildEdgeLabelTransform(0, 0, 0, 100)
    expect(result.rotation).toBe(90)
  })

  it("never upside down (> 90)", () => {
    const result = buildEdgeLabelTransform(0, 0, -100, 0)
    expect(result.rotation).toBe(180 - 180) // Should be adjusted to not be upside down
    expect(Math.abs(result.rotation)).toBeLessThanOrEqual(90)
  })

  it("never upside down (< -90)", () => {
    const result = buildEdgeLabelTransform(0, 0, -100, -100)
    expect(Math.abs(result.rotation)).toBeLessThanOrEqual(90)
  })
})
