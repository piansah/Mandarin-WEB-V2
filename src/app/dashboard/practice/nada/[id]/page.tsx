"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Volume2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSupabase } from "@/hooks/use-supabase"
import { speakMandarin } from "@/lib/tts"
import { TonePinyin } from "@/components/tone-pinyin"
import styles from "./page.module.css"

type Card = {
  id: number
  hanzi: string        // kata utuh, bisa 1+ suku kata (mis. "你好")
  pinyin: string        // pinyin utuh kata (mis. "nǐ hǎo")
  arti: string
  tones: number[]        // nada tiap suku kata, urut sesuai hanzi (mis. [3, 3])
  syllables: string[]    // base syllable TANPA tanda nada, sejajar dgn `tones`
                          // (mis. ["ni", "hao"]) — dipakai buat regenerate
                          // pinyin bertanda nada tiap kombinasi jawaban.
  exampleSentence?: string
  examplePinyin?: string
  exampleTranslation?: string
}

const TONE_COLORS: Record<number, string> = {
  1: "text-red-400", 2: "text-amber-400", 3: "text-green-400", 4: "text-sky-400", 0: "text-muted-foreground",
}
const TONE_MARKS: Record<number, string> = {
  1: "‾", 2: "↗", 3: "↗↘", 4: "↘", 0: "·",
}
const TONE_LABELS: Record<number, string> = {
  1: "Nada 1 — Datar ‾", 2: "Nada 2 — Naik ↗", 3: "Nada 3 — Naik-Turun ↗↘", 4: "Nada 4 — Turun ↘", 0: "Nada 0 — Ringan ·",
}

function extractTone(pinyin: string): number {
  const toneMap: Record<string, number> = {
    ā: 1, á: 2, ǎ: 3, à: 4,
    ē: 1, é: 2, ě: 3, è: 4,
    ī: 1, í: 2, ǐ: 3, ì: 4,
    ō: 1, ó: 2, ǒ: 3, ò: 4,
    ū: 1, ú: 2, ǔ: 3, ù: 4,
    ǖ: 1, ǘ: 2, ǚ: 3, ǜ: 4,
  }
  for (const char of pinyin) {
    if (toneMap[char]) return toneMap[char]
  }
  return 0
}

// Hapus tanda diakritik nada dari sebuah syllable, balikin bentuk dasarnya
// (mis. "hǎo" -> "hao"). Dipakai supaya kita bisa regenerate syllable
// dengan nada berbeda saat bikin pilihan jawaban.
function stripToneMarks(syllable: string): string {
  const map: Record<string, string> = {
    ā: "a", á: "a", ǎ: "a", à: "a",
    ē: "e", é: "e", ě: "e", è: "e",
    ī: "i", í: "i", ǐ: "i", ì: "i",
    ō: "o", ó: "o", ǒ: "o", ò: "o",
    ū: "u", ú: "u", ǔ: "u", ù: "u",
    ǖ: "ü", ǘ: "ü", ǚ: "ü", ǜ: "ü",
  }
  return [...syllable].map(ch => map[ch] ?? ch).join("")
}

const TONE_VOWEL_MARKS: Record<string, string[]> = {
  a: ["a", "ā", "á", "ǎ", "à"],
  e: ["e", "ē", "é", "ě", "è"],
  i: ["i", "ī", "í", "ǐ", "ì"],
  o: ["o", "ō", "ó", "ǒ", "ò"],
  u: ["u", "ū", "ú", "ǔ", "ù"],
  ü: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"],
}

// Tempelkan tanda nada ke base syllable (tanpa diakritik) sesuai aturan
// penempatan nada standar pinyin: prioritas 'a' -> 'e' -> 'ou' (tanda di 'o')
// -> vokal terakhir dalam syllable (menangani kasus seperti "ui" -> i,
// "iu" -> u, "uo"/"duo" -> o, dst).
function applyToneToSyllable(baseSyllable: string, tone: number): string {
  if (!tone || tone === 0 || !baseSyllable) return baseSyllable
  const lower = baseSyllable.toLowerCase()

  let markIndex = -1
  const aIdx = lower.indexOf("a")
  const eIdx = lower.indexOf("e")
  const ouIdx = lower.indexOf("ou")

  if (aIdx !== -1) markIndex = aIdx
  else if (eIdx !== -1) markIndex = eIdx
  else if (ouIdx !== -1) markIndex = ouIdx
  else {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ("iouü".includes(lower[i])) { markIndex = i; break }
    }
  }

  if (markIndex === -1) return baseSyllable

  const vowelChar = lower[markIndex]
  const marks = TONE_VOWEL_MARKS[vowelChar]
  if (!marks) return baseSyllable

  const marked = marks[tone] ?? vowelChar
  return baseSyllable.slice(0, markIndex) + marked + baseSyllable.slice(markIndex + 1)
}

