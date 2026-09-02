"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { RotateCcw, SkipForward, CheckCircle2 } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { speakMandarin } from "@/lib/tts"
import { Button } from "@/components/ui/button"
import { PracticeHeader } from "@/components/practice-header"
import { PageLoader } from "@/components/page-loader"
import { saveUserScore } from "@/lib/user-scores"
import { generateQuizFromCards, type QuizQuestion as GeneratedQuizQuestion, type Card, type HanziItem } from "@/lib/quiz-generator"
import { shuffle } from "@/lib/array-utils"
import styles from "./page.module.css"

/* ── Types ── */
type QuizSection = 0 | 1 | 2 | 3

type QuizQuestion = {
  gi: number          // global index
  si: number          // section index (0-3)
  q: string           // question text
  opts: string[]      // shuffled options
  ans: number         // correct option index (after shuffle)
  selectedIdx?: number
  type: "hanzi-arti" | "pinyin-arti" | "hanzi-pinyin" | "kalimat-rumpang"
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
  const parts: Array<{ type: "text" | "blank" | "hz" | "lat"; content: string }> = []
  let remaining = text.replace(/_{2,}/g, "\x00BLANK\x00")

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

/* ── Convert generated quiz to internal format ── */
function convertToInternalQuiz(generated: GeneratedQuizQuestion[]): QuizQuestion[] {
  return generated.map((q, gi) => {
    const sectionMap: Record<string, number> = {
      "hanzi-arti": 0,
      "pinyin-arti": 1,
      "hanzi-pinyin": 2,
      "kalimat-rumpang": 3,
    }
    const si = sectionMap[q.type] ?? 0
    const shuffledOptions = shuffle(q.options)
    const ans = shuffledOptions.indexOf(q.correct)

    return {
      gi,
      si,
      q: q.question,
      opts: shuffledOptions,
      ans,
      type: q.type,
    }
  })
}

/* ── Main component ── */
export default function QuizPage() {
  const { key } = useParams<{ key: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isPersonal = searchParams.get("personal") === "true"
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
  const totalQuestions = allQ.length
  const progress = totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0

  // Bagian soal yang benar-benar punya soal (bisa < 4 kalau deck bukan kelipatan 3)
  const availableSections = React.useMemo<QuizSection[]>(() => {
    const present = new Set(allQ.map(q => q.si))
    return ([0, 1, 2, 3] as QuizSection[]).filter(si => present.has(si))
  }, [allQ])

  /* ── Load quiz from generated data ── */
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)

      const deckId = Number(key)

      let cards: Card[] = []
      let deckTitle = ""
      let deckSub = ""
      let hanziKey: string | undefined = undefined
      let hanziItems: HanziItem[] = []

      if (isPersonal) {
        // Load from personal_cards
        const { data: personalCards } = await supa
          .from("personal_cards")
          .select("id, hanzi, pinyin, arti")
          .eq("deck_id", deckId)
          .order("created_at", { ascending: true })

        cards = (personalCards ?? []).map(c => ({
          id: c.id,
          hanzi: c.hanzi,
          pinyin: c.pinyin,
          arti: c.arti,
        }))

        deckTitle = "Deck Personal"
        deckSub = "Latihan Bebas"
      } else {
        // Load from flashcard_cards
        const [setData, cardData] = await Promise.all([
          supa.from("flashcard_sets").select("title, description, hsk_level").eq("id", deckId).maybeSingle(),
          supa.from("flashcard_cards").select("id, hanzi, pinyin, arti").eq("set_id", deckId).order("created_at", { ascending: true }),
        ])

        cards = (cardData.data ?? []).map(c => ({
          id: c.id,
          hanzi: c.hanzi,
          pinyin: c.pinyin,
          arti: c.arti,
        }))

        if (setData.data) {
          deckTitle = setData.data.title ?? "Quiz"
          const parts = [setData.data.description, setData.data.hsk_level ? `HSK ${setData.data.hsk_level}` : null].filter(Boolean)
          deckSub = parts.join(" - ")
        }

        // Try to get hanzi_key (for multiple of 3 check)
        // Assuming deck ID maps to hanzi_key like: deck 3 -> h3, deck 6 -> h6, etc.
        if (deckId % 3 === 0) {
          hanziKey = `h${deckId}`
          // Load hanzi_items for sentence fill
          const { data: items } = await supa
            .from("hanzi_items")
            .select("id, hanzi_key, section_label, section_tag, sort_order, hanzi, pinyin, arti")
            .eq("hanzi_key", hanziKey)
            .order("sort_order")

          hanziItems = items ?? []
        }
      }

      if (cancelled) return

      // Generate quiz from cards
      const generatedQuiz = generateQuizFromCards(cards, hanziKey, hanziItems)
      const internalQuiz = convertToInternalQuiz(generatedQuiz)

      // Save to localStorage
      const storageKey = `quiz_${key}_${isPersonal ? 'personal' : 'regular'}`
      const saved = JSON.parse(localStorage.getItem("hsk_quiz_state") ?? "{}")
      saved[storageKey] = { allQ: internalQuiz, answered: {}, submitted: false }
      localStorage.setItem("hsk_quiz_state", JSON.stringify(saved))

      setQuizTitle(deckTitle)
      setQuizSub(deckSub)
      setAllQ(internalQuiz)
      setAnswered({})
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [key, isPersonal, supa])

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
    const storageKey = `quiz_${key}_${isPersonal ? 'personal' : 'regular'}`
    const saved = JSON.parse(localStorage.getItem("hsk_quiz_state") ?? "{}")
    if (saved[storageKey]) {
      saved[storageKey].allQ = updatedQ
      saved[storageKey].answered = updatedAns
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
    const storageKey = `quiz_${key}_${isPersonal ? 'personal' : 'regular'}`
    const saved = JSON.parse(localStorage.getItem("hsk_quiz_state") ?? "{}")
    if (saved[storageKey]) { saved[storageKey].submitted = true; localStorage.setItem("hsk_quiz_state", JSON.stringify(saved)) }
    // Calculate percentage
    const pct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0
    saveUserScore("quiz", key, pct).catch(() => {})
  }

  /* ── Retry quiz ── */
  function handleRetry() {
    const storageKey = `quiz_${key}_${isPersonal ? 'personal' : 'regular'}`
    const saved = JSON.parse(localStorage.getItem("hsk_quiz_state") ?? "{}")
    delete saved[storageKey]
    localStorage.setItem("hsk_quiz_state", JSON.stringify(saved))
    // Reload page to regenerate quiz
    window.location.reload()
  }

  /* ── Result screen ── */
  if (!loading && submitted) {
    const skip = totalQuestions - totalAnswered
    const wrong = totalAnswered - totalCorrect
    const pct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0
    const { emoji, grade, msg } = getGrade(pct, quizTitle)
    const pctColor = pct >= 80 ? "#4ade80" : pct >= 60 ? "#e8d23e" : "#f87171"
    const circumference = 2 * Math.PI * 54
    const ringOffset = circumference - (pct / 100) * circumference

    return (
      <div className={styles.page}>
        <div className="flex flex-col flex-1 select-none relative z-10 min-h-0">
          <div className="relative flex flex-col flex-1 items-center justify-center gap-7 p-8 bg-background overflow-hidden min-h-0">
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
      <div className={styles.page}>
        <PageLoader />
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
  const visibleSections = availableSections.filter(si => activeTab === "all" || activeTab === si)

  return (
    <div className={styles.page}>
      <div className="flex flex-col flex-1 select-none relative z-10 min-h-0">
        <PracticeHeader
          title={quizTitle || "Quiz"}
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
              {([["all", "Semua Bagian"], ...availableSections.map(si => [si, `Bagian ${si + 1}`] as const)] as const).map(([t, lbl]) => (
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

        {submitted === false && totalAnswered < totalQuestions && (
          <div className={`${styles.warnBox}`} id="warn-box" />
        )}

        <div className={styles.main}>
          {visibleSections.map(si => {
            const sq = allQ.filter(q => q.si === si)
            if (!sq.length) return null
            const meta = SECTION_META[si]

            return (
              <React.Fragment key={si}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionNum}>{meta.label}</div>
                  <div>
                    <div className={styles.sectionTitle}>{meta.title}</div>
                    <div className={styles.sectionSub}>{meta.sub}</div>
                  </div>
                </div>
                <div className={styles.sectionBody}>
                  {sq.map((q) => {
                    const isAnswered = answered[q.gi] !== undefined
                    const isCorrect = answered[q.gi]
                    const cardStateClass = isAnswered
                      ? isCorrect
                        ? styles.qCardCorrect
                        : styles.qCardWrong
                      : ""
                    const qTextClass =
                      q.si === 0 || q.si === 2 ? styles.qHanzi
                      : q.si === 1 ? styles.qPinyin
                      : styles.qRumpang
                    // Soal berbasis hanzi (Hanzi→Arti, Hanzi→Pinyin, Kalimat Rumpang): tap teksnya buat putar ulang TTS, setelah terjawab
                    const isHanziQuestion = q.si === 0 || q.si === 2 || q.si === 3
                    const canReplay = isAnswered && isHanziQuestion

                    return (
                      <div
                        key={q.gi}
                        className={`${styles.qCard} ${cardStateClass}`}
                      >
                        <div className={styles.qTop}>
                          <div className={styles.qText}>
                            <div
                              className={`${qTextClass} ${canReplay ? styles.qCardReplay : ""}`}
                              onClick={canReplay ? () => replayQuestion(q.gi) : undefined}
                              role={canReplay ? "button" : undefined}
                              aria-label={canReplay ? "Putar ulang lafal" : undefined}
                            >
                              {q.si === 1 ? <ColorPy text={q.q} /> : q.si === 3 ? <RumpangText text={q.q} /> : q.q}
                            </div>
                          </div>
                          {isAnswered && q.si !== 1 && (
                            <button
                              type="button"
                              className={styles.replayBtn}
                              onClick={(e) => { e.stopPropagation(); replayQuestion(q.gi) }}
                              aria-label="Putar ulang"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className={styles.options}>
                          {q.opts.map((opt, oi) => {
                            const isSelected = q.selectedIdx === oi
                            const isRightAnswer = oi === q.ans
                            const optStateClass = isAnswered
                              ? isSelected
                                ? (isCorrect ? styles.optCorrect : styles.optWrong)
                                : (isRightAnswer ? styles.optShowCorrect : "")
                              : ""
                            return (
                              <button
                                key={oi}
                                type="button"
                                disabled={isAnswered}
                                className={`${styles.opt} ${optStateClass}`}
                                onClick={() => selectAns(q.gi, oi, q.ans)}
                              >
                                <span className={styles.optLbl}>{String.fromCharCode(65 + oi)}</span>
                                <span>{q.si === 2 ? <ColorPy text={opt} /> : opt}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </React.Fragment>
            )
          })}
        </div>

        <div className={styles.submitPanel}>
          <div className={styles.liveInfo}>
            <div className={styles.liveTxt}>{totalAnswered} / {totalQuestions} dijawab</div>
            <div className={styles.liveScore}>{totalCorrect} benar</div>
          </div>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}
