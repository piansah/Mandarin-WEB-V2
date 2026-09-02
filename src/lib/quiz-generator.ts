import { shuffle } from "@/lib/array-utils"

export type QuizQuestion = {
  id: string
  type: "hanzi-arti" | "pinyin-arti" | "hanzi-pinyin" | "kalimat-rumpang"
  question: string
  questionExtra?: string // Untuk kalimat rumpang: kalimat lengkap
  correct: string
  options: string[]
}

export type Card = {
  id: string | number
  hanzi: string
  pinyin: string
  arti: string
}

export type HanziItem = {
  id: number
  hanzi_key: string
  section_label: string
  section_tag: string
  sort_order: number
  hanzi: string
  pinyin: string
  arti: string
}

/**
 * Cek apakah hanzi_key adalah kelipatan 3
 * Contoh: h3, h6, h9, h12 → true
 * Contoh: h1, h2, h4, h5 → false
 */
function isMultipleOfThreeKey(hanziKey: string): boolean {
  const match = hanziKey.match(/^h(\d+)$/i)
  if (!match) return false
  const num = parseInt(match[1])
  return num % 3 === 0
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
 * Generate distractor untuk hanzi (kalimat rumpang)
 */
function generateHanziDistractors(
  correct: string,
  allItems: HanziItem[],
  count: number
): string[] {
  const others = allItems.filter(i => i.hanzi !== correct)
  const shuffled = shuffle(others)
  return shuffled.slice(0, count).map(i => i.hanzi)
}

/**
 * Generate soal Hanzi → Arti (20 soal)
 */
function generateHanziToArti(cards: Card[]): QuizQuestion[] {
  const shuffled = shuffle(cards)
  const selected = shuffled.slice(0, 20)

  return selected.map((card, idx) => ({
    id: `hanzi-arti-${idx}`,
    type: "hanzi-arti" as const,
    question: card.hanzi,
    correct: card.arti,
    options: shuffle([card.arti, ...generateDistractors(card.arti, cards, 3)]),
  }))
}

/**
 * Generate soal Pinyin → Arti (20 soal)
 */
function generatePinyinToArti(cards: Card[]): QuizQuestion[] {
  const shuffled = shuffle(cards)
  const selected = shuffled.slice(0, 20)

  return selected.map((card, idx) => ({
    id: `pinyin-arti-${idx}`,
    type: "pinyin-arti" as const,
    question: card.pinyin,
    correct: card.arti,
    options: shuffle([card.arti, ...generateDistractors(card.arti, cards, 3)]),
  }))
}

/**
 * Generate soal Hanzi → Pinyin (20 soal)
 */
function generateHanziToPinyin(cards: Card[]): QuizQuestion[] {
  const shuffled = shuffle(cards)
  const selected = shuffled.slice(0, 20)

  return selected.map((card, idx) => ({
    id: `hanzi-pinyin-${idx}`,
    type: "hanzi-pinyin" as const,
    question: card.hanzi,
    correct: card.pinyin,
    options: shuffle([card.pinyin, ...generatePinyinDistractors(card.pinyin, cards, 3)]),
  }))
}

/**
 * Generate soal Lengkapi Kalimat Rumpang (20 soal)
 * Hanya untuk deck kelipatan 3
 */
function generateSentenceFill(hanziItems: HanziItem[]): QuizQuestion[] {
  const shuffled = shuffle(hanziItems)
  const selected = shuffled.slice(0, 20)

  return selected.map((item, idx) => {
    // Buat kalimat dengan blank (ganti hanzi dengan ___)
    const blankedSentence = item.hanzi.replace(new RegExp(item.hanzi, 'g'), '___')

    return {
      id: `kalimat-rumpang-${idx}`,
      type: "kalimat-rumpang" as const,
      question: blankedSentence,
      questionExtra: item.hanzi, // Kalimat lengkap untuk referensi
      correct: item.hanzi,
      options: shuffle([item.hanzi, ...generateHanziDistractors(item.hanzi, hanziItems, 3)]),
    }
  })
}

/**
 * Generate quiz dari kartu-kartu deck
 * 
 * @param cards - Kartu-kartu kosakata deck
 * @param hanziKey - Key hanzi (opsional, untuk cek kelipatan 3)
 * @param hanziItems - Item hanzi untuk kalimat rumpang (opsional)
 * @returns Array soal quiz
 */
export function generateQuizFromCards(
  cards: Card[],
  hanziKey?: string,
  hanziItems?: HanziItem[]
): QuizQuestion[] {
  const quiz: QuizQuestion[] = []

  // 3 tipe soal dasar (selalu ada)
  quiz.push(...generateHanziToArti(cards))      // 20 soal
  quiz.push(...generatePinyinToArti(cards))    // 20 soal
  quiz.push(...generateHanziToPinyin(cards))    // 20 soal

  // Kalimat rumpang hanya jika kelipatan 3 dan ada hanziItems
  if (hanziKey && isMultipleOfThreeKey(hanziKey) && hanziItems && hanziItems.length > 0) {
    quiz.push(...generateSentenceFill(hanziItems)) // 20 soal
  }

  return shuffle(quiz)
}