// Ubah kombinasi nada (mis. [3, 3]) jadi string pinyin bertanda nada utuh
// (mis. "nǐ hǎo"), berdasarkan base syllables kata tsb. Dipakai untuk
// menampilkan pilihan jawaban sebagai pinyin asli, bukan angka nada.
function comboToPinyin(baseSyllables: string[], combo: number[]): string {
  return combo.map((tone, i) => applyToneToSyllable(baseSyllables[i] ?? "", tone)).join(" ")
}

function splitPinyinSyllables(pinyin: string): string[] {
  const trimmed = pinyin.trim()
  if (!trimmed) return []
  if (/\s/.test(trimmed)) return trimmed.split(/\s+/).filter(Boolean)

  const vowels = "aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ"
  const initials = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s", "y", "w"]
  const syllables: string[] = []
  let pos = 0

  while (pos < trimmed.length) {
    let end = pos
    const rest = trimmed.slice(pos).toLowerCase()
    const initial = initials.find(ini => rest.startsWith(ini))
    if (initial) end += initial.length

    let hasVowel = false
    while (end < trimmed.length && vowels.includes(trimmed[end].toLowerCase())) {
      hasVowel = true
      end++
    }

    if (hasVowel && end < trimmed.length) {
      const tail = trimmed.slice(end).toLowerCase()
      if (tail.startsWith("ng")) end += 2
      else if ((tail[0] === "n" || tail[0] === "r") && !vowels.includes(tail[1] || "")) end += 1
    }

    if (end <= pos) break
    syllables.push(trimmed.slice(pos, end))
    pos = end
  }

  return syllables.length ? syllables : [trimmed]
}

function isHanziChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)
}

// Kartu tetap utuh sebagai kata (bisa multi-suku-kata), bukan dipecah
// per-karakter. Tiap kata dapat array nada per suku kata, mis. "你好" ->
// [3, 3], plus base syllables tanpa tanda nada ["ni", "hao"] buat
// regenerate pinyin pilihan jawaban. Kata yang punya suku kata bernada 0
// (ringan / tidak terbaca), atau jumlah suku kata pinyin tidak pas dengan
// jumlah karakter hanzi, dibuang dari kuis — karena pilihan jawaban
// dibatasi ke kombinasi nada 1-4 saja.
function buildWordCards(
  cards: Array<{
    id: number
    hanzi: string
    pinyin: string
    arti: string
    exampleSentence?: string
    examplePinyin?: string
    exampleTranslation?: string
  }>
): Card[] {
  return cards.flatMap(card => {
    const hanziChars = [...card.hanzi].filter(isHanziChar)
    const syllables = splitPinyinSyllables(card.pinyin)
    if (hanziChars.length === 0) return []

    const tones: number[] = []
    const baseSyllables: string[] = []
    hanziChars.forEach((_, index) => {
      const syl = syllables[index] ?? syllables[0] ?? card.pinyin
      tones.push(extractTone(syl))
      baseSyllables.push(stripToneMarks(syl))
    })

    if (tones.some(t => t === 0)) return []

    return [{
      id: card.id,
      hanzi: card.hanzi,
      pinyin: card.pinyin,
      arti: card.arti,
      tones,
      syllables: baseSyllables,
      exampleSentence: card.exampleSentence,
      examplePinyin: card.examplePinyin,
      exampleTranslation: card.exampleTranslation,
    }]
  })
}

function toneComboKey(combo: number[]): string {
  return combo.join("-")
}

function randomToneCombo(length: number): number[] {
  return Array.from({ length }, () => Math.floor(Math.random() * 4) + 1)
}

