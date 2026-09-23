import { SwipeFlashcard, FlashcardPrefs } from "./types"

export function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array]
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArr[i], newArr[j]] = [newArr[j], newArr[i]]
  }
  return newArr
}

export function loadPrefs(): FlashcardPrefs {
  if (typeof window === "undefined") return { autoPlayTts: true, cardOrder: "sequential", swipeEnabled: true }
  try {
    const saved = localStorage.getItem("piansah_flashcard_prefs")
    if (saved) return { ...{ autoPlayTts: true, cardOrder: "sequential", swipeEnabled: true }, ...JSON.parse(saved) }
  } catch (e) {}
  return { autoPlayTts: true, cardOrder: "sequential", swipeEnabled: true }
}

export function savePrefs(prefs: FlashcardPrefs) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem("piansah_flashcard_prefs", JSON.stringify(prefs))
  } catch (e) {}
}

export function normalizeChinese(text: string): string {
  if (!text) return ""
  return text.replace(/[，。！？、；：“”‘’（）《》〈〉【】]/g, "")
    .replace(/[,.!?v;:""''()<>\[\]]/g, "")
    .replace(/\s+/g, "")
}

export function getSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 100
  if (s1.length === 0 || s2.length === 0) return 0
  const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null))
  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j
  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator)
    }
  }
  const maxLen = Math.max(s1.length, s2.length)
  return Math.round(((maxLen - matrix[s2.length][s1.length]) / maxLen) * 100)
}

export function formatIntervalDays(days: number): string {
  if (days < 1) return "besok"
  if (days === 1) return "besok"
  if (days < 30) return `${days} hari`
  const months = Math.floor(days / 30)
  return `${months} bulan`
}

export function getStudyTip(accuracy: number, forgotCount: number): string {
  if (forgotCount > 5) return "Istirahat sejenak! Otak butuh waktu mencerna kata baru."
  if (accuracy >= 90) return "Sempurna! Kamu mengingat hampir semuanya."
  if (accuracy >= 70) return "Kerja bagus! Fokuslah pada kartu yang sulit besok."
  return "Jangan menyerah, konsistensi adalah kunci!"
}