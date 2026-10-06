import { shuffle } from "@/lib/array-utils"

export type QuizQuestion = {
  id: string
  type: "hanzi-arti" | "pinyin-arti" | "hanzi-pinyin"
  question: string
  correct: string
  options: string[]
}

export type Card = {
  id: string | number
  hanzi: string
  pinyin: string
  arti: string
}



/**
 * Generate distractor (jawaban salah) dari kartu lain
 */
function generateDistractors(
  correct: string,
  allCards: Card[],
  count: number
): string[] {
  const others = allCards.filter(c => c.arti !== correct)
  const shuffled = shuffle(others)
  return shuffled.slice(0, count).map(c => c.arti)
}

/**
 * Generate distractor untuk pinyin
 */
function generatePinyinDistractors(
  correct: string,
  allCards: Card[],
  count: number
): string[] {
  const others = allCards.filter(c => c.pinyin !== correct)
  const shuffled = shuffle(others)
  return shuffled.slice(0, count).map(c => c.pinyin)
}



/**
 * Generate soal Hanzi → Arti (dinamis menyesuaikan jumlah deck)
 */
function generateHanziToArti(cards: Card[]): QuizQuestion[] {
  const shuffled = shuffle(cards)
  // Ambil semua cards, bukan slice 20
  const selected = shuffled

  return selected.map((card, idx) => ({
    id: `hanzi-arti-${idx}`,
    type: "hanzi-arti" as const,
    question: card.hanzi,
    correct: card.arti,
    options: shuffle([card.arti, ...generateDistractors(card.arti, cards, 3)]),
  }))
}

/**
 * Generate soal Pinyin → Arti (dinamis menyesuaikan jumlah deck)
 */
function generatePinyinToArti(cards: Card[]): QuizQuestion[] {
  const shuffled = shuffle(cards)
  // Ambil semua cards, bukan slice 20
  const selected = shuffled

  return selected.map((card, idx) => ({
    id: `pinyin-arti-${idx}`,
    type: "pinyin-arti" as const,
    question: card.pinyin,
    correct: card.arti,
    options: shuffle([card.arti, ...generateDistractors(card.arti, cards, 3)]),
  }))
}

/**
 * Generate soal Hanzi → Pinyin (dinamis menyesuaikan jumlah deck)
 */
function generateHanziToPinyin(cards: Card[]): QuizQuestion[] {
  const shuffled = shuffle(cards)
  // Ambil semua cards, bukan slice 20
  const selected = shuffled

  return selected.map((card, idx) => ({
    id: `hanzi-pinyin-${idx}`,
    type: "hanzi-pinyin" as const,
    question: card.hanzi,
    correct: card.pinyin,
    options: shuffle([card.pinyin, ...generatePinyinDistractors(card.pinyin, cards, 3)]),
  }))
}

/**
 * Generate quiz dari kartu-kartu deck
 *
 * @param cards - Kartu-kartu kosakata deck
 * @returns Array soal quiz (dinamis menyesuaikan jumlah deck)
 */
export function generateQuizFromCards(cards: Card[]): QuizQuestion[] {
  const quiz: QuizQuestion[] = []

  // 3 tipe soal dasar (selalu ada) - masing-masing menggunakan semua cards
  quiz.push(...generateHanziToArti(cards))
  quiz.push(...generatePinyinToArti(cards))
  quiz.push(...generateHanziToPinyin(cards))

  return shuffle(quiz)
}
