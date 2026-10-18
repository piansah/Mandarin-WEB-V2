/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/* 
   types.ts -- Flashcard Deck - Type Definitions */

export type Card = {
  id: string
  hanzi: string
  pinyin: string
  arti: string
  hsk_level?: number | null
  badge?: string | null
  word_class?: string | null
  catatan?: string | null
  set_id?: string | number
}

export type DetailTab = "kalimat" | "stroke" | "karakter" | "kata"

export type ExampleSentence = {
  id: number
  hanzi: string | null
  pinyin: string | null
  arti: string | null
  section_label?: string | null
}

export type CompoundWord = {
  id?: string | number
  set_id?: number
  source?: "hsk" | "compound"
  hanzi: string
  pinyin: string | null
  arti: string | null
  badge?: string | null
}

export type DictionaryEntry = import("@/lib/character-dictionary").CharacterDictionaryEntry

export type DictionaryMap = import("@/lib/character-dictionary").CharacterDictionary

export type DeckMeta = {
  title: string
  description: string | null
}
