const SCORE_KEY = "hsk_grammar_state"

export type GrammarScoreMap = Record<string, number>

type StoredScores = Record<string, { pct?: number; submitted?: boolean }>

function readStore(): StoredScores {
  if (typeof window === "undefined") return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SCORE_KEY) ?? "{}")
    return parsed && typeof parsed === "object" ? parsed as StoredScores : {}
  } catch {
    return {}
  }
}

export function getGrammarScores(): GrammarScoreMap {
  const scores: GrammarScoreMap = {}
  for (const [slug, value] of Object.entries(readStore())) {
    if (value?.submitted && typeof value.pct === "number") scores[slug] = value.pct
  }
  return scores
}

export function setGrammarScore(slug: string, pct: number) {
  const stored = readStore()
  stored[slug] = { pct, submitted: true }
  window.localStorage.setItem(SCORE_KEY, JSON.stringify(stored))
}

export function deleteGrammarScore(slug: string) {
  const stored = readStore()
  delete stored[slug]
  window.localStorage.setItem(SCORE_KEY, JSON.stringify(stored))
}

export function sessionKey(slug: string) {
  return `gram_session_${slug}`
}