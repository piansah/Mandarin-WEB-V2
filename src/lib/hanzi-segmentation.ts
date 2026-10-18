
// src/lib/hanzi-segmentation.ts
import { createClient } from "@/lib/supabase/browser"
import { buildQueryTokens, matchPinyinTokens, stripTones, isIndonesianQuery } from "./pinyin-search"
import { isHanzi, splitPinyin as splitHanziPinyin } from "./hanzi-utils"

export type GlobalWord = {
  id: string | number
  set_id?: number
  hanzi: string
  pinyin: string | null
  arti: string | null
  badge?: string | null
  hsk_level?: number | null
  source: "hsk" | "compound"
}

export type SegmentedWord = {
  id?: string | number
  set_id?: number
  source?: "hsk" | "compound"
  hanzi: string
  pinyin?: string | null
  arti?: string | null
  hsk?: number | null
  badge?: string | null
  found: boolean
  isPunct?: boolean
}

function normalizeWordPinyin(value: string | null | undefined): string {
  return stripTones(value ?? "").toLowerCase().replace(/[^a-zü]/g, "")
}

/** Align pinyin word groups with Hanzi by syllable count, then attach dictionary metadata. */
export function segmentSentenceByPinyin(sentence: string, pinyin?: string | null): SegmentedWord[] {
  if (!sentence) return []
  if (!pinyin?.trim()) return segmentText(sentence)

  const pinyinGroups = pinyin.match(/[\p{L}\p{M}üÜ]+(?:[1-5])?/gu) ?? []
  if (pinyinGroups.length === 0) return []

  const chars = Array.from(sentence)
  const aligned: SegmentedWord[] = []
  let charIndex = 0

  for (const pinyinGroup of pinyinGroups) {
    while (charIndex < chars.length && !isHanzi(chars[charIndex])) {
      const char = chars[charIndex++]
      aligned.push({ hanzi: char, found: false, isPunct: true })
    }

    const syllableCount = splitHanziPinyin(pinyinGroup).length
    let hanzi = ""
    while (charIndex < chars.length && hanzi.length < syllableCount) {
      const char = chars[charIndex]
      if (!isHanzi(char)) break
      hanzi += char
      charIndex += 1
    }
    if (hanzi.length !== syllableCount) return []

    const dictionaryWord = segmentText(hanzi).find(segment => segment.hanzi === hanzi)
    aligned.push(dictionaryWord
      ? { ...dictionaryWord, pinyin: dictionaryWord.pinyin || pinyinGroup }
      : { hanzi, pinyin: pinyinGroup, found: false })
  }

  while (charIndex < chars.length) {
    const char = chars[charIndex++]
    aligned.push(isHanzi(char)
      ? { hanzi: char, found: false }
      : { hanzi: char, found: false, isPunct: true })
  }

  return aligned
}

/** Match a vocabulary item as a complete pinyin-aligned word, not as a Hanzi substring. */
export function sentenceContainsExactWord(sentence: string, hanzi: string, pinyin?: string | null, sentencePinyin?: string | null): boolean {
  const targetPinyin = normalizeWordPinyin(pinyin)
  return segmentSentenceByPinyin(sentence, sentencePinyin).some(segment => {
    if (segment.hanzi !== hanzi) return false
    const segmentPinyin = normalizeWordPinyin(segment.pinyin)
    return !targetPinyin || !segmentPinyin || segmentPinyin === targetPinyin
  })
}

const MEANING_STOP_WORDS = new Set(["dan", "atau", "dengan", "dari", "untuk", "pada", "dalam", "adalah", "sebagai"])

function splitMeaningAlternatives(value: string): string[] {
  const alternatives: string[] = []
  let current = ""
  let parentheses = 0
  for (const char of value) {
    if (char === "(") parentheses += 1
    if (char === ")") parentheses = Math.max(0, parentheses - 1)
    if ((char === ";" || char === "/") && parentheses === 0) {
      alternatives.push(current)
      current = ""
    } else {
      current += char
    }
  }
  alternatives.push(current)
  return alternatives.map(item => item.replace(/\([^)]*\)/g, " ").trim()).filter(Boolean)
}

/** Match any primary meaning alternative; parenthetical notes remain explanatory context. */
export function sentenceMeaningMatches(wordMeaning?: string | null, sentenceMeaning?: string | null): boolean | null {
  if (!wordMeaning?.trim() || !sentenceMeaning?.trim()) return null
  const normalize = (value: string) => value
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(token => token.length >= 3 && !MEANING_STOP_WORDS.has(token))
  const sentenceWords = new Set(normalize(sentenceMeaning))
  if (sentenceWords.size === 0) return null

  let hasComparableMeaning = false
  for (const alternative of splitMeaningAlternatives(wordMeaning)) {
    const targetWords = normalize(alternative)
    if (targetWords.length === 0) continue
    hasComparableMeaning = true
    if (targetWords.length === 1) {
      const [word] = targetWords
      if (sentenceWords.has(word)) return true
      continue
    }

    const overlap = targetWords.filter(word => sentenceWords.has(word)).length
    if (overlap / targetWords.length >= 0.5) return true
  }

  return hasComparableMeaning ? false : null
}

