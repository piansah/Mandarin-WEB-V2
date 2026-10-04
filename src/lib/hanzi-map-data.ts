// lib/hanzi-map-data.ts
// Supabase fetching for Hanzi Map feature

import type { SupabaseClient } from "@supabase/supabase-js"
import type { VocabularyWord, ExampleSentence } from "./hanzi-map"

/**
 * Fetch vocabulary words containing a character
 * First queries flashcard_cards, then word_compounds to fill remaining slots
 */
export async function fetchWordsForChar(
  supabase: SupabaseClient,
  char: string,
  limit: number = 8
): Promise<VocabularyWord[]> {
  const words: VocabularyWord[] = []
  
  try {
    // First query flashcard_cards
    const { data: flashcardData, error: flashcardError } = await supabase
      .from("flashcard_cards")
      .select("id, hanzi, pinyin, arti, word_class")
      .ilike("hanzi", `%${char}%`)
      .limit(200)
    
    if (!flashcardError && flashcardData) {
      for (const item of flashcardData) {
        words.push({
          id: item.id,
          hanzi: item.hanzi,
          pinyin: item.pinyin,
          arti: item.arti,
          word_class: item.word_class,
          source: "flashcard",
          frequency: null,
        })
      }
    }
  } catch (error) {
    console.error("Error fetching flashcard_cards:", error)
  }
  
  // If not enough words, query word_compounds
  if (words.length < limit) {
    try {
      const { data: compoundData, error: compoundError } = await supabase
        .from("word_compounds")
        .select("id, hanzi, pinyin, arti, badge, frequency")
        .ilike("hanzi", `%${char}%`)
        .order("frequency", { ascending: false })
        .limit(50)
      
      if (!compoundError && compoundData) {
        for (const item of compoundData) {
          words.push({
            id: item.id,
            hanzi: item.hanzi,
            pinyin: item.pinyin,
            arti: item.arti,
            source: "compound",
            frequency: item.frequency,
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
    // First query hanzi_items
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
  
  // If not enough examples, query word_examples
  if (examples.length < limit) {
    try {
      // First try exact match
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
      
      // If still not enough, try ilike
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
