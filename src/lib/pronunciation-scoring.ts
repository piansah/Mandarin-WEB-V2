// Utilitas penilaian pelafalan berbasis Web Speech API.
// Membandingkan transkrip hasil pengenalan suara dengan kalimat target
// memakai jarak Levenshtein, lalu menerjemahkan skor kemiripan itu jadi
// label feedback yang mudah dipahami (Sempurna, Benar, dst).

export function normalizeChinese(str: string) {
  return str
    .replace(/[，,、。．？?！!；;：:＂"＇'「」『』【】（）()〈〉《》〔〕［］｛｝·\s]/g, "")
    .trim()
}

export function levenshtein(a: string, b: string) {
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  let curr = new Array(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

export function getSimilarity(a: string, b: string) {
  if (!a || !b) return 0
  if (a === b) return 100
  const maxLen = Math.max(a.length, b.length)
  const dist = levenshtein(a, b)
  return Math.max(0, Math.round((1 - dist / maxLen) * 100))
}

/**
 * Hitung skor akurasi (0-100) antara transkrip ucapan user dan kalimat
 * target. Sedikit toleran kalau transkrip cuma "kepotong" tapi porsi
 * besarnya sudah cocok (mis. hasil STT berhenti lebih awal).
 */
export function scorePronunciation(transcript: string, target: string) {
  const tNorm = normalizeChinese(transcript.toLowerCase())
  const hzNorm = normalizeChinese(target)

  let score = getSimilarity(tNorm, hzNorm)
  if (hzNorm.includes(tNorm) && tNorm.length > 0 && tNorm.length / hzNorm.length >= 0.75) {
    score = Math.max(score, 85)
  }
  return score
}

export type PronunciationTone = "success" | "info" | "warning" | "danger"

export type PronunciationVerdict = {
  label: "Sempurna" | "Hampir Sempurna" | "Benar" | "Kurang Tepat" | "Salah"
  tone: PronunciationTone
  tip: string
}

/**
 * Terjemahkan skor akurasi jadi verdict + saran singkat. Ambang batas
 * sengaja dibuat berjenjang 5 level supaya feedback terasa lebih halus
 * dibanding cuma "benar/salah".
 */
export function classifyPronunciation(score: number): PronunciationVerdict {
  if (score >= 95) {
    return {
      label: "Sempurna",
      tone: "success",
      tip: "Pelafalan dan nadamu sudah persis seperti contoh. Pertahankan ritme bicaramu!",
    }
  }
  if (score >= 85) {
    return {
      label: "Hampir Sempurna",
      tone: "success",
      tip: "Sudah sangat dekat dengan contoh. Dengarkan sekali lagi dan perhatikan nada di suku kata terakhir.",
    }
  }
  if (score >= 65) {
    return {
      label: "Benar",
      tone: "info",
      tip: "Maknanya sudah tersampaikan dengan tepat. Latih lagi supaya pelafalannya makin natural.",
    }
  }
  if (score >= 40) {
    return {
      label: "Kurang Tepat",
      tone: "warning",
      tip: "Ada beberapa kata yang terdengar berbeda dari contoh. Coba ucapkan lebih pelan, per suku kata.",
    }
  }
  return {
    label: "Salah",
    tone: "danger",
    tip: "Ucapanmu masih jauh dari kalimat target. Dengarkan contohnya lagi, lalu coba ulangi perlahan-lahan.",
  }
}
