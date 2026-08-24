// src/lib/hanzi-segmentation.ts
import { createClient } from "@/lib/supabase/browser"
import { buildQueryTokens, matchPinyinTokens, stripTones, isIndonesianQuery } from "./pinyin-search"

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
    async function fetchAll(table: string, select: string) {
      let allData: any[] = []
      let from = 0
      const limit = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data, error } = await supabase
          .from(table)
          .select(select)
          .order("id", { ascending: true })
          .range(from, from + limit - 1)
          
        if (error) {
          console.error(`Error fetching ${table}:`, error)
          break
        }
        
        if (data && data.length > 0) {
          allData = [...allData, ...data]
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
    const cards = await fetchAll("flashcard_cards", "id, set_id, hanzi, pinyin, arti")

    // Fetch Compounds
    const compounds = await fetchAll("word_compounds", "id, hanzi, pinyin, arti, badge")

    const hskMapped: GlobalWord[] = (cards || []).map((c) => ({
      ...c,
      source: "hsk",
      hsk_level: c.set_id ? (setHskMap[c.set_id] || 1) : 1,
    }))

    const compMapped: GlobalWord[] = (compounds || []).map((c) => ({
      ...c,
      source: "compound",
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

export async function performSmartSearch(raw: string, filter: "all" | "hsk" | "common" | "native" = "all"): Promise<GlobalWord[]> {
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
