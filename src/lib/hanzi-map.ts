// lib/hanzi-map.ts
// Pure, typed, side-effect-free helpers for Hanzi Map feature

export type VocabularyWord = {
  id: string | number
  hanzi: string
  pinyin: string | null
  arti: string | null
  word_class?: string | null
  source: "flashcard" | "compound"
  frequency?: number | null
  /** Level HSK 1-6 jika diketahui (flashcard: dari deck; compound: dari badge) */
  hsk_level?: number | null
  /** Nilai badge mentah dari word_compounds: 'common' | 'native' */
  compound_badge?: "common" | "native" | null
}

export type ExampleSentence = {
  id: string | number
  hanzi: string
  pinyin: string | null
  arti: string | null
  source: "hanzi_items" | "word_examples"
  section_label?: string | null
  user_contribution?: boolean | null
}

export type GraphNode = {
  id: string
  hanzi: string
  depth: number
  x: number
  y: number
  parentId: string | null
  isLeaf: boolean
  isExpanded: boolean
  isExhausted: boolean
  isLoading: boolean
}

export type GraphEdge = {
  id: string
  fromId: string
  toId: string
  word: VocabularyWord
}

/**
 * Check if a string contains at least one Han character
 */
export function isHanChar(str: string): boolean {
  return /\p{Script=Han}/u.test(str)
}

/**
 * Extract the first Han character from a string
 * Returns null if no Han character is found
 */
export function extractFirstHan(str: string): string | null {
  const match = str.match(/\p{Script=Han}/u)
  return match ? match[0] : null
}

/** Kata harus diawali karakter pusat: node induk = suku kata pertama */
export function startsWithChar(word: string, center: string): boolean {
  return [...word][0] === center
}

/**
 * Get the partner character from a 2-character word.
 * Karakter pusat harus di posisi pertama: 家人 dengan pusat 家 -> 人.
 * 人家 dengan pusat 家 -> null (tidak lolos aturan awalan).
 * Kata reduplikasi (mis. 家家) tidak punya partner -> jadi leaf.
 */
export function getPartner(word: string, center: string): string | null {
  const chars = [...word]
  if (chars.length !== 2) return null
  if (chars[0] !== center) return null
  return chars[1] !== center ? chars[1] : null
}

/**
 * Check if a word is longer than 1 character (counts Han characters only)
 */
export function isMultiChar(word: string): boolean {
  return [...word].filter((c) => /\p{Script=Han}/u.test(c)).length > 1
}

/**
 * Rank vocabulary words: flashcard first, then 2-char words, then shorter, then by frequency desc, then localeCompare for stability
 */
export function rankWords(words: VocabularyWord[]): VocabularyWord[] {
  return [...words].sort((a, b) => {
    // Flashcard words first
    if (a.source !== b.source) {
      return a.source === "flashcard" ? -1 : 1
    }

    // 2-character words first
    const aLen = [...a.hanzi].length
    const bLen = [...b.hanzi].length
    if (aLen !== bLen) {
      return aLen === 2 ? -1 : bLen === 2 ? 1 : aLen - bLen
    }

    // Higher frequency first (treat null as 0)
    const aFreq = a.frequency ?? 0
    const bFreq = b.frequency ?? 0
    if (aFreq !== bFreq) {
      return bFreq - aFreq
    }

    // Alphabetical tie-break for stability
    return a.hanzi.localeCompare(b.hanzi)
  })
}

/**
 * Merge flashcard words and compound words, deduping by hanzi
 * Flashcard records win when a word exists in both sources
 * Compounds only fill remaining slots up to the limit
 * Hanya kata yang diawali karakter pusat yang diterima.
 */
export function mergeWords(
  flashcardWords: VocabularyWord[],
  compoundWords: VocabularyWord[],
  limit: number,
  centerChar: string
): VocabularyWord[] {
  const seen = new Set<string>()
  const result: VocabularyWord[] = []

  // Add flashcard words first
  for (const word of flashcardWords) {
    if (seen.has(word.hanzi)) continue
    if (!isMultiChar(word.hanzi)) continue
    if (word.hanzi === centerChar) continue
    if (!startsWithChar(word.hanzi, centerChar)) continue

    seen.add(word.hanzi)
    result.push(word)
    if (result.length >= limit) return result
  }

  // Fill remaining with compound words
  for (const word of compoundWords) {
    if (seen.has(word.hanzi)) continue
    if (!isMultiChar(word.hanzi)) continue
    if (word.hanzi === centerChar) continue
    if (!startsWithChar(word.hanzi, centerChar)) continue

    seen.add(word.hanzi)
    result.push(word)
    if (result.length >= limit) return result
  }

  return result
}

