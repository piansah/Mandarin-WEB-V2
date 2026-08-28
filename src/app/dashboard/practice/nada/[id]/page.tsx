"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Volume2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSupabase } from "@/hooks/use-supabase"
import { speakMandarin } from "@/lib/tts"
import styles from "./page.module.css"

type Card = {
  id: number
  hanzi: string
  pinyin: string
  arti: string
  nada: number
  originalWord: string
}

const TONE_COLORS: Record<number, string> = {
  1: "text-red-400", 2: "text-amber-400", 3: "text-green-400", 4: "text-sky-400", 0: "text-muted-foreground",
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

function splitToneCards(cards: Array<{ id: number; hanzi: string; pinyin: string; arti: string }>): Card[] {
  return cards.flatMap(card => {
    const hanziChars = [...card.hanzi].filter(char => {
      const code = char.charCodeAt(0)
      return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)
    })
    const syllables = splitPinyinSyllables(card.pinyin)

    return hanziChars.map((hanzi, index) => {
      const pinyin = syllables[index] ?? syllables[0] ?? card.pinyin
      return {
        id: card.id,
        hanzi,
        pinyin,
        arti: card.arti,
        nada: extractTone(pinyin),
        originalWord: card.hanzi,
      }
    })
  }).filter(card => card.nada > 0)
}

export default function NadaPracticePage() {
  const params = useParams()
  const router = useRouter()
  const deckId = Number(params.id)
  const supa = useSupabase()

  const [cards, setCards] = React.useState<Card[]>([])
  const [loading, setLoading] = React.useState(true)
  const [idx, setIdx] = React.useState(0)
  const [selected, setSelected] = React.useState<number | null>(null)
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
      setCards(splitToneCards(data ?? []))
      setLoading(false)
    }
    load()
  }, [deckId, supa])

  const total = cards.length
  const q = cards[idx]
  const progress = total > 0 ? (idx / total) * 100 : 0
  const choices = [1, 2, 3, 4]

  function handleSelect(tone: number) {
    if (showResult) return
    setSelected(tone)
    setShowResult(true)
    speakMandarin(q.hanzi)
    if (tone === q.nada) setCorrect(c => c + 1)
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
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Pilih nada yang benar</p>

          <div className="flex flex-col items-center gap-3">
            <div className="font-hanzi text-8xl">{q.hanzi}</div>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => speakMandarin(q.hanzi)}>
              <Volume2 className="h-4 w-4" /> Dengar
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {choices.map(tone => {
            const isCorrect = tone === q.nada
            const isSelected = selected === tone
            let cls = "flex flex-col items-center gap-1 p-4 rounded-2xl border-2 text-sm font-semibold h-auto transition-all "
            if (!showResult) cls += "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
            else if (isCorrect) cls += "border-emerald-500 bg-emerald-500/10 text-emerald-500"
            else if (isSelected && !isCorrect) cls += "border-red-500 bg-red-500/10 text-red-500"
            else cls += "border-border/30 bg-card/20 opacity-50"

            return (
              <button key={tone} className={cls} onClick={() => handleSelect(tone)} disabled={showResult}>
                <div className="flex items-center gap-1.5">
                  {showResult && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {showResult && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-500" />}
                  <span className={`text-lg font-bold ${TONE_COLORS[tone]}`}>{tone}</span>
                </div>
                <span className="text-xs text-muted-foreground text-center leading-tight">{TONE_LABELS[tone]}</span>
              </button>
            )
          })}
        </div>

        {showResult && (
          <div className={`flex flex-col items-center gap-2 p-4 rounded-2xl w-full max-w-sm border ${selected === q.nada ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
            <p className={`font-bold text-lg ${selected === q.nada ? "text-emerald-500" : "text-red-400"}`}>
              {selected === q.nada ? "🎉 Benar!" : "❌ Salah"}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className={`font-bold ${TONE_COLORS[q.nada]}`}>{q.pinyin}</span> - {TONE_LABELS[q.nada]}
            </p>
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
