"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { CheckCircle2, RotateCcw, SkipForward } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { speakMandarin } from "@/lib/tts"
import { saveUserScore } from "@/lib/user-scores"
import { shuffle } from "@/lib/array-utils"
import { PracticeHeader } from "@/components/practice-header"
import styles from "../../[key]/page.module.css"

type HanziItem = {
  id: number
  section_label: string
  section_tag: string
  sort_order: number
  hanzi: string
  pinyin: string
  arti: string
  user_contribution: boolean | null
}

type QuizQuestion = {
  gi: number
  si: number
  q: string
  opts: string[]
  ans: number
  selectedIdx?: number
}

type Answered = Record<number, boolean>
type TabId = "all" | 0 | 1 | 2 | 3

const SECTION_META = [
  { label: "1", title: "Hanzi → Pilih Arti", sub: "Hanzi → pilih arti Indonesia" },
  { label: "2", title: "Pinyin → Pilih Arti", sub: "Pinyin berwarna → pilih arti" },
  { label: "3", title: "Hanzi → Pilih Pinyin", sub: "Hanzi → pilih pinyin yang tepat" },
  { label: "4", title: "Lengkapi Kalimat Hanzi", sub: "Pilih kata yang tepat untuk melengkapi" },
]

const toneMapC: Record<string, string> = {
  ā:"tone1",á:"tone2",ǎ:"tone3",à:"tone4",
  ē:"tone1",é:"tone2",ě:"tone3",è:"tone4",
  ī:"tone1",í:"tone2",ǐ:"tone3",ì:"tone4",
  ō:"tone1",ó:"tone2",ǒ:"tone3",ò:"tone4",
  ū:"tone1",ú:"tone2",ǔ:"tone3",ù:"tone4",
  ǖ:"tone1",ǘ:"tone2",ǚ:"tone3",ǜ:"tone4",
}

function splitPy(word: string) {
  return word.match(/[bpmfdtnlgkhjqxzcsryw]{0,2}[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜaeiouü]+(?:ng?|r)?/gi) ?? [word]
}

function ColorPy({ text }: { text: string }) {
  return <>{text.split(/(\s+|[,!.?·。，！？、；：()]+)/).map((part, pi) => {
    if (!part || /^(\s+|[,!.?·。，！？、；：()]+)$/.test(part)) return <React.Fragment key={pi}>{part}</React.Fragment>
    return splitPy(part).map((syl, si) => {
      const tone = [...syl].map(c => toneMapC[c]).find(Boolean) ?? "tone0"
      return <span key={`${syl}-${si}`} className={styles[tone as "tone1"]}>{syl}</span>
    })
  })}</>
}

function RumpangText({ text }: { text: string }) {
  const parts: Array<{ type: "text" | "blank" | "hz" | "lat"; content: string }> = []
  let remaining = text.replace(/_{4,}/g, "\x00BLANK\x00")

  while (remaining.length > 0) {
    if (remaining.startsWith("\x00BLANK\x00")) {
      parts.push({ type: "blank", content: "" })
      remaining = remaining.slice("\x00BLANK\x00".length)
    } else {
      const hzMatch = remaining.match(/^[\u4e00-\u9fff\u3400-\u4dbf\uff01-\uff5e\u3001-\u303f\u300c-\u300f]+/)
      const latMatch = remaining.match(/^\(([^)]+)\)/)
      if (hzMatch) {
        parts.push({ type: "hz", content: hzMatch[0] })
        remaining = remaining.slice(hzMatch[0].length)
      } else if (latMatch) {
        parts.push({ type: "lat", content: latMatch[1] })
        remaining = remaining.slice(latMatch[0].length)
      } else {
        parts.push({ type: "text", content: remaining[0] })
        remaining = remaining.slice(1)
      }
    }
  }

  return <span className={styles.qRumpang}>{parts.map((p, i) => {
    if (p.type === "blank") return <span key={i} className={styles.blank} />
    if (p.type === "hz") return <span key={i} className={styles.hz}>{p.content}</span>
    if (p.type === "lat") return <span key={i} className={styles.lat}>({p.content})</span>
    return <span key={i}>{p.content}</span>
  })}</span>
}

function getRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = shuffle([...arr])
  return shuffled.slice(0, count)
}

function buildKalimatQuiz(items: HanziItem[]): QuizQuestion[] {
  const all: QuizQuestion[] = []
  let gi = 0

  // Filter kalimat yang cukup panjang untuk kalimat rumpang (>= 2 kata)
  const longSentences = items.filter(item => {
    const words = item.hanzi.match(/[\u4e00-\u9fff\u3400-\u4dbf]+/g) ?? []
    return words.length >= 2
  })

  // Kalimat pendek (tidak cocok untuk kalimat rumpang)
  const shortSentences = items.filter(item => {
    const words = item.hanzi.match(/[\u4e00-\u9fff\u3400-\u4dbf]+/g) ?? []
    return words.length < 2
  })

  // Shuffle masing-masing grup
  const shuffledLong = shuffle([...longSentences])
  const shuffledShort = shuffle([...shortSentences])

  // Hitung target per section (1/4 dari total items)
  const targetPerSection = Math.ceil(items.length / 4)

  // Section 4: Kalimat Rumpang (utamakan kalimat panjang)
  const section4Items = shuffledLong.slice(0, targetPerSection)
  for (const item of section4Items) {
    // Split kalimat menjadi tokens (kata + punctuation) untuk presisi
    const tokens: { type: 'word' | 'punct', text: string }[] = []
    let remaining = item.hanzi
    while (remaining.length > 0) {
      // Cek punctuation dulu
      const punctMatch = remaining.match(/^[，。！？、；：,!?;:]+/)
      if (punctMatch) {
        tokens.push({ type: 'punct', text: punctMatch[0] })
        remaining = remaining.slice(punctMatch[0].length)
        continue
      }
      // Cek spasi
      const spaceMatch = remaining.match(/^\s+/)
      if (spaceMatch) {
        tokens.push({ type: 'punct', text: spaceMatch[0] })
        remaining = remaining.slice(spaceMatch[0].length)
        continue
      }
      // Ambil kata (hanzi characters)
      const wordMatch = remaining.match(/^[\u4e00-\u9fff\u3400-\u4dbf]+/)
      if (wordMatch) {
        tokens.push({ type: 'word', text: wordMatch[0] })
        remaining = remaining.slice(wordMatch[0].length)
        continue
      }
      // Fallback untuk karakter lain
      tokens.push({ type: 'punct', text: remaining[0] })
      remaining = remaining.slice(1)
    }

    const wordTokens = tokens.filter(t => t.type === 'word')
    if (wordTokens.length < 2) continue // Skip jika kurang dari 2 kata

    // Pilih 1 kata random untuk di-blank
    const blankIndex = Math.floor(Math.random() * wordTokens.length)
    const blankToken = wordTokens[blankIndex]

    // Blank kan kata tersebut di token array
    const blankedTokens = tokens.map(t =>
      t.type === 'word' && t.text === blankToken.text ? { ...t, text: '____' } : t
    )

    // Reconstruct kalimat dengan blank
    const blankedSentence = blankedTokens.map(t => t.text).join('')

    // Generate distractor dari kata-kata lain di set yang sama
    const allWords = items.flatMap(i => {
      const t: { type: 'word' | 'punct', text: string }[] = []
      let r = i.hanzi
      while (r.length > 0) {
        const w = r.match(/^[\u4e00-\u9fff\u3400-\u4dbf]+/)
        if (w) { t.push({ type: 'word', text: w[0] }); r = r.slice(w[0].length) }
        else { r = r.slice(1) }
      }
      return t.filter(x => x.type === 'word').map(x => x.text)
    })
    const distractors = getRandomItems(allWords.filter(w => w !== blankToken.text), 3)
    const options = shuffle([blankToken.text, ...distractors])

    all.push({
      gi: gi++,
      si: 3,
      q: blankedSentence,
      opts: options,
      ans: options.indexOf(blankToken.text),
    })
  }

  // Sisa kalimat panjang + kalimat pendek untuk section 1, 2, 3
  const remainingLong = shuffledLong.slice(targetPerSection)
  const remainingItems = shuffle([...remainingLong, ...shuffledShort])

  // Bagi sisa items menjadi 3 chunk untuk section 1, 2, 3
  const chunkSize13 = Math.ceil(remainingItems.length / 3)
  const chunk1 = remainingItems.slice(0, chunkSize13)
  const chunk2 = remainingItems.slice(chunkSize13, chunkSize13 * 2)
  const chunk3 = remainingItems.slice(chunkSize13 * 2)

  // Section 1: Hanzi → Arti
  for (const item of chunk1) {
    const distractors = getRandomItems(items.filter(i => i.id !== item.id), 3).map(i => i.arti)
    const options = shuffle([item.arti, ...distractors])
    all.push({
      gi: gi++,
      si: 0,
      q: item.hanzi,
      opts: options,
      ans: options.indexOf(item.arti),
    })
  }

  // Section 2: Pinyin → Arti
  for (const item of chunk2) {
    const distractors = getRandomItems(items.filter(i => i.id !== item.id), 3).map(i => i.arti)
    const options = shuffle([item.arti, ...distractors])
    all.push({
      gi: gi++,
      si: 1,
      q: item.pinyin,
      opts: options,
      ans: options.indexOf(item.arti),
    })
  }

  // Section 3: Hanzi → Pinyin
  for (const item of chunk3) {
    const distractors = getRandomItems(items.filter(i => i.id !== item.id), 3).map(i => i.pinyin)
    const options = shuffle([item.pinyin, ...distractors])
    all.push({
      gi: gi++,
      si: 2,
      q: item.hanzi,
      opts: options,
      ans: options.indexOf(item.pinyin),
    })
  }

  return all
}

