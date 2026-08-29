"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Volume2, CheckCircle2, XCircle, Flame, ListChecks } from "lucide-react"
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

// Pecah SATU token (hasil split spasi) jadi satu atau lebih suku kata.
// Penting: token seperti "kèqi" atau "guānxi" itu 2 suku kata yang
// nempel tanpa spasi (umum buat kata majemuk 2-karakter), jadi tetap
// harus dipecah lebih lanjut lewat algoritma ini, bukan diperlakukan
// sebagai 1 suku kata utuh.
function splitSyllableToken(token: string): string[] {
  const vowels = "aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ"
  const initials = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s", "y", "w"]
  const syllables: string[] = []
  let pos = 0

  while (pos < token.length) {
    let end = pos
    const rest = token.slice(pos).toLowerCase()
    const initial = initials.find(ini => rest.startsWith(ini))
    if (initial) end += initial.length

    let hasVowel = false
    while (end < token.length && vowels.includes(token[end].toLowerCase())) {
      hasVowel = true
      end++
    }

    if (hasVowel && end < token.length) {
      const tail = token.slice(end).toLowerCase()
      if (tail.startsWith("ng")) end += 2
      else if ((tail[0] === "n" || tail[0] === "r") && !vowels.includes(tail[1] || "")) end += 1
    }

    if (end <= pos) break
    syllables.push(token.slice(pos, end))
    pos = end
  }

  return syllables.length ? syllables : [token]
}

