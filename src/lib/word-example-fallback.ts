import type { createClient } from "@/lib/supabase/browser"

type BrowserSupabaseClient = ReturnType<typeof createClient>

type WordExample = { id: number; hanzi: string | null; pinyin: string | null; arti: string | null }

/** Batch partial Hanzi lookups instead of sending one REST request per word. */
export async function fetchFallbackWordExamples(
  supa: BrowserSupabaseClient,
  words: string[],
): Promise<Map<string, WordExample>> {
  const fallbackMap = new Map<string, WordExample>()
  const uniqueWords = [...new Set(words.filter(Boolean))]

  for (let start = 0; start < uniqueWords.length; start += 20) {
    const batch = uniqueWords.slice(start, start + 20)
    const filters = batch.map((word) => {
      // Quote values for PostgREST's `or` grammar; Hanzi normally contains
      // no reserved punctuation, but escaping also handles imported content.
      const escaped = word.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
      return `hanzi.ilike."%${escaped}%"`
    })

    const { data, error } = await supa
      .from("word_examples")
      .select("id, hanzi, pinyin, arti")
      .or(filters.join(","))
      .order("id", { ascending: true })
      .limit(1000)

    if (error || !data) continue

    for (const word of batch) {
      const match = data.find((example) => example.hanzi?.includes(word))
      if (match) fallbackMap.set(word, match)
    }
  }

  return fallbackMap
}
