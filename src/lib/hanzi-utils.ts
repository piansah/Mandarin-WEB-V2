/**
 * Hanzi utilities for Chinese character processing
 * Consolidated from flashcard components to avoid duplication
 */

// Tone mapping for pinyin characters
export const TONE_MAP: Record<string, string> = {
  ā: "1", á: "2", ǎ: "3", à: "4",
  ē: "1", é: "2", ě: "3", è: "4",
  ī: "1", í: "2", ǐ: "3", ì: "4",
  ō: "1", ó: "2", ǒ: "3", ò: "4",
  ū: "1", ú: "2", ǔ: "3", ù: "4",
  ǖ: "1", ǘ: "2", ǚ: "3", ǜ: "4",
}

// Tone class mapping for CSS styling
export const TONE_CLASS: Record<string, string> = {
  "1": "text-red-400",
  "2": "text-amber-400",
  "3": "text-emerald-400",
  "4": "text-sky-400",
}

// Ideographic Description Sequence (IDS) labels
export const IDS_LABELS: Record<string, string> = {
  "⿰": "kiri · kanan",
  "⿱": "atas · bawah",
  "⿲": "kiri · tengah · kanan",
  "⿳": "atas · tengah · bawah",
  "⿴": "luar · dalam",
  "⿵": "atas terbuka · dalam",
  "⿶": "bawah terbuka · dalam",
  "⿷": "kiri terbuka · dalam",
  "⿸": "kiri atas · dalam",
  "⿹": "kanan atas · dalam",
  "⿺": "kiri bawah · dalam",
  "⿻": "bertumpang",
}

// Word class labels for grammar
export const WORD_CLASS_LABELS: Record<string, string> = {
  noun: "Nomina · 名词 (míngcí)",
  verb: "Verba · 动词 (dòngcí)",
  adj: "Adjektiva · 形容词 (xíngróngcí)",
  adv: "Adverbia · 副词 (fùcí)",
  conj: "Konjungsi · 连词 (liáncí)",
  particle: "Partikel · 助词 (zhùcí)",
  pron: "Pronomina · 代词 (dàicí)",
  num: "Numeralia · 数词 (shùcí)",
  classifier: "Klasifikator · 量词 (liàngcí)",
  meas: "Kata Ukur · 量词 (liàngcí)",
  prefix: "Prefiks · 前缀 (qiánzhuì)",
  prep: "Preposisi · 介词 (jiècí)",
  interj: "Interjeksi · 叹词 (tàncí)",
}

/**
 * Get tone number from pinyin character
 */
export function getTone(char: string): string | undefined {
  return TONE_MAP[char]
}

/**
 * Check if a character is a Hanzi (Chinese character)
 */
export function isHanzi(char: string): boolean {
  const code = char.charCodeAt(0)
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)
}

/**
 * Split pinyin into syllables
 */
export function splitPinyin(word: string): string[] {
  return word.match(/[bpmfdtnlgkhjqxzcsryw]{0,2}[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜaeiouü]+(?:ng?|r)?/gi) ?? [word]
}

/**
 * Parse decomposition entry into parts
 */
export function decompParts(entry?: { decomposition?: string }): {
  ids: string
  label: string
  parts: string[]
} {
  const raw = entry?.decomposition || ""
  const ids = raw[0] || ""
  const parts = raw
    ? [...raw].filter(char => char !== ids && char !== "？" && !IDS_LABELS[char])
    : []
  return { ids, label: IDS_LABELS[ids] || "", parts: [...new Set(parts)] }
}