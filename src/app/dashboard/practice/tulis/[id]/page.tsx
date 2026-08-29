"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  RotateCcw,
  Eye,
  Shield,
  Flame,
  ListChecks,
  CheckCircle2,
  XCircle,
  Layers,
  Inbox,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSupabase } from "@/hooks/use-supabase"
import { speakMandarin } from "@/lib/tts"
import { TonePinyin } from "@/components/tone-pinyin"
import styles from "./page.module.css"

type Card = {
  id: number
  hanzi: string           // kata/kosakata UTUH (mis. "你好"), bukan dipecah per suku kata
  chars: string[]         // karakter-karakter penyusun `hanzi`, ditulis berurutan dalam 1 kartu yang sama
  pinyin: string          // pinyin kata utuh
  arti: string
  exampleSentence?: string
  examplePinyin?: string
  exampleTranslation?: string
}

type HanziWriterLike = {
  quiz: (options: {
    onMistake?: (strokeData?: { totalMistakes?: number }) => void
    onCorrectStroke?: (strokeData?: { strokeNum?: number }) => void
    onComplete?: (summaryData?: { totalMistakes?: number }) => void
  }) => void
  animateCharacter: (options?: { onComplete?: () => void }) => void
}

// Badge hasil SVG (bukan emoji) — dipakai di layar akhir & state kosong,
// pola sama persis dengan ResultBadge di halaman Nada, biar ketiga
// halaman latihan (Nada/Flashcard/Tulis) konsisten secara visual.
function CompletionBadge({ clean }: { clean: boolean }) {
  return (
    <div className="relative flex items-center justify-center h-14 w-14">
      {clean && (
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full text-emerald-500 animate-in zoom-in-50 fade-in duration-500"
        >
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2
            const x1 = 50 + Math.cos(angle) * 36
            const y1 = 50 + Math.sin(angle) * 36
            const x2 = 50 + Math.cos(angle) * 47
            const y2 = 50 + Math.sin(angle) * 47
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                opacity={0.55}
              />
            )
          })}
        </svg>
      )}
      <div
        className={`relative z-10 flex items-center justify-center h-11 w-11 rounded-full animate-in zoom-in-75 duration-300 ${clean ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-400"
          }`}
      >
        {clean ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
      </div>
    </div>
  )
}