// ── HSK quota ─────────────────────────────────────────────────────

/**
 * Jatah kata per level HSK untuk satu kali ekspansi (total 8):
 * HSK 1 = 3 kata, HSK 2 sampai HSK 6 = masing-masing 1 kata.
 */
export const HSK_QUOTA: Record<number, number> = {
  1: 3,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
  6: 1,
}

/** Ambil angka level dari teks badge, mis. "HSK 3" atau "hsk3". null jika tidak ada. */
export function parseHskLevel(text: string | null | undefined): number | null {
  if (!text) return null
  const match = text.match(/HSK\s*([1-6])/i)
  return match ? Number(match[1]) : null
}

function isCandidate(word: VocabularyWord, centerChar: string): boolean {
  if (!word.hanzi) return false
  if (word.hanzi === centerChar) return false
  if (!isMultiChar(word.hanzi)) return false
  return startsWithChar(word.hanzi, centerChar)
}

function hskSortKey(word: VocabularyWord): number {
  const level = word.hsk_level
  return level != null && level >= 1 && level <= 6 ? level : 99
}

/**
 * Pilih kata untuk satu ekspansi berdasarkan jatah HSK.
 *
 * 1. Kata difilter (diawali karakter pusat, multi-karakter) dan didedupe per hanzi.
 *    Jika satu hanzi punya beberapa entri, yang punya level HSK (lebih rendah) menang.
 * 2. Tiap level mengisi jatahnya sesuai urutan `words` (kirim hasil rankWords).
 * 3. Jatah yang tidak terpenuhi diisi dari sisa kata: level HSK terendah dulu,
 *    kata tanpa level paling akhir.
 */
export function pickByHskQuota(
  words: VocabularyWord[],
  limit: number,
  centerChar: string,
  quota: Record<number, number> = HSK_QUOTA
): VocabularyWord[] {
  const byHanzi = new Map<string, VocabularyWord>()
  for (const word of words) {
    if (!isCandidate(word, centerChar)) continue
    const prev = byHanzi.get(word.hanzi)
    if (!prev || hskSortKey(word) < hskSortKey(prev)) {
      byHanzi.set(word.hanzi, word)
    }
  }

  const candidates = Array.from(byHanzi.values())
  const picked = new Set<VocabularyWord>()
  const result: VocabularyWord[] = []

  const levels = Object.keys(quota)
    .map(Number)
    .sort((a, b) => a - b)

  for (const level of levels) {
    let need = quota[level]
    for (const word of candidates) {
      if (need <= 0 || result.length >= limit) break
      if (word.hsk_level === level) {
        result.push(word)
        picked.add(word)
        need--
      }
    }
  }

  if (result.length < limit) {
    const rest = candidates
      .filter((word) => !picked.has(word))
      .sort((a, b) => hskSortKey(a) - hskSortKey(b)) // sort stabil: urutan rank terjaga
    for (const word of rest) {
      if (result.length >= limit) break
      result.push(word)
    }
  }

  return result
}

/** True jika semua jatah HSK terpenuhi dan jumlah kata mencapai `limit`. */
export function isHskQuotaMet(
  words: VocabularyWord[],
  limit: number,
  centerChar: string,
  quota: Record<number, number> = HSK_QUOTA
): boolean {
  const picked = pickByHskQuota(words, limit, centerChar, quota)
  if (picked.length < limit) return false
  return Object.entries(quota).every(([level, need]) => {
    const count = picked.filter((word) => word.hsk_level === Number(level)).length
    return count >= need
  })
}

// ── Contoh kalimat ────────────────────────────────────────────────

/**
 * Rank example sentences: longer items first, then by source (hanzi_items first)
 */
export function rankExamples(examples: ExampleSentence[]): ExampleSentence[] {
  return [...examples].sort((a, b) => {
    // Longer items first
    const aLen = [...a.hanzi].length
    const bLen = [...b.hanzi].length
    if (aLen !== bLen) return bLen - aLen

    // hanzi_items first
    if (a.source !== b.source) {
      return a.source === "hanzi_items" ? -1 : 1
    }

    // Stable tie-break by id
    return String(a.id).localeCompare(String(b.id))
  })
}