// Pecah pinyin utuh sebuah kata jadi array per-suku-kata. Dipisah spasi
// dulu (kalau ada), TAPI tiap token hasil split itu tetap diproses lewat
// splitSyllableToken — supaya token gabungan seperti "kèqi" (客气) atau
// "guānxi" (关系) tetap kepecah jadi ["kè","qi"] / ["guān","xi"], bukan
// dianggap 1 suku kata utuh cuma karena ada spasi di bagian lain string.
// Sebelumnya, begitu ADA spasi di mana pun dalam string, seluruh string
// langsung di-split-spasi tanpa pemecahan lebih lanjut — itu bikin jumlah
// suku kata < jumlah karakter hanzi untuk kata 3+ karakter, dan tone
// karakter belakangan salah dipetakan (fallback ke suku kata pertama).
function splitPinyinSyllables(pinyin: string): string[] {
  const trimmed = pinyin.trim()
  if (!trimmed) return []
  return trimmed.split(/\s+/).filter(Boolean).flatMap(splitSyllableToken)
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

    // Kalau jumlah suku kata hasil parsing tetap tidak pas dengan jumlah
    // karakter hanzi (mis. data pinyin di database memang tidak lengkap/
    // rusak), JANGAN fallback diam-diam ke syllables[0] — itu dulu bikin
    // karakter belakangan kartu 3+ suku kata salah dapat tone (lihat bug
    // 不客气 / 没关系). Lebih aman skip kartu ini dari kuis nada.
    if (syllables.length !== hanziChars.length) return []

    const tones = syllables.map(extractTone)
    const baseSyllables = syllables.map(stripToneMarks)

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
  const [deckTitle, setDeckTitle] = React.useState("Latihan Nada")
  const [deckLevel, setDeckLevel] = React.useState("")
  // Berapa soal sudah dijawab (benar + salah) — dipakai buat akurasi sesi
  // real-time di header, terpisah dari `idx` karena `idx` cuma nunjukin
  // posisi soal, bukan berapa yang sudah benar-benar dijawab.
  const [answered, setAnswered] = React.useState(0)
  // Benar beruntun (reset ke 0 begitu salah satu kali) — metrik yang lebih
  // relevan buat drilling nada dibanding stat SRS ala flashcard.
  const [streak, setStreak] = React.useState(0)
  // Nilai yang dianimasikan naik ke akurasi final di layar "Latihan
  // Selesai" (lihat effect animasi di bawah).
  const [resultRingValue, setResultRingValue] = React.useState(0)
  const prefersReducedMotionRef = React.useRef(false)

  React.useEffect(() => {
    prefersReducedMotionRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  React.useEffect(() => {
    async function load() {
      const { data: setData } = await supa
        .from("flashcard_sets")
        .select("title, description, hsk_level")
        .eq("id", deckId)
        .maybeSingle()

      if (setData) {
        setDeckTitle(setData.title ?? "Latihan Nada")
        const parts = [setData.description, setData.hsk_level ? `HSK ${setData.hsk_level}` : null].filter(Boolean)
        setDeckLevel(parts.length > 0 ? parts.join(" - ") : "")
      }

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
    setAnswered(a => a + 1)
    speakMandarin(q.hanzi)
    if (toneCombosEqual(combo, q.tones)) {
      setCorrect(c => c + 1)
      setStreak(s => s + 1)
    } else {
      setStreak(0)
    }
  }

  function handleNext() {
    if (idx + 1 >= total) setDone(true)
    else { setIdx(i => i + 1); setSelected(null); setShowResult(false) }
  }

  function restart() {
    setIdx(0)
    setDone(false)
    setCorrect(0)
    setSelected(null)
    setShowResult(false)
    setStreak(0)
    setAnswered(0)
  }

  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0

  // Shortcut keyboard: Space/Enter buat lanjut ke soal berikutnya setelah
  // jawaban ditampilkan (paralel sama pola flip flashcard), dan angka
  // 1-4 buat langsung pilih jawaban sesuai POSISI di grid 2x2 (bukan
  // makna rating seperti di flashcard — di sini benar-benar cuma memilih
  // kotak ke berapa) selama belum menjawab.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return
      if (!q || done) return

      if (showResult) {
        if (e.code === "Space" || e.key === "Enter") {
          e.preventDefault()
          handleNext()
        }
        return
      }

      const posByKey: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 }
      const pos = posByKey[e.key]
      if (pos !== undefined && choices[pos]) {
        e.preventDefault()
        handleSelect(choices[pos])
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [q, done, showResult, choices, idx])

  // Animasikan ring akurasi di layar "Latihan Selesai" begitu sesi tuntas.
  React.useEffect(() => {
    if (!done || total === 0) {
      setResultRingValue(0)
      return
    }
    const target = Math.round((correct / total) * 100)

    if (prefersReducedMotionRef.current) {
      setResultRingValue(target)
      return
    }

    setResultRingValue(0)
    let raf = 0
    const start = performance.now()
    const duration = 900
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setResultRingValue(Math.round(eased * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    const delay = setTimeout(() => { raf = requestAnimationFrame(tick) }, 150)
    return () => { clearTimeout(delay); if (raf) cancelAnimationFrame(raf) }
  }, [done, total, correct])

  if (loading) {
    return <div className={styles.page}><div className="flex flex-1 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div></div>
  }

  if (done || total === 0) {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
    const wrong = total - correct
    const ringColor = pct >= 80 ? "#34d399" : pct >= 50 ? "#f59e0b" : "#f87171"
    const circumference = 2 * Math.PI * 54
    const ringOffset = circumference - (resultRingValue / 100) * circumference

    return (
      <div className={styles.page}>
        <div className="flex flex-col flex-1 relative z-10 min-h-0">
          <div className="nada-result relative flex flex-col flex-1 items-center justify-center gap-7 p-8 overflow-hidden min-h-0">
            {total === 0 ? (
              <>
                <div className="text-6xl">📭</div>
                <h2 className="text-3xl font-bold text-center">Tidak Ada Soal</h2>
                <Button variant="outline" className="rounded-2xl px-8" onClick={() => router.back()}>Kembali</Button>
              </>
            ) : (
              <>
                {/*
                  Watermark 调 (nada) — versi identitas halaman ini sendiri
                  dari pattern watermark 完 yang dipakai flashcard, biar
                  nggak sekadar niru mentah-mentah.
                */}
                <div
                  aria-hidden="true"
                  className="nada-result-watermark absolute select-none pointer-events-none font-hanzi text-foreground/[0.05] dark:text-foreground/[0.07]"
                  style={{ fontSize: "16rem", lineHeight: 1, top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
                >
                  调
                </div>

                <div className="nada-result-title flex flex-col items-center gap-1 relative z-10">
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Latihan Selesai!</h2>
                  <p className="text-sm text-muted-foreground">{total} soal dijawab</p>
                </div>

                <div className="nada-result-ring relative z-10 flex items-center justify-center">
                  <svg width="152" height="152" viewBox="0 0 120 120" className="-rotate-90">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/60" />
                    <circle
                      cx="60" cy="60" r="54" fill="none"
                      stroke={ringColor}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={ringOffset}
                      style={{ transition: "stroke 400ms ease" }}
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-bold text-foreground tabular-nums">{resultRingValue}%</span>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Akurasi</span>
                  </div>
                </div>

                {/*
                  Sengaja cuma 2 kategori (Benar/Salah), bukan 4 kayak
                  flashcard — nada practice ini biner (jawaban benar atau
                  salah), bukan skala kesulitan subjektif kayak rating
                  Mudah/Ingat/Sulit/Lupa di flashcard.
                */}
                <div className="nada-result-stats flex flex-wrap justify-center gap-2 relative z-10">
                  <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /></span>
                    <span className="text-sm font-semibold text-emerald-500 tabular-nums">{correct}</span>
                    <span className="text-xs text-muted-foreground">Benar</span>
                  </div>
                  <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/25">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-red-500/15 text-red-500"><XCircle className="h-3.5 w-3.5" /></span>
                    <span className="text-sm font-semibold text-red-500 tabular-nums">{wrong}</span>
                    <span className="text-xs text-muted-foreground">Salah</span>
                  </div>
                </div>

                <div className="nada-result-actions flex gap-3 w-full max-w-xs relative z-10 mb-6">
                  <Button variant="outline" className="flex-1 rounded-2xl h-11" onClick={() => router.back()}>Kembali</Button>
                  <Button className="flex-1 rounded-2xl h-11 shadow-sm" onClick={restart}>Ulangi</Button>
                </div>
              </>
            )}
          </div>

          <style dangerouslySetInnerHTML={{
            __html: `
            .nada-result { animation: nadaResultEnter 520ms cubic-bezier(.22,1,.36,1) both; }
            .nada-result-watermark { animation: nadaWatermarkFade 900ms ease 80ms both; }
            .nada-result-title { animation: nadaResultRise 420ms cubic-bezier(.22,1,.36,1) 80ms both; }
            .nada-result-ring { animation: nadaResultPop 620ms cubic-bezier(.2,1.4,.4,1) 200ms both; }
            .nada-result-stats { animation: nadaResultRise 420ms cubic-bezier(.22,1,.36,1) 360ms both; }
            .nada-result-actions { animation: nadaResultRise 420ms cubic-bezier(.22,1,.36,1) 460ms both; }
            @keyframes nadaResultEnter { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes nadaResultPop { 0% { opacity: 0; transform: translateY(10px) scale(.8); } 70% { opacity: 1; transform: translateY(0) scale(1.05); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes nadaResultRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes nadaWatermarkFade { from { opacity: 0; } to { opacity: 1; } }
            @media (prefers-reduced-motion: reduce) {
              .nada-result, .nada-result-watermark, .nada-result-title, .nada-result-ring, .nada-result-stats, .nada-result-actions {
                animation: none !important;
              }
            }
          ` }} />
        </div>
      </div>
    )
  }

  const isMulti = q.tones.length > 1
  const isCorrectAnswer = selected ? toneCombosEqual(selected, q.tones) : false
  const hanziSizeClass = q.hanzi.length <= 2 ? "text-8xl" : q.hanzi.length <= 4 ? "text-6xl" : "text-4xl"

  return (
    <div className={styles.page}>
      <div className="flex flex-col flex-1 relative z-10 min-h-0">
        {/*
          Header judul deck + grid statistik, pola sama dengan
          swipe-flashcard-session (title/subtitle di atas, lalu grid
          statistik di dalam kotak muted). Cuma 3 stat (bukan 4 kayak
          flashcard) karena "Jatuh Tempo"/"Sudah Dikuasai" itu SRS-specific
          dan nggak relevan buat kuis nada yang sifatnya cepat & biner:
          - Akurasi Sesi: satu-satunya yang 1:1 sama relevansinya dgn flashcard
          - Benar Beruntun: metrik konsistensi yang lebih pas buat drilling
            pola nada dibanding stat SRS
          - Sisa Soal: total - idx, info praktis "berapa lagi"
        */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <div className="mb-2">
            <h1 className="text-lg font-bold text-foreground">{deckTitle}</h1>
            {deckLevel && <p className="text-xs text-muted-foreground">{deckLevel}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
            <div className={`${styles.statsCard} flex flex-col gap-1`}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                Akurasi Sesi
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${accuracy}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-foreground">{accuracy}%</span>
              </div>
            </div>
            <div className={`${styles.statsCard} flex flex-col gap-1`}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Flame className="h-3 w-3" />
                Benar Beruntun
              </div>
              <div className="text-sm font-semibold text-foreground">{streak}</div>
            </div>
            <div className={`${styles.statsCard} flex flex-col gap-1`}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListChecks className="h-3 w-3" />
                Sisa Soal
              </div>
              <div className="text-sm font-semibold text-foreground">{total - idx}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 pt-2 pb-2 shrink-0">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm text-muted-foreground font-medium tabular-nums shrink-0">{idx + 1}/{total}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 sm:px-6 py-4">
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">
            {isMulti ? "Pilih kombinasi nada yang benar" : "Pilih nada yang benar"}
          </p>

          {/*
            Layout responsif: 1 kolom di mobile (persis perilaku lama —
            hanzi di atas, grid 2x2 pilihan di bawah, semua max-w-sm
            center), tapi di layar md+ jadi 2 kolom berdampingan (hanzi
            kiri, grid 2x2 pilihan kanan) sesuai sketsa referensi — biar
            nggak numpuk vertikal terus dan kerasa penuh layar di desktop,
            bukannya kepusat sempit di tengah dengan banyak ruang kosong
            kiri-kanan.
          */}
          <div className="w-full max-w-sm md:max-w-4xl mx-auto flex flex-col gap-4 md:gap-5">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-4 md:gap-5">
              {/* Kartu Hanzi */}
              <div className="relative w-full max-w-sm mx-auto md:max-w-none md:mx-0">
                {/*
                  Ghost stack — dua lapis kartu statis di belakang, offset
                  dikit & diperkecil, murni dekorasi (aria-hidden). Tidak
                  terikat ke state apa pun (tidak ada flip/swipe di halaman
                  ini) — cukup untuk memberi kesan "ada soal lain menumpuk
                  di belakang", sama seperti di flashcard.
                */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-3xl border border-border/30 bg-card/70"
                  style={{ transform: "translate(0px, 14px) scale(0.96)", zIndex: 0 }}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-3xl border border-border/20 bg-card/40"
                  style={{ transform: "translate(0px, 26px) scale(0.92)", zIndex: -1 }}
                />

                <div className="relative z-10 flex flex-col items-center justify-center gap-3 py-10 px-8 md:h-full rounded-3xl border border-border/40 bg-gradient-to-br from-card to-card/80 shadow-2xl overflow-hidden">
                  <div
                    aria-hidden="true"
                    className="absolute -right-6 -bottom-8 select-none pointer-events-none font-hanzi text-foreground/[0.07] dark:text-foreground/[0.1]"
                    style={{ fontSize: "8rem", lineHeight: 1, transform: "scaleX(-1) rotate(-8deg)" }}
                  >
                    {q.hanzi}
                  </div>
                  <div className={`relative font-hanzi ${hanziSizeClass}`}>{q.hanzi}</div>
                  <Button variant="ghost" size="sm" className="relative gap-1.5" onClick={() => speakMandarin(q.hanzi)}>
                    <Volume2 className="h-4 w-4" /> Dengar
                  </Button>
                </div>
              </div>

              {/* Grid 2x2 pilihan jawaban */}
              <div className="grid grid-cols-2 md:auto-rows-fr gap-3 w-full max-w-sm mx-auto md:max-w-none md:mx-0 md:h-full">
                {choices.map((combo, i) => {
                  const isCorrect = toneCombosEqual(combo, q.tones)
                  const isSelected = selected ? toneCombosEqual(selected, combo) : false
                  let cls = "flex flex-col items-center gap-1 p-4 rounded-2xl border-2 text-sm font-semibold h-auto transition-all duration-200 "
                  if (!showResult) {
                    cls += "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-primary/5 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] cursor-pointer"
                  } else if (isCorrect) {
                    cls += `border-emerald-500 bg-emerald-500/10 text-emerald-500 ${isSelected ? "scale-105 shadow-lg" : ""}`
                  } else if (isSelected && !isCorrect) {
                    cls += "border-red-500 bg-red-500/10 text-red-500 scale-105 shadow-lg"
                  } else {
                    cls += "border-border/30 bg-card/20 opacity-50"
                  }

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
            </div>

            {showResult && (
              <div className={`flex flex-col items-center gap-2 p-4 rounded-2xl w-full border ${isCorrectAnswer ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
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
              <div className="flex flex-col gap-1.5 p-4 rounded-2xl w-full border border-border/40 bg-muted/20">
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
              <Button className="w-full h-14 rounded-2xl font-bold text-base" onClick={handleNext}>
                {idx + 1 >= total ? "Lihat Hasil" : "Lanjut →"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}