// Kata 1 suku kata: tetap 4 pilihan tunggal nada 1-4 (perilaku lama).
// Kata multi-suku-kata: jawaban adalah kombinasi nada penuh (mis. [3,3]),
// dan 3 distraktor kombinasi acak di-generate — dijamin beda dari jawaban
// benar & beda satu sama lain (dedup lewat Set), lalu diacak urutannya.
// Catatan: fungsi ini tetap kerja di level "kombinasi nada" (number[][])
// buat validasi benar/salah — konversi ke pinyin cuma soal tampilan,
// lihat comboToPinyin().
function generateChoices(correctTones: number[]): number[][] {
  if (correctTones.length === 1) {
    return [[1], [2], [3], [4]]
  }

  const seen = new Set<string>([toneComboKey(correctTones)])
  const distractors: number[][] = []
  let attempts = 0
  const maxAttempts = 500

  while (distractors.length < 3 && attempts < maxAttempts) {
    attempts++
    const combo = randomToneCombo(correctTones.length)
    const key = toneComboKey(combo)
    if (seen.has(key)) continue
    seen.add(key)
    distractors.push(combo)
  }

  const all = [correctTones, ...distractors]
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all
}

function toneCombosEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i])
}

export default function NadaPracticePage() {
  const params = useParams()
  const router = useRouter()
  const deckId = Number(params.id)
  const supa = useSupabase()

  const [cards, setCards] = React.useState<Card[]>([])
  const [loading, setLoading] = React.useState(true)
  const [idx, setIdx] = React.useState(0)
  const [selected, setSelected] = React.useState<number[] | null>(null)
  const [showResult, setShowResult] = React.useState(false)
  const [correct, setCorrect] = React.useState(0)
  const [done, setDone] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      const { data } = await supa
        .from("flashcard_cards")
        .select("id, hanzi, pinyin, arti")
        .eq("set_id", deckId)
        .order("created_at", { ascending: true })

      const rawCards = data ?? []

      const hanziList = rawCards.map(c => c.hanzi).filter(Boolean)
      const exampleMap = new Map<string, { hanzi: string; pinyin: string; arti: string }>()

      if (hanziList.length > 0) {
        await Promise.all(
          hanziList.map(async (hanzi) => {
            const [directRes, partialRes] = await Promise.all([
              supa.from("word_examples").select("id, hanzi, pinyin, arti").eq("word_hanzi", hanzi).order("id").limit(1),
              supa.from("word_examples").select("id, hanzi, pinyin, arti").ilike("hanzi", `%${hanzi}%`).order("id").limit(1),
            ])
            const first = directRes.data?.[0] ?? partialRes.data?.[0]
            if (first) {
              exampleMap.set(hanzi, { hanzi: first.hanzi ?? "", pinyin: first.pinyin ?? "", arti: first.arti ?? "" })
            }
          })
        )
      }

      const cardsWithExamples = rawCards.map(card => {
        const ex = card.hanzi ? exampleMap.get(card.hanzi) : undefined
        return {
          ...card,
          exampleSentence: ex?.hanzi,
          examplePinyin: ex?.pinyin,
          exampleTranslation: ex?.arti,
        }
      })

      setCards(buildWordCards(cardsWithExamples))
      setLoading(false)
    }
    load()
  }, [deckId, supa])

  const total = cards.length
  const q = cards[idx]
  const progress = total > 0 ? (idx / total) * 100 : 0

  const choices = React.useMemo(() => {
    if (!q) return []
    return generateChoices(q.tones)
  }, [idx, q])

  function handleSelect(combo: number[]) {
    if (showResult) return
    setSelected(combo)
    setShowResult(true)
    speakMandarin(q.hanzi)
    if (toneCombosEqual(combo, q.tones)) setCorrect(c => c + 1)
  }

  function handleNext() {
    if (idx + 1 >= total) setDone(true)
    else { setIdx(i => i + 1); setSelected(null); setShowResult(false) }
  }

  if (loading) {
    return <div className={styles.page}><div className="flex flex-1 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div></div>
  }

  if (done || total === 0) {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
    return (
      <div className={styles.page}>
        <div className="flex flex-col flex-1 items-center justify-center gap-8 p-8">
          <div className="text-6xl">{total === 0 ? "📭" : "🎵"}</div>
          <h2 className="text-3xl font-bold">{total === 0 ? "Tidak Ada Soal" : "Latihan Selesai!"}</h2>
          {total > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-3xl font-bold text-emerald-500">{correct}</span>
                  <span className="text-xs text-muted-foreground">Benar</span>
                </div>
                <div className="flex flex-col items-center p-5 rounded-2xl bg-red-500/10 border border-red-500/30">
                  <span className="text-3xl font-bold text-red-500">{total - correct}</span>
                  <span className="text-xs text-muted-foreground">Salah</span>
                </div>
              </div>
              <p className="text-2xl font-bold text-primary">{pct}%</p>
            </>
          )}
          <div className="flex gap-3 w-full max-w-xs">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => router.back()}>Kembali</Button>
            {total > 0 && <Button className="flex-1 rounded-xl" onClick={() => { setIdx(0); setDone(false); setCorrect(0); setSelected(null); setShowResult(false) }}>Ulangi</Button>}
          </div>
        </div>
      </div>
    )
  }

  const isMulti = q.tones.length > 1
  const isCorrectAnswer = selected ? toneCombosEqual(selected, q.tones) : false
  const hanziSizeClass = q.hanzi.length <= 2 ? "text-8xl" : q.hanzi.length <= 4 ? "text-6xl" : "text-4xl"

  return (
    <div className={styles.page}>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm text-muted-foreground font-medium tabular-nums shrink-0">{idx + 1}/{total}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">
            {isMulti ? "Pilih kombinasi nada yang benar" : "Pilih nada yang benar"}
          </p>

          <div className="flex flex-col items-center gap-3">
            <div className={`font-hanzi ${hanziSizeClass}`}>{q.hanzi}</div>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => speakMandarin(q.hanzi)}>
              <Volume2 className="h-4 w-4" /> Dengar
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {choices.map((combo, i) => {
              const isCorrect = toneCombosEqual(combo, q.tones)
              const isSelected = selected ? toneCombosEqual(selected, combo) : false
              let cls = "flex flex-col items-center gap-1 p-4 rounded-2xl border-2 text-sm font-semibold h-auto transition-all "
              if (!showResult) cls += "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              else if (isCorrect) cls += "border-emerald-500 bg-emerald-500/10 text-emerald-500"
              else if (isSelected && !isCorrect) cls += "border-red-500 bg-red-500/10 text-red-500"
              else cls += "border-border/30 bg-card/20 opacity-50"

              const choicePinyin = comboToPinyin(q.syllables, combo)

              return (
                <button key={i} className={cls} onClick={() => handleSelect(combo)} disabled={showResult}>
                  <div className="flex items-center gap-1.5">
                    {showResult && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-500" />}
                    <TonePinyin text={choicePinyin} className="text-lg font-bold" />
                  </div>
                  <span className="text-xs text-muted-foreground text-center leading-tight">
                    {combo.length === 1 ? TONE_LABELS[combo[0]] : combo.map(t => TONE_MARKS[t]).join(" ")}
                  </span>
                </button>
              )
            })}
          </div>

          {showResult && (
            <div className={`flex flex-col items-center gap-2 p-4 rounded-2xl w-full max-w-sm border ${isCorrectAnswer ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
              <p className={`font-bold text-lg ${isCorrectAnswer ? "text-emerald-500" : "text-red-400"}`}>
                {isCorrectAnswer ? "🎉 Benar!" : "❌ Salah"}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap justify-center">
                <span className="font-bold">{q.pinyin}</span>
                <span>-</span>
                <span className="flex items-center gap-1">
                  {q.tones.map((t, ti) => (
                    <span key={ti} className={`font-bold ${TONE_COLORS[t]}`}>{t}{ti < q.tones.length - 1 ? "-" : ""}</span>
                  ))}
                </span>
              </p>
            </div>
          )}

          {showResult && q.exampleSentence && (
            <div className="flex flex-col gap-1.5 p-4 rounded-2xl w-full max-w-sm border border-border/40 bg-muted/20">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Contoh · penggunaan
              </div>
              <div
                className="font-hanzi text-xl text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => speakMandarin(q.exampleSentence!)}
              >
                {q.exampleSentence}
              </div>
              {q.examplePinyin && (
                <TonePinyin text={q.examplePinyin} className="text-sm text-primary font-medium" />
              )}
              {q.exampleTranslation && (
                <div className="text-sm text-muted-foreground">{q.exampleTranslation}</div>
              )}
            </div>
          )}

          {showResult && (
            <Button className="w-full max-w-sm h-14 rounded-2xl font-bold text-base" onClick={handleNext}>
              {idx + 1 >= total ? "Lihat Hasil" : "Lanjut →"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}