/**
 * Merge example sentences from hanzi_items and word_examples
 * hanzi_items wins on dedupe by exact hanzi
 * word_examples only fills remaining slots
 * Items equal to the bare word are excluded from hanzi_items
 */
export function mergeExamples(
  hanziItems: ExampleSentence[],
  wordExamples: ExampleSentence[],
  limit: number,
  word: string
): ExampleSentence[] {
  const seen = new Set<string>()
  const result: ExampleSentence[] = []

  // Add hanzi_items first (excluding items equal to the bare word)
  for (const item of hanziItems) {
    if (!item.hanzi) continue
    if (seen.has(item.hanzi)) continue
    if (item.hanzi === word) continue

    seen.add(item.hanzi)
    result.push(item)
    if (result.length >= limit) return result
  }

  // Fill remaining with word_examples
  for (const item of wordExamples) {
    if (!item.hanzi) continue
    if (seen.has(item.hanzi)) continue

    seen.add(item.hanzi)
    result.push(item)
    if (result.length >= limit) return result
  }

  return result
}

/**
 * Highlight segments of text where the word appears
 * Returns an array of segments: { text: string, isMatch: boolean }
 */
export function highlightSegments(
  text: string,
  word: string
): Array<{ text: string; isMatch: boolean }> {
  if (!word || !text) return [{ text, isMatch: false }]

  const segments: Array<{ text: string; isMatch: boolean }> = []
  let currentIndex = 0

  while (currentIndex < text.length) {
    const index = text.indexOf(word, currentIndex)
    if (index === -1) {
      segments.push({ text: text.slice(currentIndex), isMatch: false })
      break
    }

    if (index > currentIndex) {
      segments.push({ text: text.slice(currentIndex, index), isMatch: false })
    }

    segments.push({ text: word, isMatch: true })
    currentIndex = index + word.length
  }

  return segments
}

/**
 * Layout children nodes in a radial pattern around the parent.
 * - Root: children spread over a full 360° circle.
 * - Non-root: children fan outward (away from the grandparent), max 150°.
 * Positions are deterministic and existing nodes are never moved.
 */
export function layoutChildren(
  parent: GraphNode,
  children: string[],
  depth: number,
  existingNodes: Map<string, GraphNode>
): Map<string, GraphNode> {
  const result = new Map(existingNodes)
  const n = children.length
  if (n === 0) return result

  const baseRadius = 200
  const radiusIncrement = 140
  const radius = baseRadius + depth * radiusIncrement

  const isRoot = parent.parentId === null

  // Outward direction of the parent (only meaningful for non-root)
  let parentAngle = 0
  if (!isRoot) {
    const grandparent = result.get(parent.parentId as string)
    if (grandparent) {
      parentAngle = Math.atan2(parent.y - grandparent.y, parent.x - grandparent.x)
    }
  }

  let startAngle: number
  let angleStep: number

  if (isRoot) {
    // Full circle
    startAngle = 0
    angleStep = (2 * Math.PI) / n
  } else {
    // Outward fan, max 150°
    const spread = (Math.min(150, 35 * n) * Math.PI) / 180
    startAngle = parentAngle - spread / 2
    angleStep = n > 1 ? spread / (n - 1) : 0
  }

  children.forEach((childId, index) => {
    const existing = result.get(childId)
    // Only position if node doesn't exist OR still at origin (not yet positioned)
    if (!existing || (existing.x === 0 && existing.y === 0)) {
      const angle = n === 1 && !isRoot ? parentAngle : startAngle + index * angleStep

      result.set(childId, {
        id: childId,
        hanzi: existing?.hanzi || childId,
        depth: depth + 1,
        x: parent.x + radius * Math.cos(angle),
        y: parent.y + radius * Math.sin(angle),
        parentId: parent.id,
        isLeaf: existing?.isLeaf || false,
        isExpanded: existing?.isExpanded || false,
        isExhausted: existing?.isExhausted || false,
        isLoading: existing?.isLoading || false,
      })
    }
  })

  return result
}

/**
 * Build edge label transform to keep text readable (never upside down)
 */
export function buildEdgeLabelTransform(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { x: number; y: number; rotation: number } {
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI)

  // Keep rotation between -90 and 90 degrees (never upside down)
  let rotation = angle
  if (rotation > 90) rotation -= 180
  if (rotation < -90) rotation += 180

  return { x: midX, y: midY, rotation }
}