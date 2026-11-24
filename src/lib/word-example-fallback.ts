import type { createClient } from "@/lib/supabase/browser"
import { initGlobalSearchCache, sentenceContainsExactWord, sentenceMeaningMatches } from "@/lib/hanzi-segmentation"

type BrowserSupabaseClient = ReturnType<typeof createClient>
type WordTarget = { hanzi: string; pinyin?: string | null; badge?: string | null; arti?: string | null }
type CandidateExample = { id: number; hanzi: string | null; pinyin: string | null; arti: string | null }
type WordExample = { id: number; hanzi: string; pinyin?: string; arti?: string }

function normalizeHskBadge(badge?: string | null): string | null {
  const match = badge?.trim().match(/^HSK\s*([1-6])$/i)
  return match ? `HSK ${match[1]}` : null
}

export function getWordExampleKey(hanzi: string, badge?: string | null): string {
  const normalizedBadge = normalizeHskBadge(badge)
  return normalizedBadge ? `${normalizedBadge}::${hanzi}` : hanzi
}

/**
 * Select same-HSK hanzi_items first for HSK flashcard cards. If that level has
 * no matching sentence, use explicitly linked word_examples as the fallback.
 * Calls without an HSK badge keep the existing cross-level candidate behavior.
 */
export async function fetchWordExamplesForWords(
  supa: BrowserSupabaseClient,
  words: WordTarget[],
): Promise<Map<string, WordExample>> {
  const targetMap = new Map<string, WordTarget>()
  for (const target of words) {
    const key = getWordExampleKey(target.hanzi, target.badge)
    if (target.hanzi && !targetMap.has(key)) targetMap.set(key, target)
  }
  const targets = [...targetMap.values()]
  const result = new Map<string, WordExample>()
  if (targets.length === 0) return result

  // Needed for exact segmentation when an example has no pinyin. The cache is
  // shared, so later calls reuse the same initialization.
  await initGlobalSearchCache()

  const isExactMatch = (example: CandidateExample, target: WordTarget) =>
    !!example.hanzi && sentenceContainsExactWord(
      example.hanzi,
      target.hanzi,
      target.pinyin,
      example.pinyin,
    )

  // Detect which hanzi appear in multiple HSK levels (need meaning match)
  const allHanzi = [...new Set(targets.map(t => t.hanzi))]
  const filters = allHanzi.map(hanzi => {
    const escaped = hanzi.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
    return `hanzi.ilike."%${escaped}%"`
  })

  const [allHanziItems, setBadgeResults] = await Promise.all([
    supa.from("hanzi_items")
      .select("id, hanzi_key, hanzi, pinyin, arti")
      .or(filters.join(","))
      .order("id")
      .limit(2000),
    supa.from("hanzi_sets").select("key, badge"),
  ])

  const badgeBySetKey = new Map((setBadgeResults.data ?? []).map(set => [set.key, set.badge] as const))

  // Build map: hanzi -> set of HSK levels where it appears
  const hanziLevelsMap = new Map<string, Set<string>>()
  for (const row of allHanziItems.data ?? []) {
    if (!row.hanzi) continue
    const badge = normalizeHskBadge(badgeBySetKey.get(row.hanzi_key))
    if (!badge) continue
    for (const h of allHanzi) {
      // Only count if the hanzi actually contains the target as a standalone character
      // This avoids matching compound words that happen to contain the character
      if (row.hanzi === h || (row.hanzi.length > 1 && row.hanzi.includes(h))) {
        if (!hanziLevelsMap.has(h)) hanziLevelsMap.set(h, new Set())
        hanziLevelsMap.get(h)!.add(badge)
      }
    }
  }

  // Determine which hanzi need meaning match filter (appears in >=2 HSK levels)
  const needsMeaningMatch = new Set<string>()
  for (const [hanzi, levels] of hanziLevelsMap.entries()) {
    if (levels.size >= 2) needsMeaningMatch.add(hanzi)
  }

  // Batch the same three sources queried by the detail page, avoiding three
  // round trips per card when a full deck loads. Substring queries only gather
  // candidates; segmentation below decides whether the target is a whole word.
  for (let start = 0; start < targets.length; start += 20) {
    const batch = targets.slice(start, start + 20)
    const batchFilters = batch.map(({ hanzi }) => {
      const escaped = hanzi.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
      return `hanzi.ilike."%${escaped}%"`
    })

    const [hanziItems, linkedExamples, sentenceExamples] = await Promise.all([
      supa.from("hanzi_items")
        .select("id, hanzi_key, section_label, hanzi, pinyin, arti")
        .or(batchFilters.join(","))
        .order("id")
        .limit(1000),
      supa.from("word_examples")
        .select("id, word_hanzi, hanzi, pinyin, arti")
        .in("word_hanzi", batch.map(target => target.hanzi))
        .order("id"),
      supa.from("word_examples")
        .select("id, hanzi, pinyin, arti")
        .or(batchFilters.join(","))
        .order("id")
        .limit(1000),
    ])

    const setKeys = [...new Set((hanziItems.data ?? []).map(row => row.hanzi_key).filter(Boolean))]
    const setKeyChunks = Array.from({ length: Math.ceil(setKeys.length / 100) }, (_, index) =>
      setKeys.slice(index * 100, (index + 1) * 100)
    )
    const batchSetBadgeResults = await Promise.all(setKeyChunks.map(keys =>
      supa.from("hanzi_sets").select("key, badge").in("key", keys)
    ))
    const batchBadgeBySetKey = new Map(batchSetBadgeResults.flatMap(({ data }) =>
      (data ?? []).map(set => [set.key, set.badge] as const)
    ))

    for (const target of batch) {
      const targetBadge = normalizeHskBadge(target.badge)
      const levelMatchedItems = (hanziItems.data ?? [])
        .filter(row => row.hanzi?.includes(target.hanzi))
        .filter(row => !targetBadge || normalizeHskBadge(batchBadgeBySetKey.get(row.hanzi_key)) === targetBadge)
        .slice(0, 20)

      const candidates = [
        ...levelMatchedItems.map(row => ({ ...row, linkedToWord: false })),
        ...(linkedExamples.data ?? [])
          .filter(row => row.word_hanzi === target.hanzi)
          .map(row => ({ ...row, linkedToWord: true })),
        ...(!targetBadge ? (sentenceExamples.data ?? [])
          .filter(row => row.hanzi?.includes(target.hanzi))
          .slice(0, 20)
          .map(row => ({ ...row, linkedToWord: false })) : []),
      ]
      const seen = new Set<string>()

      // For hanzi appearing in multiple HSK levels, also check meaning match
      const useMeaningMatch = needsMeaningMatch.has(target.hanzi)

      const example = candidates.find(candidate => {
        const key = `${candidate.id}-${candidate.hanzi}`
        if (seen.has(key)) return false
        seen.add(key)
        if (!candidate.hanzi) return false
        if (candidate.linkedToWord) return true
        if (!isExactMatch(candidate, target)) return false

        // Apply meaning match filter for multi-level hanzi
        if (useMeaningMatch) {
          const meaningMatch = sentenceMeaningMatches(target.arti, candidate.arti)
          // Treat null as no match for multi-level hanzi to be strict
          if (meaningMatch !== true) return false
        }

        return true
      })
      if (example) {
        result.set(getWordExampleKey(target.hanzi, target.badge), {
          id: example.id,
          hanzi: example.hanzi!,
          pinyin: example.pinyin ?? undefined,
          arti: example.arti ?? undefined,
        })
      }
    }
  }

  return result
}
