const SINGLE_DIGIT_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"]

/** Keep the single-digit numeral cards together before 十, regardless of insertion time. */
export function orderNumeralsBeforeTen<T extends { hanzi: string }>(cards: T[]): T[] {
  const numeralOrder = new Map(SINGLE_DIGIT_NUMERALS.map((hanzi, index) => [hanzi, index]))
  const numerals = cards.filter(card => numeralOrder.has(card.hanzi))

  if (numerals.length < 2 || !cards.some(card => card.hanzi === "十")) return cards

  const orderedNumerals = numerals
    .map((card, index) => ({ card, index }))
    .sort((a, b) => numeralOrder.get(a.card.hanzi)! - numeralOrder.get(b.card.hanzi)! || a.index - b.index)
    .map(({ card }) => card)
  const remainingCards = cards.filter(card => !numeralOrder.has(card.hanzi))
  const tenIndex = remainingCards.findIndex(card => card.hanzi === "十")

  return [...remainingCards.slice(0, tenIndex), ...orderedNumerals, ...remainingCards.slice(tenIndex)]
}
