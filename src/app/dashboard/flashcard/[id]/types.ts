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
  hanzi: string
  pinyin: string | null
  arti: string | null
  badge?: string | null
}

export type DictionaryEntry = {
  pinyin?: string[]
  definition?: string
  decomposition?: string
  etymology?: { hint?: string }
}

export type DictionaryMap = Record<string, DictionaryEntry>

export type DeckMeta = {
  title: string
  description: string | null
}