function getGrade(pct: number, title: string) {
  if (pct >= 90) return { grade: `Luar Biasa! ${title.split("—")[0].trim()} dikuasai!`, msg: "Penguasaan kalimat sangat baik. Siap lanjut ke level berikutnya!" }
  if (pct >= 80) return { grade: "Bagus! Pemahaman kalimat kuat.", msg: "Hampir sempurna! Review kalimat yang salah lalu lanjut." }
  if (pct >= 70) return { grade: "Cukup Baik — Perlu Sedikit Review", msg: "Review Estafet untuk set ini dulu, lalu coba lagi." }
  if (pct >= 60) return { grade: "Perlu Review Lebih Banyak", msg: "Kembali ke Estafet, baca ulang kalimatnya, lalu coba lagi." }
  return { grade: "Review Lebih Banyak Dulu", msg: "Kembali ke Estafet, lalu coba lagi. Pelan-pelan pasti bisa!" }
}

export default function CumulativeQuizPracticePage() {
  const { key } = useParams<{ key: string }>()
  const router = useRouter()
  const supa = useSupabase()

  const [loading, setLoading] = React.useState(true)
  const [quizTitle, setQuizTitle] = React.useState("")
  const [quizSub, setQuizSub] = React.useState("")
  const [allQ, setAllQ] = React.useState<QuizQuestion[]>([])
  const [answered, setAnswered] = React.useState<Answered>({})
  const [submitted, setSubmitted] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<TabId>("all")

  const [filterOpen, setFilterOpen] = React.useState(false)
  const filterRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener("pointerdown", handler)
    return () => document.removeEventListener("pointerdown", handler)
  }, [])

  const total = allQ.length
  const totalAnswered = Object.keys(answered).length
  const totalCorrect = Object.values(answered).filter(Boolean).length
  const progress = total > 0 ? (totalAnswered / total) * 100 : 0

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)

      try {
        const saved = JSON.parse(localStorage.getItem("hsk_kal_state") ?? "{}")
        const state = saved[key]
        const savedQ = state?.allQ
        const savedAnswered = state?.answered ?? {}
        // Cek apakah data masih valid (dalam 24 jam) atau sudah di-submit (history permanen)
        const hoursDiff = state?.timestamp
          ? (Date.now() - state.timestamp) / (1000 * 60 * 60)
          : 0
        if (Array.isArray(savedQ) && savedQ.length > 0 && (state?.submitted || hoursDiff < 24)) {
          const meta = await supa.from("hanzi_sets").select("title,sub").eq("key", key).single()
          if (!cancelled) {
            if (meta.data) {
              setQuizTitle(meta.data.title)
              setQuizSub(meta.data.sub)
            }
            setAllQ(savedQ)
            setAnswered(savedAnswered)
            setSubmitted(Boolean(state.submitted))
            setLoading(false)
          }
          return
        }
        // Data expired dan belum di-submit — hapus entry lama
        if (state) {
          delete saved[key]
          localStorage.setItem("hsk_kal_state", JSON.stringify(saved))
        }
      } catch {}

      const [metaRes, itemsRes] = await Promise.all([
        supa.from("hanzi_sets").select("title,sub").eq("key", key).single(),
        supa
          .from("hanzi_items")
          .select("id, section_label, section_tag, sort_order, hanzi, pinyin, arti, user_contribution")
          .eq("hanzi_key", key)
          .order("sort_order", { ascending: true }),
      ])

      if (cancelled) return
      if (metaRes.error) {
        console.error("Error loading hanzi_sets:", metaRes.error)
        setLoading(false)
        return
      }
      if (itemsRes.error) {
        console.error("Error loading hanzi_items:", itemsRes.error)
        setLoading(false)
        return
      }

      const built = buildKalimatQuiz((itemsRes.data ?? []) as HanziItem[])
      const saved = JSON.parse(localStorage.getItem("hsk_kal_state") ?? "{}")
      // Simpan dengan timestamp agar bisa di-expire setelah 24 jam
      saved[key] = { allQ: built, answered: {}, submitted: false, timestamp: Date.now() }
      localStorage.setItem("hsk_kal_state", JSON.stringify(saved))

      setQuizTitle(metaRes.data.title)
      setQuizSub(metaRes.data.sub)
      setAllQ(built)
      setAnswered({})
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [key, supa])

  function selectAns(gi: number, sel: number, cor: number) {
    if (answered[gi] !== undefined) return
    const isCorrect = sel === cor
    const updatedQ = [...allQ]
    updatedQ[gi] = { ...updatedQ[gi], selectedIdx: sel }
    const updatedAns = { ...answered, [gi]: isCorrect }

    setAllQ(updatedQ)
    setAnswered(updatedAns)

    const saved = JSON.parse(localStorage.getItem("hsk_kal_state") ?? "{}")
    if (saved[key]) {
      saved[key].allQ = updatedQ
      saved[key].answered = updatedAns
      saved[key].timestamp = Date.now()
      localStorage.setItem("hsk_kal_state", JSON.stringify(saved))
    }

    const q = allQ[gi]
    if (q.si !== 1) {
      let speech = q.q.replace(/<[^>]+>/g, "").replace(/\([^)]+\)/g, "")
      if (q.si === 3) speech = speech.replace(/_{4,}/g, q.opts[cor])
      speakMandarin(speech)
    }
  }

  function replayQuestion(gi: number) {
    const q = allQ[gi]
    if (!q || answered[gi] === undefined || q.si === 1) return
    let speech = q.q.replace(/<[^>]+>/g, "").replace(/\([^)]+\)/g, "")
    if (q.si === 3) speech = speech.replace(/_{4,}/g, q.opts[q.ans])
    speakMandarin(speech)
  }

  function handleSubmit() {
    setSubmitted(true)
    const saved = JSON.parse(localStorage.getItem("hsk_kal_state") ?? "{}")
    if (saved[key]) {
      saved[key].submitted = true
      localStorage.setItem("hsk_kal_state", JSON.stringify(saved))
    }
    // Calculate percentage based on answered questions
    const pct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0
    saveUserScore("kal", key, pct).catch(() => {})
  }

  function handleRetry() {
    setAnswered({})
    setSubmitted(false)
    // Reset card selectedIdx in allQ
    const resetQ = allQ.map(q => ({ ...q, selectedIdx: undefined }))
    setAllQ(resetQ)
    // Update localStorage
    const saved = JSON.parse(localStorage.getItem("hsk_kal_state") ?? "{}")
    if (saved[key]) {
      saved[key].allQ = resetQ
      saved[key].answered = {}
      saved[key].submitted = false
      saved[key].timestamp = Date.now()
      localStorage.setItem("hsk_kal_state", JSON.stringify(saved))
    }
  }

  // Scroll ke kartu pertama yang benar-benar tampil di layar (bukan card-0),
  // karena gi Bagian 4 dibuat lebih dulu sehingga card-0 ada di Bagian 4.
  function scrollToFirstQuestion() {
    // Scroll ke posisi 0 (bukan scrollIntoView) supaya kartu pertama tidak
    // tertutup header sticky. Cari ancestor yang benar-benar bisa di-scroll.
    const firstCard = document.querySelector<HTMLElement>('[id^="card-"]')
    let el: HTMLElement | null = firstCard?.parentElement ?? null
    while (el && el !== document.body) {
      const { overflowY } = getComputedStyle(el)
      if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
        el.scrollTo({ top: 0, behavior: "smooth" })
        break
      }
      el = el.parentElement
    }
    // Selalu scroll window juga (aman kalau window yang scroll)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Scroll ke soal pertama setelah dibuka / kembali dari result screen
  React.useEffect(() => {
    if (!submitted && allQ.length > 0) {
      const timer = setTimeout(scrollToFirstQuestion, 300)
      return () => clearTimeout(timer)
    }
  }, [submitted, allQ.length])

  function handleReset() {
    setAnswered({})
    // Reset card selectedIdx in allQ
    const resetQ = allQ.map(q => ({ ...q, selectedIdx: undefined }))
    setAllQ(resetQ)
    // Scroll to first question card (soal 1 Bagian 1)
    setTimeout(scrollToFirstQuestion, 100)
    // Update localStorage
    const saved = JSON.parse(localStorage.getItem("hsk_kal_state") ?? "{}")
    if (saved[key]) {
      saved[key].allQ = resetQ
      saved[key].answered = {}
      saved[key].timestamp = Date.now()
      localStorage.setItem("hsk_kal_state", JSON.stringify(saved))
    }
  }

  /* ── Result screen ── */
  if (!loading && submitted) {
    const skip = total - totalAnswered
    const wrong = totalAnswered - totalCorrect
    // Calculate percentage based on answered questions, not total questions
    const pct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0
    const { msg } = getGrade(pct, quizTitle)
    const pctColor = pct >= 80 ? "#4ade80" : pct >= 60 ? "#e8d23e" : "#f87171"
    const circumference = 2 * Math.PI * 54
    const ringOffset = circumference - (pct / 100) * circumference

    return (
      <div className={styles.page}>
        <div className="flashcard-result relative flex flex-col flex-1 items-center justify-center gap-7 p-8 bg-background overflow-hidden min-h-0">
          <div
            aria-hidden="true"
            className="absolute select-none pointer-events-none font-hanzi text-foreground/[0.05] dark:text-foreground/[0.07]"
            style={{
              fontSize: "16rem",
              lineHeight: 1,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            完
          </div>

          <div className="flex flex-col items-center gap-1 relative z-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Sesi Selesai!</h2>
            <p className="text-sm text-muted-foreground">{total} soal dijawab</p>
          </div>

          <div className="relative z-10 flex items-center justify-center">
            <svg width="152" height="152" viewBox="0 0 120 120" className="-rotate-90">
              <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/60" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke={pctColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={ringOffset}
                style={{ transition: "stroke 400ms ease" }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-bold text-foreground tabular-nums">{pct}%</span>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Akurasi</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 relative z-10">
            <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /></span>
              <span className="text-sm font-semibold text-emerald-500 tabular-nums">{totalCorrect}</span>
              <span className="text-xs text-muted-foreground">Benar</span>
            </div>
            <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/25">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-red-500/15 text-red-500"><RotateCcw className="h-3.5 w-3.5" /></span>
              <span className="text-sm font-semibold text-red-500 tabular-nums">{wrong}</span>
              <span className="text-xs text-muted-foreground">Salah</span>
            </div>
            <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/15 text-amber-500"><SkipForward className="h-3.5 w-3.5" /></span>
              <span className="text-sm font-semibold text-amber-500 tabular-nums">{skip}</span>
              <span className="text-xs text-muted-foreground">Dilewati</span>
            </div>
          </div>

          <div className="relative z-10 w-full max-w-xs">
            <div className="mb-4 px-4 py-3 rounded-xl bg-muted/40 border border-border/40 text-xs text-muted-foreground text-center leading-relaxed">
              {msg}
            </div>
            <div className="flex gap-3">
              <button className="flex-1 rounded-2xl h-11 border border-border/60 bg-background hover:bg-muted/50 transition-colors" onClick={() => router.back()}>Kembali</button>
              <button className="flex-1 rounded-2xl h-11 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors" onClick={handleRetry}>Ulangi</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className={styles.page} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh" }}>
        <div>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #17344a", borderTopColor: "#42d6a4", animation: "spin 0.8s linear infinite" }} />
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  /* ── Error (empty) ── */
  if (allQ.length === 0) {
    return (
      <div className={styles.page} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 48 }}>📭</div>
        <div>Soal quiz kumulatif tidak ditemukan.</div>
        <button className={styles.btnBack} onClick={() => router.back()}>Kembali</button>
      </div>
    )
  }

  /* ── Main Quiz ── */
  const visibleSections = [0, 1, 2, 3].filter(si => activeTab === "all" || activeTab === si)

  return (
    <div className={styles.page}>
      {/* Wrapper flex sama seperti halaman quiz biasa */}
      <div className="flex flex-col flex-1 select-none relative z-10 min-h-0">
        <PracticeHeader
          title={quizTitle || "Quiz Kumulatif"}
          subtitle={quizSub}
          progress={progress}
          rightContent={`${totalCorrect}/${totalAnswered}`}
          showStats={false}
        />

        <div ref={filterRef} className={styles.filterWrap}>
          <button
            type="button"
            className={styles.filterBtn}
            onClick={() => setFilterOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
          >
            {activeTab === "all" ? "Semua Bagian" : `Bagian ${(activeTab as number) + 1}`}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: filterOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {filterOpen && (
            <div className={styles.filterMenu} role="listbox">
              {([["all", "Semua Bagian"], [0, "Bagian 1"], [1, "Bagian 2"], [2, "Bagian 3"], [3, "Bagian 4"]] as const).map(([t, lbl]) => (
                <button
                  key={String(t)}
                  type="button"
                  role="option"
                  aria-selected={activeTab === t}
                  className={`${styles.filterItem} ${activeTab === t ? styles.filterItemActive : ""}`}
                  onClick={() => { setActiveTab(t); setFilterOpen(false) }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.main}>
          {visibleSections.map(si => {
            const sq = allQ.filter(q => q.si === si)
            if (!sq.length) return null
            const previousCount = allQ.filter(q => q.si < si).length
            const offset = activeTab === "all" ? previousCount : 0
            const meta = SECTION_META[si]

            return (
              <React.Fragment key={si}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionNum}>{meta.label}</div>
                  <div>
                    <div className={styles.sectionTitle}>{meta.title}</div>
                    <div className={styles.sectionSub}>{meta.sub}</div>
                  </div>
                  <div className={styles.sectionRange}>
                    {activeTab === "all" ? `${previousCount + 1}–${previousCount + sq.length}` : `1–${sq.length}`}
                  </div>
                </div>

                {sq.map((q, li) => (
                  <QuizCard
                    key={q.gi}
                    q={q}
                    num={offset + li + 1}
                    isAnswered={answered[q.gi] !== undefined}
                    isCorrect={answered[q.gi]}
                    onSelect={sel => selectAns(q.gi, sel, q.ans)}
                    onReplay={() => replayQuestion(q.gi)}
                  />
                ))}
              </React.Fragment>
            )
          })}
        </div>

        {/* submitPanel dipindah keluar dari .main (sama seperti halaman quiz biasa) */}
        <div className={styles.submitPanel}>
          <div className={styles.liveInfo}>
            <div className={styles.liveTxt}>{totalAnswered} / {total} dijawab</div>
            <div className={styles.liveScore}>{totalCorrect} benar</div>
          </div>
          <div className="flex gap-2 w-full">
            <button
              type="button"
              className={styles.resetBtn}
              style={{ flex: 1, minWidth: 0 }}
              onClick={handleReset}
            >
              Ulangi
            </button>
            {!submitted && (
              <button
                type="button"
                className={styles.submitBtn}
                style={{ flex: 1, minWidth: 0 }}
                onClick={handleSubmit}
              >
                Selesai
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function QuizCard({
  q, num, isAnswered, isCorrect, onSelect, onReplay,
}: {
  q: QuizQuestion
  num: number
  isAnswered: boolean
  isCorrect: boolean | undefined
  onSelect: (sel: number) => void
  onReplay: () => void
}) {
  const labs = ["A", "B", "C", "D"]
  const cardClass = !isAnswered ? styles.qCard : isCorrect ? `${styles.qCard} ${styles.qCardCorrect}` : `${styles.qCard} ${styles.qCardWrong}`

  return (
    <div id={`card-${q.gi}`} className={`${cardClass} ${isAnswered && q.si !== 1 ? styles.qCardReplay : ""}`} onClick={isAnswered && q.si !== 1 ? onReplay : undefined}>
      <div className={styles.qTop}>
        <span className={styles.qNum}>{num}</span>
        <div className={styles.qText}>
          {/* Semua bagian memakai gaya yang sama dengan Bagian 4 (RumpangText / qRumpang) */}
          {(q.si === 0 || q.si === 2 || q.si === 3) && <RumpangText text={q.q} />}
          {q.si === 1 && (
            <span className={styles.qRumpang}>
              {/* Bagian 2: sedikit lebih kecil (relatif ke ukuran qRumpang) dan italic */}
              <span style={{ fontSize: "0.88em", fontStyle: "italic" }}>
                <ColorPy text={q.q} />
              </span>
            </span>
          )}
        </div>
      </div>

      <div className={styles.options}>
        {q.opts.map((opt, i) => {
          let optClass = `${styles.opt} ${styles.optHanzi}`
          if (isAnswered) {
            if (i === q.ans) optClass += isCorrect ? ` ${styles.optCorrect}` : ` ${styles.optShowCorrect}`
            else if (i === q.selectedIdx && !isCorrect) optClass += ` ${styles.optWrong}`
          }
          const optText = q.si === 3 && (q.q.match(/_{4,}/g) || []).length >= 2 ? opt.split(" ").join("，") : opt
          const optContent = q.si === 2 ? <ColorPy text={optText} /> : optText

          return (
            <button key={i} id={`opt-${q.gi}-${i}`} className={optClass} disabled={isAnswered} onClick={(event) => { event.stopPropagation(); onSelect(i) }}>
              <span className={styles.optLbl}>{labs[i]}</span>
              <span>{optContent}</span>
            </button>
          )
        })}
      </div>

      {isAnswered && (
        <div className={`${styles.fb} ${isCorrect ? styles.fbCorrect : styles.fbWrong}`}>
          {isCorrect ? "✓ Benar!" : `✗ Salah. Jawaban: ${labs[q.ans]}`}
        </div>
      )}
    </div>
  )
}