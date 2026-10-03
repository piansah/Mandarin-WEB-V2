export type SwipeFlashcard = {
  id: string | number
  hanzi: string
  pinyin: string
  arti: string
  hskLevel?: number
  srsLevel?: number
  intervalDays?: number
  easeFactor?: number
  nextReview?: string
  exampleSentence?: string
  examplePinyin?: string
  exampleTranslation?: string
  setId?: string | number | null
  deckTitle?: string
  deckHskLevel?: number
  wordClass?: string
}

export type SessionStats = {
  mudah: number
  lupa: number
  sulit: number
  ingat: number
}

export type FlashcardPrefs = {
  autoPlayTts: boolean
  cardOrder: "sequential" | "shuffle"
  swipeEnabled: boolean
}

export type SessionHeaderStats = {
  dueToday: number
  totalCards: number
  accuracy: number
  mastered: number
  rated: number
  saved?: number
}

import { SrsState } from "@/lib/srs"

export type SwipeFlashcardSessionProps = {
  cards: SwipeFlashcard[]
  loading?: boolean
  emptyTitle?: string
  emptyEmoji?: string
  wordDetailPath?: (card: SwipeFlashcard) => string | null
  onComplete?: (stats: SessionStats, reviews: { cardId: string; quality: 0 | 3 | 4 | 5; state: SrsState }[]) => void
  deckTitle?: string
  deckLevel?: string
  userId?: string | null
  disableSwipe?: boolean
  deckCardIds?: string[]
  deckId?: number
}