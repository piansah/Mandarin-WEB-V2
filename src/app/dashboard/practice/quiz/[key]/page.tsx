"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { X, RotateCcw, SkipForward, CheckCircle2 } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { speakMandarin } from "@/lib/tts"
import { Button } from "@/components/ui/button"
import { PracticeHeader } from "@/components/practice-header"
import { saveUserScore } from "@/lib/user-scores"
import styles from "./page.module.css"

/* ── Types ── */
type QuizSection = "A" | "B" | "C" | "D"

type RawQuestion = {
  section: QuizSection
  sort_order: number
  question: string
  options: string[]
  answer_index: number
}

type QuizQuestion = {
  gi: number          // global index (0-99)
  si: number          // section index (0-3)
  q: string           // question text
  opts: string[]      // shuffled options
  ans: number         // correct option index (after shuffle)
  selectedIdx?: number
}

type QuizData = {
  title: string
  sub: string
  A: RawQuestion[]
  B: RawQuestion[]
  C: RawQuestion[]
  D: RawQuestion[]
}

type Answered = Record<number, boolean> // gi → correct?

type TabId = "all" | 0 | 1 | 2 | 3

/* ── Tone-coloring (inline, no extra import needed) ── */
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

/* ── Rumpang renderer ── */
function RumpangText({ text }: { text: string }) {
  // Split on blanks, hanzi, latin hints
  const parts: Array<{ type: "text" | "blank" | "hz" | "lat"; content: string }> = []
  let remaining = text.replace(/_{2,}/g, "\x00BLANK\x00")

  // Tokenize step by step
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

  return <span className={styles.qRumpang}>
    {parts.map((p, i) => {
      if (p.type === "blank") return <span key={i} className={styles.blank} />
      if (p.type === "hz") return <span key={i} className={styles.hz}>{p.content}</span>
      if (p.type === "lat") return <span key={i} className={styles.lat}>({p.content})</span>
      return <span key={i}>{p.content}</span>
    })}
  </span>
}

import { shuffle } from "@/lib/array-utils"

/* ── Build quiz from raw data ── */
function buildQuiz(data: QuizData): QuizQuestion[] {
  const sections = [
    { si: 0, raw: data.A },
    { si: 1, raw: data.B },
    { si: 2, raw: data.C },
    { si: 3, raw: data.D },
  ]
  const all: QuizQuestion[] = []
  let gi = 0
  for (const { si, raw } of sections) {
    // Shuffle first 20, keep 21-25 in place (like reference)
    const shuffled = [...shuffle(raw.slice(0, 20)), ...raw.slice(20)]
    for (const q of shuffled) {
      const idxArr = [0, 1, 2, 3].slice(0, q.options.length)
      const si2 = shuffle(idxArr)
      all.push({
        gi: gi++,
        si,
        q: q.question,
        opts: si2.map(i => q.options[i]),
        ans: si2.indexOf(q.answer_index),
      })
    }
  }
  return all
}

/* ── Section metadata ── */
const SECTION_META = [
  { label: "1", title: "Hanzi → Arti Indonesia", sub: "Hanzi → pilih arti Indonesia" },
  { label: "2", title: "Pinyin → Arti Indonesia", sub: "Pinyin berwarna → pilih arti" },
  { label: "3", title: "Hanzi → Pilih Pinyin",   sub: "Hanzi → Pilih Pinyin yang tepat" },
  { label: "4", title: "Kalimat Rumpang",         sub: "Pilih kata yang tepat untuk melengkapi" },
]

/* ── Grade helper ── */
function getGrade(pct: number, title: string) {
  if (pct >= 90) return { emoji: "⭐", grade: `Luar Biasa! ${title.split("—")[0].trim()} dikuasai!`, msg: "Penguasaan hari ini sangat baik. Gas lanjut!" }
  if (pct >= 80) return { emoji: "✅", grade: "Bagus! Fondasi kuat.", msg: "Hampir sempurna! Review soal yang salah, lalu lanjut." }
  if (pct >= 70) return { emoji: "📘", grade: "Cukup Baik — Perlu Sedikit Review", msg: "Sudah cukup! Review Pleco dulu lalu coba lagi. Target 80%+." }
  if (pct >= 60) return { emoji: "⚠️", grade: "Perlu Review Lebih Banyak", msg: "Review modul dan Pleco 15 menit dulu. Coba lagi!" }
  return { emoji: "🔄", grade: "Review Dulu Sebelum Lanjut", msg: "Kembali ke modul, review Pleco, lalu coba lagi. Pelan-pelan pasti bisa!" }
}