export default function TulisHanziPage() {
  const params = useParams()
  const router = useRouter()
  const deckId = Number(params.id)
  const supa = useSupabase()

  const [cards, setCards] = React.useState<Card[]>([])
  const [loading, setLoading] = React.useState(true)
  const [idx, setIdx] = React.useState(0)
  // Posisi karakter yang sedang ditulis DI DALAM kosakata `idx` saat ini
  // (mis. kosakata "你好" -> charIdx 0 = "你", charIdx 1 = "好"). Reset ke 0
  // tiap kali pindah ke kosakata berikutnya.
  const [charIdx, setCharIdx] = React.useState(0)
  const [done, setDone] = React.useState(false)
  const [deckTitle, setDeckTitle] = React.useState("Latihan Menulis")
  const [deckLevel, setDeckLevel] = React.useState("")

  // `correct` = total karakter yang sudah DISELESAIKAN (benar/salah tetap
  // dihitung selesai). `cleanCount` = subset yang selesai TANPA satu pun
  // kesalahan goresan — inilah yang dipakai sebagai "akurasi" sesungguhnya,
  // karena writer.quiz tetap membiarkan user coba lagi sampai benar, jadi
  // "selesai" saja tidak berarti "bersih".
  const [correct, setCorrect] = React.useState(0)
  const [cleanCount, setCleanCount] = React.useState(0)
  const [answered, setAnswered] = React.useState(0)
  const [streak, setStreak] = React.useState(0)

  const [writerReady, setWriterReady] = React.useState(false)
  const [strictMode, setStrictMode] = React.useState(false)
  const [hintPlaying, setHintPlaying] = React.useState(false)
  const [mistakeCount, setMistakeCount] = React.useState(0)

  // Progres goresan karakter yang sedang berjalan — dipakai buat indikator
  // "goresan x/y" di atas kanvas, bukan cuma "selesai / belum".
  const [strokeCount, setStrokeCount] = React.useState<number | null>(null)
  const [strokeProgress, setStrokeProgress] = React.useState(0)

  const [resultRingValue, setResultRingValue] = React.useState(0)
  const prefersReducedMotionRef = React.useRef(false)

  const writerRef = React.useRef<HanziWriterLike | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const strictModeRef = React.useRef(false)
  const mistakeRef = React.useRef(0)        // mistake beruntun di goresan SEKARANG (buat retry strict-mode)
  const charMistakesRef = React.useRef(0)   // total mistake sepanjang karakter INI SAJA (buat cek "bersih" per karakter)
  const wordMistakesRef = React.useRef(0)   // akumulasi mistake sepanjang KOSAKATA ini (semua karakternya)
  const cancelledRef = React.useRef(false)
  const idxRef = React.useRef(0)
  const charIdxRef = React.useRef(0)
  const totalRef = React.useRef(0)

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
        setDeckTitle(setData.title ?? "Latihan Menulis")
        const parts = [setData.description, setData.hsk_level ? `HSK ${setData.hsk_level}` : null].filter(Boolean)
        setDeckLevel(parts.length > 0 ? parts.join(" - ") : "")
      }

      const { data } = await supa
        .from("flashcard_cards")
        .select("id, hanzi, pinyin, arti")
        .eq("set_id", deckId)
        .order("created_at", { ascending: true })

      const rawCards = data ?? []

      // Ambil contoh kalimat per KATA ASAL (bukan per karakter) — sama
      // persis pola di halaman Nada — supaya tiap karakter yang berasal
      // dari kata yang sama menunjukkan contoh kalimat yang sama juga.
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

      // Satu baris kosakata = SATU kartu, bukan dipecah per suku kata/karakter.
      // Karakter penyusunnya (`chars`) tetap ditulis berurutan satu-satu di
      // kanvas yang sama, tapi progres "Sisa Kartu" & hitungan sesi tetap
      // dihitung per KOSAKATA UTUH, bukan per karakter di dalamnya.
      const parsed: Card[] = []
      for (const c of rawCards) {
        const ex = c.hanzi ? exampleMap.get(c.hanzi) : undefined
        const chars = [...c.hanzi].filter(char => {
          const code = char.charCodeAt(0)
          return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)
        })
        if (chars.length === 0) continue
        parsed.push({
          id: c.id,
          hanzi: c.hanzi,
          chars,
          pinyin: c.pinyin,
          arti: c.arti,
          exampleSentence: ex?.hanzi,
          examplePinyin: ex?.pinyin,
          exampleTranslation: ex?.arti,
        })
      }

      setCards(parsed)
      totalRef.current = parsed.length
      setLoading(false)
    }
    load()
  }, [deckId, supa])

  const card = cards[idx]
  const total = cards.length
  const progress = total > 0 ? (idx / total) * 100 : 0
  const accuracy = answered > 0 ? Math.round((cleanCount / answered) * 100) : 0

  function startQuiz(writer: HanziWriterLike, currentCard: Card, chIdx: number) {
    if (!writer) return
    mistakeRef.current = 0
    charMistakesRef.current = 0
    setMistakeCount(0)
    setStrokeProgress(0)

    writer.quiz({
      onMistake: (strokeData) => {
        const currentStrokeMistakes = mistakeRef.current + 1
        mistakeRef.current = currentStrokeMistakes
        charMistakesRef.current += 1
        setMistakeCount(currentStrokeMistakes)

        if (strictModeRef.current && currentStrokeMistakes >= 3) {
          mistakeRef.current = 0
          setMistakeCount(0)
          initWriter(currentCard, chIdx)
        }
      },
      onCorrectStroke: () => {
        mistakeRef.current = 0
        setMistakeCount(0)
        setStrokeProgress(p => p + 1)
      },
      onComplete: () => {
        if (cancelledRef.current) return

        const isLastChar = chIdx >= currentCard.chars.length - 1

        if (!isLastChar) {
          // Masih ada karakter berikutnya DI KOSAKATA YANG SAMA — lanjut
          // tanpa menambah hitungan kartu/progres, kosakata dianggap satu
          // unit utuh sampai semua karakternya selesai ditulis.
          wordMistakesRef.current += charMistakesRef.current
          setTimeout(() => {
            if (cancelledRef.current) return
            setCharIdx(chIdx + 1)
          }, 500)
          return
        }

        // Karakter terakhir kosakata ini selesai — baru di sini kosakata
        // dihitung "selesai" dan pengucapan kata UTUH diputar.
        speakMandarin(currentCard.hanzi)

        const isClean = wordMistakesRef.current + charMistakesRef.current === 0
        setAnswered(a => a + 1)
        setCorrect(c => c + 1)
        if (isClean) {
          setCleanCount(c => c + 1)
          setStreak(s => s + 1)
        } else {
          setStreak(0)
        }

        setTimeout(() => {
          if (cancelledRef.current) return
          const nextIdx = idxRef.current + 1
          if (nextIdx >= totalRef.current) {
            setDone(true)
          } else {
            setIdx(nextIdx)
            setCharIdx(0)
          }
        }, 1200)
      },
    })
  }

  function initWriter(currentCard: Card, chIdx: number) {
    const char = currentCard.chars[chIdx]
    if (!containerRef.current || !char) return
    setWriterReady(false)
    setHintPlaying(false)
    setStrokeCount(null)
    setStrokeProgress(0)
    containerRef.current.innerHTML = ""
    mistakeRef.current = 0
    charMistakesRef.current = 0
    setMistakeCount(0)
    if (chIdx === 0) wordMistakesRef.current = 0

    const targetDiv = document.createElement("div")
    containerRef.current.appendChild(targetDiv)

    import("hanzi-writer").then(({ default: HanziWriter }) => {
      if (cancelledRef.current || !containerRef.current) return

      const writer = HanziWriter.create(targetDiv, char, {
        width: 260,
        height: 260,
        padding: 26,
        strokeColor: "#e8e8f4",
        outlineColor: strictModeRef.current ? "rgba(0,0,0,0)" : "#2a2a3e",
        drawingColor: "#4ade80",
        drawingWidth: 6,
        showOutline: !strictModeRef.current,
        showCharacter: false,
        highlightOnComplete: true,
        highlightColor: "#4ade80",
      })
      writerRef.current = writer
      setWriterReady(true)

      // Jumlah goresan karakter — cuma buat badge "N Goresan" & progres
      // "x/y", tidak mempengaruhi penilaian quiz sama sekali. Tipe return
      // asli library ini `Promise<void | CharacterJson>` (bisa `void`
      // kalau gagal dimuat), jadi di-guard dulu sebelum diakses.
      HanziWriter.loadCharacterData(char)
        .then((charData: void | { strokes: string[] }) => {
          if (!cancelledRef.current && charData && Array.isArray(charData.strokes)) {
            setStrokeCount(charData.strokes.length)
          }
        })
        .catch(() => { /* badge goresan opsional, aman kalau gagal dimuat */ })

      startQuiz(writer, currentCard, chIdx)
    })
  }

  React.useEffect(() => {
    idxRef.current = idx
    charIdxRef.current = charIdx
    const currentCard = cards[idx]
    if (!currentCard?.chars[charIdx] || !containerRef.current || loading) return
    cancelledRef.current = false
    initWriter(currentCard, charIdx)
    return () => { cancelledRef.current = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, idx, charIdx, loading])

  function handleClear() {
    if (!card) return
    initWriter(card, charIdx)
  }

  function handleHint() {
    if (!writerRef.current || hintPlaying || !card) return
    setHintPlaying(true)
    writerRef.current.animateCharacter({
      onComplete: () => {
        setHintPlaying(false)
        if (writerRef.current) startQuiz(writerRef.current, card, charIdx)
      },
    })
  }

  function handleStrictMode() {
    const next = !strictMode
    setStrictMode(next)
    strictModeRef.current = next
    if (card) initWriter(card, charIdx)
  }

  function restart() {
    setIdx(0)
    setCharIdx(0)
    setDone(false)
    setCorrect(0)
    setCleanCount(0)
    setAnswered(0)
    setStreak(0)
  }

  // Shortcut keyboard: Space = panduan animasi (paling sering dipakai
  // pas macet), R = ulangi karakter, S = Strict Mode — semua di-skip
  // kalau fokus lagi di input/textarea (tidak ada di halaman ini, tapi
  // jaga konsisten dgn pola Nada/Flashcard).
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return
      if (!card || done || loading) return

      if (e.code === "Space") {
        e.preventDefault()
        handleHint()
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault()
        handleClear()
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault()
        handleStrictMode()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, done, loading, hintPlaying, strictMode])

  // Animasikan ring akurasi di layar akhir, sama persis pola di Nada.
  React.useEffect(() => {
    if (!done || total === 0) {
      setResultRingValue(0)
      return
    }
    const target = Math.round((cleanCount / total) * 100)

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
  }, [done, total, cleanCount])

  if (loading) {
    return <div className={styles.page}><div className="flex flex-1 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div></div>
  }

  if (done || total === 0) {
    const pct = total > 0 ? Math.round((cleanCount / total) * 100) : 0
    const withMistakes = correct - cleanCount
    const ringColor = pct >= 80 ? "#34d399" : pct >= 50 ? "#f59e0b" : "#f87171"
    const circumference = 2 * Math.PI * 54
    const ringOffset = circumference - (resultRingValue / 100) * circumference

    return (
      <div className={styles.page}>
        <div className="flex flex-col flex-1 relative z-10 min-h-0">
          <div className="tulis-result relative flex flex-col flex-1 items-center justify-center gap-7 p-8 overflow-hidden min-h-0">
            {total === 0 ? (
              <>
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-muted/40 text-muted-foreground">
                  <Inbox className="h-8 w-8" />
                </div>
                <h2 className="text-3xl font-bold text-center">Belum Ada Kartu</h2>
                <Button variant="outline" className="rounded-2xl px-8" onClick={() => router.back()}>Kembali</Button>
              </>
            ) : (
              <>
                {/*
                  Watermark 写 ("menulis") — versi identitas halaman Tulis
                  sendiri, sejalan dengan pattern watermark 完 (Flashcard)
                  dan 调 (Nada), biar konsisten tanpa niru mentah-mentah.
                */}
                <div
                  aria-hidden="true"
                  className="tulis-result-watermark absolute select-none pointer-events-none font-hanzi text-foreground/[0.05] dark:text-foreground/[0.07]"
                  style={{ fontSize: "16rem", lineHeight: 1, top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
                >
                  写
                </div>

                <div className="tulis-result-title flex flex-col items-center gap-1 relative z-10">
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Latihan Selesai!</h2>
                  <p className="text-sm text-muted-foreground">{total} kosakata ditulis</p>
                </div>

                <div className="tulis-result-ring relative z-10 flex items-center justify-center">
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
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Akurasi Bersih</span>
                  </div>
                </div>

                {/*
                  "Bersih" (selesai tanpa satu pun kesalahan goresan) vs
                  "Ada Salah" (selesai tapi sempat salah goresan) — biner
                  yang lebih relevan buat latihan menulis dibanding cuma
                  "total selesai", sama semangatnya dengan Benar/Salah di
                  Nada.
                */}
                <div className="tulis-result-stats flex flex-wrap justify-center gap-2 relative z-10">
                  <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /></span>
                    <span className="text-sm font-semibold text-emerald-500 tabular-nums">{cleanCount}</span>
                    <span className="text-xs text-muted-foreground">Bersih</span>
                  </div>
                  <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/15 text-amber-400"><XCircle className="h-3.5 w-3.5" /></span>
                    <span className="text-sm font-semibold text-amber-400 tabular-nums">{withMistakes}</span>
                    <span className="text-xs text-muted-foreground">Ada Salah</span>
                  </div>
                </div>

                <div className="tulis-result-actions flex gap-3 w-full max-w-xs relative z-10 mb-6">
                  <Button variant="outline" className="flex-1 rounded-2xl h-11" onClick={() => router.back()}>Kembali</Button>
                  <Button className="flex-1 rounded-2xl h-11 shadow-sm" onClick={restart}>Ulangi</Button>
                </div>
              </>
            )}
          </div>

          <style dangerouslySetInnerHTML={{
            __html: `
            .tulis-result { animation: tulisResultEnter 520ms cubic-bezier(.22,1,.36,1) both; }
            .tulis-result-watermark { animation: tulisWatermarkFade 900ms ease 80ms both; }
            .tulis-result-title { animation: tulisResultRise 420ms cubic-bezier(.22,1,.36,1) 80ms both; }
            .tulis-result-ring { animation: tulisResultPop 620ms cubic-bezier(.2,1.4,.4,1) 200ms both; }
            .tulis-result-stats { animation: tulisResultRise 420ms cubic-bezier(.22,1,.36,1) 360ms both; }
            .tulis-result-actions { animation: tulisResultRise 420ms cubic-bezier(.22,1,.36,1) 460ms both; }
            @keyframes tulisResultEnter { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes tulisResultPop { 0% { opacity: 0; transform: translateY(10px) scale(.8); } 70% { opacity: 1; transform: translateY(0) scale(1.05); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes tulisResultRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes tulisWatermarkFade { from { opacity: 0; } to { opacity: 1; } }
            @media (prefers-reduced-motion: reduce) {
              .tulis-result, .tulis-result-watermark, .tulis-result-title, .tulis-result-ring, .tulis-result-stats, .tulis-result-actions {
                animation: none !important;
              }
            }
          ` }} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className="flex flex-col flex-1 relative z-10 min-h-0">
        {/* Header judul deck + grid statistik — pola identik Nada/Flashcard */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <div className="mb-2">
            <h1 className="text-lg font-bold text-foreground">{deckTitle}</h1>
            {deckLevel && <p className="text-xs text-muted-foreground">{deckLevel}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
            <div className="flex flex-col gap-1">
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
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Flame className="h-3 w-3" />
                <span className="hidden sm:inline">Bersih </span>Beruntun
              </div>
              <div className="text-sm font-semibold text-foreground">{streak}</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListChecks className="h-3 w-3" />
                Sisa Kartu
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

        {/*
          Satu kolom vertikal: info kosakata -> kanvas -> tombol kontrol ->
          contoh kalimat di paling bawah. Contoh kalimat sengaja diletakkan
          SETELAH tombol (bukan jadi kolom sisi kanan) supaya alur baca
          konsisten satu arah dari atas ke bawah, dan kolom kanan yang
          kosong di desktop nggak bikin layout terasa timpang.
        */}
        <div className="flex-1 flex flex-col items-center justify-start gap-5 px-4 sm:px-6 pt-4 md:pt-8 pb-4">
          <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-4">
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="flex items-center gap-2">
                <span className="font-hanzi text-3xl text-foreground">{card.hanzi}</span>
                {strokeCount !== null && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    {strokeCount} Goresan
                  </span>
                )}
              </div>
              {/*
                Kosakata multi-karakter (mis. "你好") ditulis satu-satu di
                kanvas yang sama tapi tetap dihitung SATU kartu — indikator
                ini menandai karakter mana yang sedang aktif ditulis.
              */}
              {card.chars.length > 1 && (
                <div className="flex items-center gap-1.5 font-hanzi text-lg">
                  {card.chars.map((ch, i) => (
                    <span
                      key={i}
                      className={
                        i === charIdx
                          ? "text-primary font-semibold"
                          : i < charIdx
                            ? "text-muted-foreground/40"
                            : "text-muted-foreground/70"
                      }
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              )}
              <TonePinyin text={card.pinyin} className="text-lg text-primary font-medium" />
              <span className="text-base text-muted-foreground">{card.arti}</span>
            </div>

            {/* Canvas */}
            <div className="relative rounded-3xl border-2 border-border/50 bg-card/60 p-3 shadow-xl">
              <div ref={containerRef} className="w-[260px] h-[260px]" />
              {!writerReady && (
                <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-card">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                </div>
              )}
              {hintPlaying && (
                <div className="absolute top-3 left-3 bg-primary/20 border border-primary/40 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                  PANDUAN
                </div>
              )}
              {strictMode && (
                <div className="absolute top-3 right-3 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  STRICT
                </div>
              )}
              {/*
                Indikator goresan salah SEKARANG — sebelumnya cuma tampil
                di strict mode. Sekarang selalu tampil kalau ada
                kesalahan, karena feedback stroke-level ini berguna buat
                siapa saja, bukan cuma pas strict mode aktif.
              */}
              {mistakeCount > 0 && (
                <div className="absolute bottom-3 left-3 flex gap-1">
                  {[1, 2, 3].map(n => (
                    <div key={n} className={`h-2.5 w-2.5 rounded-full ${mistakeCount >= n ? "bg-red-500" : "bg-muted"}`} />
                  ))}
                </div>
              )}
              {/* Progres goresan benar sejauh ini, mis. "3/7 goresan" */}
              {strokeCount !== null && writerReady && !hintPlaying && (
                <div className="absolute bottom-3 right-3 text-[11px] font-semibold text-muted-foreground tabular-nums bg-card/80 px-2 py-0.5 rounded-full border border-border/40">
                  {strokeProgress}/{strokeCount}
                </div>
              )}
            </div>

            {/* 3 tombol kontrol berlabel (Jiplak dihapus — redundan dgn Strict) */}
            <div className="grid grid-cols-3 w-full gap-2 pt-1">
              <button
                onClick={handleClear}
                title="Ulangi karakter ini (R)"
                aria-label="Ulangi karakter ini"
                className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border border-border/60 bg-card text-muted-foreground shadow-sm transition-all hover:border-primary/50 hover:text-foreground active:scale-95"
              >
                <RotateCcw className="h-5 w-5" />
                <span className="text-[10px] font-medium">Ulangi</span>
              </button>

              <button
                onClick={handleHint}
                disabled={hintPlaying || !writerReady}
                title="Tampilkan panduan animasi (Space)"
                aria-label="Tampilkan panduan animasi"
                className={`flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${hintPlaying
                    ? "border-primary/60 bg-primary/20 text-primary"
                    : "border-border/60 bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
              >
                <Eye className="h-5 w-5" />
                <span className="text-[10px] font-medium">Panduan</span>
              </button>

              <button
                onClick={handleStrictMode}
                title="Strict Mode: sembunyikan panduan garis (S)"
                aria-label="Strict Mode"
                className={`flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border shadow-sm transition-all active:scale-95 ${strictMode
                    ? "border-amber-500/60 bg-amber-500/20 text-amber-400"
                    : "border-border/60 bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
              >
                <Shield className="h-5 w-5" />
                <span className="text-[10px] font-medium">Strict</span>
              </button>
            </div>

            {/* Contoh penggunaan — di bawah tombol, cuma render kalau ada datanya */}
            {card.exampleSentence && (
              <div className="w-full flex flex-col gap-1.5 p-4 rounded-2xl border border-border/40 bg-muted/20">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Contoh · penggunaan
                </div>
                <div
                  className="font-hanzi text-2xl text-foreground cursor-pointer hover:text-primary transition-colors"
                  onClick={() => speakMandarin(card.exampleSentence!)}
                >
                  {card.exampleSentence}
                </div>
                {card.examplePinyin && (
                  <TonePinyin text={card.examplePinyin} className="text-sm text-primary font-medium" />
                )}
                {card.exampleTranslation && (
                  <div className="text-sm text-muted-foreground">{card.exampleTranslation}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}