import type { createClient } from "@/lib/supabase/browser"
import { initGlobalSearchCache, sentenceContainsExactWord } from "@/lib/hanzi-segmentation"

type BrowserSupabaseClient = ReturnType<typeof createClient>
type WordTarget = { hanzi: string; pinyin?: string | null }
type WordExample = { id: number; hanzi: string | null; pinyin: string | null; arti: string | null }

/**
 * Return the first relevant example using the same sources and selection order
 * as the flashcard word-detail page: HSK sentences, linked word examples, then
 * unlinked word examples. Unlinked rows must contain the exact segmented word.
 */
export async function fetchWordExamplesForWords(
  supa: BrowserSupabaseClient,
  words: WordTarget[],
): Promise<Map<string, WordExample>> {
  const targetMap = new Map<string, WordTarget>()
  for (const target of words) {
    if (target.hanzi && !targetMap.has(target.hanzi)) targetMap.set(target.hanzi, target)
  }
  const targets = [...targetMap.values()]
  const result = new Map<string, WordExample>()
  if (targets.length === 0) return result

  // Needed for exact segmentation when an example has no pinyin. The cache is
  // shared, so later calls reuse the same initialization.
  await initGlobalSearchCache()

  const isExactMatch = (example: WordExample, target: WordTarget) =>
    !!example.hanzi && sentenceContainsExactWord(
      example.hanzi,
      target.hanzi,
      target.pinyin,
      example.pinyin,
    )

  // Batch the same three sources queried by the detail page, avoiding three
  // round trips per card when a full deck loads. Substring queries only gather
  // candidates; segmentation below decides whether the target is a whole word.
  for (let start = 0; start < targets.length; start += 20) {
    const batch = targets.slice(start, start + 20)
    const filters = batch.map(({ hanzi }) => {
      const escaped = hanzi.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
      return `hanzi.ilike."%${escaped}%"`
    })

    const [hanziItems, linkedExamples, sentenceExamples] = await Promise.all([
      supa.from("hanzi_items")
        .select("id, section_label, hanzi, pinyin, arti")
        .or(filters.join(","))
        .order("id")
        .limit(1000),
      supa.from("word_examples")
        .select("id, word_hanzi, hanzi, pinyin, arti")
        .in("word_hanzi", batch.map(target => target.hanzi))
        .order("id"),
      supa.from("word_examples")
        .select("id, hanzi, pinyin, arti")
        .or(filters.join(","))
        .order("id")
        .limit(1000),
    ])

    for (const target of batch) {
      // Detail kosakata puts HSK sentences first, then explicitly linked rows,
      // then unlinked sentence candidates. Explicit links are trusted there.
      const candidates = [
        ...(hanziItems.data ?? [])
          .filter(row => row.hanzi?.includes(target.hanzi))
          .slice(0, 20)
          .map(row => ({ ...row, linkedToWord: false })),
        ...(linkedExamples.data ?? [])
          .filter(row => row.word_hanzi === target.hanzi)
          .map(row => ({ ...row, linkedToWord: true })),
        ...(sentenceExamples.data ?? [])
          .filter(row => row.hanzi?.includes(target.hanzi))
          .slice(0, 20)
          .map(row => ({ ...row, linkedToWord: false })),
      ]
      const seen = new Set<string>()
      const example = candidates.find(candidate => {
        const key = `${candidate.id}-${candidate.hanzi}`
        if (seen.has(key)) return false
        seen.add(key)
        return candidate.linkedToWord || isExactMatch(candidate, target)
      })
      if (example) {
        result.set(target.hanzi, {
          id: example.id,
          hanzi: example.hanzi,
          pinyin: example.pinyin,
          arti: example.arti,
        })
      }
    }
  }

  return result
}
