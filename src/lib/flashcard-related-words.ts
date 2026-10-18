type RelatedWord = {
  hanzi: string
  badge?: string | null
}

function getBadgeOrder(badge?: string | null) {
  const value = badge?.trim().toLowerCase() ?? ""
  const hskLevel = value.match(/hsk\s*([1-6])/)
  if (hskLevel) return Number(hskLevel[1])
  if (value === "common") return 7
  return 8
}

export function sortRelatedWords<T extends RelatedWord>(words: T[], currentHanzi: string) {
  return words
    .filter(word => word.hanzi !== currentHanzi)
    .sort((a, b) => getBadgeOrder(a.badge) - getBadgeOrder(b.badge))
}
