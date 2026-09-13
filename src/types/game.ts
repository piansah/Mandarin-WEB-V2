/**
 * Shared types untuk semua mini-game.
 * Import dari sini untuk menghindari duplikasi definisi type.
 */

export type GameWord = {
  id: number
  hanzi: string
  pinyin: string
  arti: string
}

export type FlashcardSet = {
  id: number
  title: string
  hsk_level: number
  sort_order: number
}

export type GameStage = {
  index: number       // 1-based stage number within HSK level
  sets: FlashcardSet[]
  label: string
}

export type GameState = "idle" | "stage-select" | "playing" | "gameover"
