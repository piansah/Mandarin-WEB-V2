// lib/hanzi-map-data.ts
// Supabase fetching for Hanzi Map feature

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isHskQuotaMet,
  parseHskLevel,
  type VocabularyWord,
  type ExampleSentence,
} from "./hanzi-map"

/**
 * Fetch vocabulary words yang DIAWALI oleh sebuah karakter.
 *
 * - flashcard_cards dicari dulu. Level HSK diambil dari deck-nya
 *   (flashcard_cards.set_id -> flashcard_sets.hsk_level).
 * - word_compounds hanya dicari jika kata flashcard BELUM memenuhi jatah HSK
 *   (HSK 1 = 3 kata, HSK 2-6 = 1 kata, total `limit`). Level compound dibaca
 *   dari kolom badge (mis. "HSK 3"); jika tidak ada, levelnya tidak diketahui.
 *
 * Pola pencarian `${char}%` (awalan) supaya batas limit tidak habis oleh kata
 * yang nantinya dibuang. Karakter tunggalnya sendiri tetap ikut terambil.
 *
 * Pemilihan akhir 8 kata dilakukan di halaman lewat pickByHskQuota().
 */
export async function fetchWordsForChar(
  supabase: SupabaseClient,
  char: string,
  limit: number = 8
): Promise<VocabularyWord[]> {
  const words: VocabularyWord[] = []

  // 1) flashcard_cards
  try {
    const { data: flashcardData, error: flashcardError } = await supabase
      .from("flashcard_cards")
      .select("id, hanzi, pinyin, arti, word_class, set_id")
      .ilike("hanzi", `${char}%`)
      .limit(200)

    if (flashcardError) {
      console.error("Error fetching flashcard_cards:", flashcardError)
    } else if (flashcardData) {
      // Level HSK per deck
      const setIds = [
        ...new Set(flashcardData.map((item) => item.set_id).filter((id) => id != null)),
      ]
      const hskBySet = new Map<string | number, number>()

      if (setIds.length > 0) {
        const { data: setData, error: setError } = await supabase
          .from("flashcard_sets")
          .select("id, hsk_level")
          .in("id", setIds)

        if (setError) {
          console.error("Error fetching flashcard_sets:", setError)
        } else {
          for (const set of setData ?? []) {
            if (set.hsk_level != null) hskBySet.set(set.id, Number(set.hsk_level))
          }
        }
      }

      for (const item of flashcardData) {
        words.push({
          id: item.id,
          hanzi: item.hanzi,
          pinyin: item.pinyin,
          arti: item.arti,
          word_class: item.word_class,
          source: "flashcard",
          frequency: null,
          hsk_level: item.set_id != null ? hskBySet.get(item.set_id) ?? null : null,
        })
      }
    }
  } catch (error) {
    console.error("Error fetching flashcard_cards:", error)
  }

  // 2) word_compounds: hanya jika jatah HSK belum terpenuhi
  if (!isHskQuotaMet(words, limit, char)) {
    try {
      const { data: compoundData, error: compoundError } = await supabase
        .from("word_compounds")
        .select("id, hanzi, pinyin, arti, badge, frequency")
        .ilike("hanzi", `${char}%`)
        .order("frequency", { ascending: false })
        .limit(50)

      if (compoundError) {
        console.error("Error fetching word_compounds:", compoundError)
      } else if (compoundData) {
        for (const item of compoundData) {
          words.push({
            id: item.id,
            hanzi: item.hanzi,
            pinyin: item.pinyin,
            arti: item.arti,
            source: "compound",
            frequency: item.frequency,
            hsk_level: parseHskLevel(item.badge),
            compound_badge: (item.badge === "common" || item.badge === "native") ? item.badge : null,
          })
        }
      }
    } catch (error) {
      console.error("Error fetching word_compounds:", error)
    }
  }

  return words
}

/**
 * Fetch example sentences for a word
 * First queries hanzi_items, then word_examples to fill remaining slots
 */
export async function fetchExamplesForWord(
  supabase: SupabaseClient,
  word: string,
  limit: number = 8
): Promise<ExampleSentence[]> {
  const examples: ExampleSentence[] = []

  try {
    const { data: hanziData, error: hanziError } = await supabase
      .from("hanzi_items")
      .select("id, hanzi, pinyin, arti, hanzi_key, section_label, user_contribution")
      .ilike("hanzi", `%${word}%`)
      .limit(30)

    if (!hanziError && hanziData) {
      for (const item of hanziData) {
        examples.push({
          id: item.id,
          hanzi: item.hanzi || "",
          pinyin: item.pinyin,
          arti: item.arti,
          source: "hanzi_items",
          section_label: item.section_label,
          user_contribution: item.user_contribution,
        })
      }
    }
  } catch (error) {
    console.error("Error fetching hanzi_items:", error)
  }

  if (examples.length < limit) {
    try {
      const { data: exactData, error: exactError } = await supabase
        .from("word_examples")
        .select("id, word_hanzi, hanzi, pinyin, arti")
        .eq("word_hanzi", word)
        .limit(10)

      if (!exactError && exactData) {
        for (const item of exactData) {
          examples.push({
            id: item.id,
            hanzi: item.hanzi || "",
            pinyin: item.pinyin,
            arti: item.arti,
            source: "word_examples",
          })
        }
      }

      if (examples.length < limit) {
        const { data: ilikeData, error: ilikeError } = await supabase
          .from("word_examples")
          .select("id, word_hanzi, hanzi, pinyin, arti")
          .ilike("hanzi", `%${word}%`)
          .limit(20)

        if (!ilikeError && ilikeData) {
          for (const item of ilikeData) {
            examples.push({
              id: item.id,
              hanzi: item.hanzi || "",
              pinyin: item.pinyin,
              arti: item.arti,
              source: "word_examples",
            })
          }
        }
      }
    } catch (error) {
      console.error("Error fetching word_examples:", error)
    }
  }

  return examples
}