/* ── Main component ── */
export default function QuizPage() {
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

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener("pointerdown", handler)
    return () => document.removeEventListener("pointerdown", handler)
  }, [])

  const totalAnswered = Object.keys(answered).length
  const totalCorrect = Object.values(answered).filter(Boolean).length
  const progress = (totalAnswered / 100) * 100

  /* ── Load quiz from Supabase ── */
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)

      // Try restore from localStorage first
      try {
        const saved = JSON.parse(localStorage.getItem("hsk_quiz_state") ?? "{}")
        const state = saved[key]
        if (state?.allQ?.length === 100) {
          if (!cancelled) {
            setAllQ(state.allQ)
            setAnswered(state.answered ?? {})
            if (state.submitted) setSubmitted(true)
            setLoading(false)
          }
          // Still load title in background
          const meta = await supa.from("quiz_sets").select("title,sub").eq("key", key).single()
          if (!cancelled && meta.data) { setQuizTitle(meta.data.title); setQuizSub(meta.data.sub) }
          return
        }
      } catch { /* ignore */ }

      const [metaRes, questRes] = await Promise.all([
        supa.from("quiz_sets").select("title,sub").eq("key", key).single(),
        supa.from("quiz_questions")
          .select("section,sort_order,question,options,answer_index")
          .eq("quiz_key", key)
          .order("section").order("sort_order"),
      ])

      if (cancelled) return
      if (metaRes.error || questRes.error) {
        setLoading(false)
        return
      }

      const data: QuizData = { title: metaRes.data.title, sub: metaRes.data.sub, A: [], B: [], C: [], D: [] }
      for (const row of questRes.data as RawQuestion[]) {
        if (data[row.section]) data[row.section].push(row)
      }

      const built = buildQuiz(data)
      const initAnswered: Answered = {}

      // Persist to localStorage
      const saved = JSON.parse(localStorage.getItem("hsk_quiz_state") ?? "{}")
      saved[key] = { allQ: built, answered: initAnswered, submitted: false }
      localStorage.setItem("hsk_quiz_state", JSON.stringify(saved))

      setQuizTitle(data.title)
      setQuizSub(data.sub)
      setAllQ(built)
      setAnswered(initAnswered)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [key, supa])

  /* ── Select answer ── */
  function selectAns(gi: number, sel: number, cor: number) {
    if (answered[gi] !== undefined) return
    const isCorrect = sel === cor
    const updatedQ = [...allQ]
    updatedQ[gi] = { ...updatedQ[gi], selectedIdx: sel }

    const updatedAns = { ...answered, [gi]: isCorrect }
    setAllQ(updatedQ)
    setAnswered(updatedAns)

    // Persist
    const saved = JSON.parse(localStorage.getItem("hsk_quiz_state") ?? "{}")
    if (saved[key]) {
      saved[key].allQ = updatedQ
      saved[key].answered = updatedAns
      localStorage.setItem("hsk_quiz_state", JSON.stringify(saved))
    }

    // TTS (skip for Pinyin-question type)
    const q = allQ[gi]
    if (q.si !== 1) {
      let speech = q.q.replace(/<[^>]+>/g, "").replace(/\([^)]+\)/g, "")
      if (q.si === 3) speech = speech.replace(/_{2,}/g, q.opts[cor])
      speakMandarin(speech)
    }
  }

  function replayQuestion(gi: number) {
    const q = allQ[gi]
    if (!q || answered[gi] === undefined || q.si === 1) return
    let speech = q.q.replace(/<[^>]+>/g, "").replace(/\([^)]+\)/g, "")
    if (q.si === 3) speech = speech.replace(/_{2,}/g, q.opts[q.ans])
    speakMandarin(speech)
  }

  /* ── Submit quiz ── */
  function handleSubmit() {
    setSubmitted(true)
    const saved = JSON.parse(localStorage.getItem("hsk_quiz_state") ?? "{}")
    if (saved[key]) { saved[key].submitted = true; localStorage.setItem("hsk_quiz_state", JSON.stringify(saved)) }
    // totalCorrect sudah dalam basis 0-100 (100 soal), jadi sekaligus jadi persentase
    saveUserScore("quiz", key, totalCorrect).catch(() => {})
  }

  /* ── Retry quiz ── */
  function handleRetry() {
    const saved = JSON.parse(localStorage.getItem("hsk_quiz_state") ?? "{}")
    delete saved[key]
    localStorage.setItem("hsk_quiz_state", JSON.stringify(saved))
    // Re-shuffle
    const reload = async () => {
      const questRes = await supa.from("quiz_questions")
        .select("section,sort_order,question,options,answer_index")
        .eq("quiz_key", key).order("section").order("sort_order")
      if (!questRes.data) return
      const data: QuizData = { title: quizTitle, sub: quizSub, A: [], B: [], C: [], D: [] }
      for (const row of questRes.data as RawQuestion[]) {
        if (data[row.section]) data[row.section].push(row)
      }
      const built = buildQuiz(data)
      const newSaved = JSON.parse(localStorage.getItem("hsk_quiz_state") ?? "{}")
      newSaved[key] = { allQ: built, answered: {}, submitted: false }
      localStorage.setItem("hsk_quiz_state", JSON.stringify(newSaved))
      setAllQ(built)
      setAnswered({})
      setSubmitted(false)
      setActiveTab("all")
      window.scrollTo(0, 0)
    }
    reload()
  }

  /* ── Result screen ── */
  if (!loading && submitted) {
    const skip = 100 - totalAnswered
    const wrong = totalAnswered - totalCorrect
    const pct = Math.round((totalCorrect / 100) * 100)
    const { emoji, grade, msg } = getGrade(pct, quizTitle)
    const pctColor = pct >= 80 ? "#4ade80" : pct >= 60 ? "#e8d23e" : "#f87171"
    const circumference = 2 * Math.PI * 54
    const ringOffset = circumference - (pct / 100) * circumference

    return (
      <div className={styles.page}>
        <div className="flex flex-col flex-1 select-none relative z-10 min-h-0">
          {/* Result Content */}
          <div className="relative flex flex-col flex-1 items-center justify-center gap-7 p-8 bg-background overflow-hidden min-h-0">
            {/*
              Signature: watermark hanzi besar di belakang ring, gaya
              sama persis dengan watermark yang muncul di flashcard session.
            */}
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
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{grade}</h2>
              <p className="text-sm text-muted-foreground">{msg}</p>
            </div>

            {/* Ring akurasi */}
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

            {/* Rincian penilaian */}
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

            <div className="flex gap-3 w-full max-w-xs relative z-10">
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
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #17344a", borderTopColor: "#42d6a4", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  /* ── Error (empty) ── */
  if (allQ.length === 0) {
    return (
      <div className={styles.page} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 48 }}>📭</div>
        <div>Soal kuis tidak ditemukan.</div>
        <button className={styles.btnBack} onClick={() => router.back()}>Kembali</button>
      </div>
    )
  }

  /* ── Main Quiz ── */
  const visibleSections = [0, 1, 2, 3].filter(si => activeTab === "all" || activeTab === si)

  return (
    <div className={styles.page}>
      <div className="flex flex-col flex-1 select-none relative z-10 min-h-0 overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <PracticeHeader
          title={quizTitle || "Quiz Harian"}
          subtitle={quizSub || `Level ${key.replace("level-", "")}`}
          progress={progress}
          rightContent={`${totalCorrect}/${totalAnswered}`}
          showStats={false}
        />

        {/* Section filter dropdown - scrolls together with the questions */}
        <div
          ref={filterRef}
          className={styles.filterWrap}
        >
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

        {/* Warn box (skip warning) — shown after submit attempt */}
        {submitted === false && totalAnswered < 100 && allQ.length === 100 && (
          <div className={`${styles.warnBox}`} id="warn-box" />
        )}

        {/* Questions */}
        <div className={styles.main}>
          {visibleSections.map(si => {
            const sq = allQ.filter(q => q.si === si)
            if (!sq.length) return null
            const offset = activeTab === "all" ? si * 25 : 0
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
                    {activeTab === "all" ? `${si * 25 + 1}–${si * 25 + 25}` : "1–25"}
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

          <div className={styles.submitPanel}>
            <div className={styles.liveInfo}>
              <div className={styles.liveTxt}>{totalAnswered} / 100 dijawab</div>
              <div className={styles.liveScore}>{totalCorrect} benar</div>
            </div>
            <button className={styles.submitBtn} onClick={handleSubmit}>
              Selesai
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── QuizCard ── */
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
          {q.si === 0 && <div className={styles.qHanzi}>{q.q}</div>}
          {q.si === 1 && <div className={styles.qPinyin}><ColorPy text={q.q} /></div>}
          {q.si === 2 && <div className={styles.qHanzi}>{q.q}</div>}
          {q.si === 3 && <RumpangText text={q.q} />}
        </div>
      </div>

      <div className={styles.options}>
        {q.opts.map((opt, i) => {
          let optClass = styles.opt
          if (q.si === 3) optClass += ` ${styles.optHanzi}`

          if (isAnswered) {
            if (i === q.ans) optClass += isCorrect ? ` ${styles.optCorrect}` : ` ${styles.optShowCorrect}`
            else if (i === q.selectedIdx && !isCorrect) optClass += ` ${styles.optWrong}`
          }

          const optContent = q.si === 2 ? <ColorPy text={opt} /> : opt

          return (
            <button
              key={i}
              id={`opt-${q.gi}-${i}`}
              className={optClass}
              disabled={isAnswered}
              onClick={(event) => {
                event.stopPropagation()
                onSelect(i)
              }}
            >
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