export function getWordDetailPath(word: {
  id?: string | number
  set_id?: number
  source?: "hsk" | "compound"
}): string | null {
  if (word.id === undefined || word.id === null || word.id === "") return null
  if (word.source === "hsk" && word.set_id != null) {
    return `/dashboard/flashcard/${word.set_id}/word/${word.id}`
  }
  return `/dashboard/flashcard/search/word/${word.id}`
}

let _globalSearchCache: GlobalWord[] | null = null
let _initPromise: Promise<void> | null = null

const DB_NAME = "hanzi_cache_db"
const STORE_NAME = "hanzi_store"
const CACHE_KEY = "global_search_v2"

async function getIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getFromIDB(key: string): Promise<unknown> {
  try {
    const db = await getIDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function setToIDB(key: string, value: unknown): Promise<void> {
  try {
    const db = await getIDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const req = store.put(value, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // ignore
  }
}

export async function initGlobalSearchCache(forceRefresh = false) {
  if (_globalSearchCache && !forceRefresh) return
  if (_initPromise && !forceRefresh) return _initPromise

  _initPromise = (async () => {
    if (!forceRefresh) {
      const saved = await getFromIDB(CACHE_KEY)
      if (saved && Array.isArray(saved) && saved.length > 0) {
        _globalSearchCache = saved as GlobalWord[]
        return
      }
    }

    const supabase = createClient()
    
    // Fetch HSK Sets mapping
    const { data: sets } = await supabase
      .from("flashcard_sets")
      .select("id, title, hsk_level")
      
    const setHskMap: Record<number, number> = {}
    if (sets) {
      sets.forEach((s) => {
        setHskMap[s.id] = s.hsk_level || 1
      })
    }

    // Helper to fetch all rows
    async function fetchAll<T>(table: string, select: string): Promise<T[]> {
      let allData: T[] = []
      let from = 0
      const limit = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data, error } = await supabase
          .from(table as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .select(select)
          .order("id", { ascending: true })
          .range(from, from + limit - 1)
          
        if (error) {
          console.error(`Error fetching ${table}:`, error)
          break
        }
        
        if (data && data.length > 0) {
          allData = [...allData, ...(data as T[])]
          from += limit
          if (data.length < limit) {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      }
      return allData
    }

    // Fetch Cards
    const cards = await fetchAll<{ id: string | number; set_id?: number; hanzi: string; pinyin: string | null; arti: string | null }>("flashcard_cards", "id, set_id, hanzi, pinyin, arti")

    // Fetch Compounds
    const compounds = await fetchAll<{ id: string | number; hanzi: string; pinyin: string | null; arti: string | null; badge?: string | null }>("word_compounds", "id, hanzi, pinyin, arti, badge")

    const hskMapped: GlobalWord[] = (cards || []).map((c) => ({
      ...c,
      source: "hsk" as const,
      hsk_level: c.set_id ? (setHskMap[c.set_id] || 1) : 1,
    }))

    const compMapped: GlobalWord[] = (compounds || []).map((c) => ({
      ...c,
      source: "compound" as const,
    }))

    _globalSearchCache = [...hskMapped, ...compMapped]
    await setToIDB(CACHE_KEY, _globalSearchCache)
  })().catch((err) => {
    console.error("Global cache init failed:", err)
    _initPromise = null
  })

  return _initPromise
}

export function getCachedSearchData(): GlobalWord[] {
  return _globalSearchCache || []
}

export async function performSmartSearch(raw: string, filter: "all" | "hsk" | "common" | "native" = "all", searchType: "all" | "hanzi" | "pinyin" | "arti" = "all"): Promise<GlobalWord[]> {
  if (!raw) return []
  const q = raw.trim().toLowerCase()
  if (!q) return []

  if (!_globalSearchCache) {
    await initGlobalSearchCache()
  }
  if (!_globalSearchCache) return []

  const queryTokens = buildQueryTokens(raw)
  const hasTone = queryTokens.some((t) => t.toned !== null)
  const isID = isIndonesianQuery(raw)

  // Filter local cache
  const hskResults = _globalSearchCache.filter((c) => {
    const hanzi = (c.hanzi || "").toLowerCase()
    const arti = (c.arti || "").toLowerCase()
    const py = (c.pinyin || "").toLowerCase()

    // Strict type filter — only search one field
    if (searchType === "hanzi") {
      return hanzi.includes(q)
    }

    if (searchType === "pinyin") {
      if (hasTone) return matchPinyinTokens(py, queryTokens)
      const qStrip = stripTones(q)
      const qCompact = qStrip.replace(/\s+/g, "")
      const pyStrip = stripTones(py)
      if (matchPinyinTokens(py, queryTokens)) return true
      if (pyStrip.replace(/\s+/g, "").includes(qCompact)) return true
      const queryParts = qStrip.split(/\s+/).filter(Boolean)
      const syllables = pyStrip.split(/\s+/).filter(Boolean)
      if (queryParts.length > 1) {
        return syllables.some((_, i) =>
          queryParts.every((qp, j) => syllables[i + j]?.startsWith(qp))
        )
      }
      return syllables.some((s) => s.startsWith(qStrip))
    }

    if (searchType === "arti") {
      const artiWords = arti.split(/[\s\/,;\-\(\)]+/).filter(Boolean)
      const queryParts = q.split(/\s+/).filter(Boolean)
      if (queryParts.length > 1) {
        return artiWords.some((_, i) =>
          queryParts.every((qp, j) => artiWords[i + j]?.startsWith(qp))
        )
      }
      return artiWords.some((w) => w.startsWith(q)) || arti.includes(q)
    }

    // Default "all": smart multi-field search
    if (hanzi.includes(q)) return true
    
    if (hasTone) {
      if (matchPinyinTokens(py, queryTokens)) return true
    } else {
      const qStrip = stripTones(q)
      const qCompact = qStrip.replace(/\s+/g, "")
      const pyStrip = stripTones(py)
      
      if (matchPinyinTokens(py, queryTokens)) return true
      if (pyStrip.replace(/\s+/g, "").includes(qCompact)) return true
      
      const queryParts = qStrip.split(/\s+/).filter(Boolean)
      const syllables = pyStrip.split(/\s+/).filter(Boolean)
      if (queryParts.length > 1) {
        const found = syllables.some((_, i) =>
          queryParts.every((qp, j) => syllables[i + j]?.startsWith(qp))
        )
        if (found) return true
      } else {
        if (syllables.some((s) => s.startsWith(qStrip))) return true
      }
    }

    if (isID) {
      const artiWords = arti.split(/[\s\/,;\-\(\)]+/).filter(Boolean)
      const queryParts = q.split(/\s+/).filter(Boolean)
      if (queryParts.length > 1) {
        return artiWords.some((_, i) =>
          queryParts.every((qp, j) => artiWords[i + j]?.startsWith(qp))
        )
      }
      return artiWords.some((w) => w === q)
    }
    
    return arti.includes(q)
  })

  // We skip the fallback DB call to word_compounds via regex because it's already fully cached in IDB in this rewrite.
  // The original did a fallback fetch for extra compound words.
  
  let merged = [...hskResults]

  if (filter === "hsk") {
    merged = merged.filter((r) => r.source === "hsk")
  } else if (filter === "common") {
    merged = merged.filter((r) => r.badge === "common")
  } else if (filter === "native") {
    merged = merged.filter((r) => r.badge === "native" || (r.source === "compound" && !r.badge))
  }

  // Deduplicate by Hanzi
  const uniqueMap = new Map<string, GlobalWord>()
  merged.forEach(item => {
    if (!uniqueMap.has(item.hanzi)) {
      uniqueMap.set(item.hanzi, item)
    }
  })

  return Array.from(uniqueMap.values())
}

export function segmentText(text: string): SegmentedWord[] {
  const cache = _globalSearchCache || []
  const hanziMap = new Map<string, GlobalWord>()
  cache.forEach((c) => {
    if (c.hanzi && !hanziMap.has(c.hanzi)) {
      hanziMap.set(c.hanzi, c)
    }
  })

  const maxLen = 4
  const result: SegmentedWord[] = []
  let i = 0

  while (i < text.length) {
    let matched = false

    for (let len = Math.min(maxLen, text.length - i); len >= 1; len--) {
      const candidate = text.substring(i, i + len)
      const wordData = hanziMap.get(candidate)

      if (wordData) {
        result.push({
          id: wordData.id,
          set_id: wordData.set_id,
          source: wordData.source,
          hanzi: candidate,
          pinyin: wordData.pinyin,
          arti: wordData.arti,
          hsk: wordData.hsk_level,
          badge: wordData.badge,
          found: true,
        })
        i += len
        matched = true
        break
      }
    }

    if (!matched) {
      const char = text[i]
      const isPunct = /[\u3000-\u303F\uFF00-\uFFEF]/.test(char)

      result.push({
        hanzi: char,
        found: false,
        isPunct,
      })
      i++
    }
  }

  return result
}

