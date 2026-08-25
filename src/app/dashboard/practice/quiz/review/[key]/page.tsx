"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { X } from "lucide-react"
import { createClient } from "@/lib/supabase/browser"
import { speakMandarin } from "@/lib/tts"
import { saveUserScore } from "@/lib/user-scores"
import styles from "../../[key]/page.module.css"

type RawKalimatQuestion = {
  section_index: number
  sort_order: number
  question: string
  question_type: string | null
  options: string[]
  answer_index: number
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

  return <span className={styles.qRumpang}>{parts.map((p, i) => {
    if (p.type === "blank") return <span key={i} className={styles.blank} />
    if (p.type === "hz") return <span key={i} className={styles.hz}>{p.content}</span>
    if (p.type === "lat") return <span key={i} className={styles.lat}>({p.content})</span>
    return <span key={i}>{p.content}</span>
  })}</span>
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildKalimatQuiz(rows: RawKalimatQuestion[]): QuizQuestion[] {
  const all: QuizQuestion[] = []
  let gi = 0
  for (let section = 1; section <= 4; section++) {
    const sectionRows = shuffle(rows.filter((row) => row.section_index === section))
    for (const row of sectionRows) {
      const indexes = shuffle([0, 1, 2, 3].slice(0, row.options.length))
      all.push({
        gi: gi++,
        si: section - 1,
        q: row.question,
        opts: indexes.map((i) => row.options[i]),
        ans: indexes.indexOf(row.answer_index),
      })
    }
  }
  return all
}

function getGrade(pct: number, title: string) {
  if (pct >= 90) return { emoji: "⭐", grade: `Luar Biasa! ${title.split("—")[0].trim()} dikuasai!`, msg: "Penguasaan kalimat sangat baik. Siap lanjut ke level berikutnya!" }
  if (pct >= 80) return { emoji: "✅", grade: "Bagus! Pemahaman kalimat kuat.", msg: "Hampir sempurna! Review kalimat yang salah lalu lanjut." }
  if (pct >= 70) return { emoji: "📘", grade: "Cukup Baik — Perlu Sedikit Review", msg: "Review Flashcard Kumulatif untuk set ini dulu, lalu coba lagi." }
  if (pct >= 60) return { emoji: "⚠️", grade: "Perlu Review Lebih Banyak", msg: "Kembali ke quiz dan flashcard kumulatif, lalu coba lagi." }
  return { emoji: "🔄", grade: "Review Lebih Banyak Dulu", msg: "Kembali ke Flashcard Kumulatif, lalu coba lagi. Pelan-pelan pasti bisa!" }
}

export default function CumulativeQuizPracticePage() {
  const { key } = useParams<{ key: string }>()
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [quizTitle, setQuizTitle] = React.useState("")
  const [allQ, setAllQ] = React.useState<QuizQuestion[]>([])
  const [answered, setAnswered] = React.useState<Answered>({})
  const [submitted, setSubmitted] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<TabId>("all")

  const total = allQ.length
  const totalAnswered = Object.keys(answered).length
  const totalCorrect = Object.values(answered).filter(Boolean).length
  const progress = total > 0 ? (totalAnswered / total) * 100 : 0

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const supa = createClient()

      try {
        const saved = JSON.parse(localStorage.getItem("hsk_kal_state") ?? "{}")
        const state = saved[key]
        const savedQ = state?.allQ ?? state?.kalQ
        const savedAnswered = state?.answered ?? state?.kalAnswered ?? {}
        if (Array.isArray(savedQ) && savedQ.length > 0) {
          if (!cancelled) {
            setAllQ(savedQ)
            setAnswered(savedAnswered)
            setSubmitted(Boolean(state.submitted))
            setLoading(false)
          }
          const meta = await supa.from("kalimat_sets").select("title,sub").eq("key", key).single()
          if (!cancelled && meta.data) setQuizTitle(meta.data.title)
          return
        }
      } catch {}

      const [metaRes, questRes] = await Promise.all([
        supa.from("kalimat_sets").select("title,sub").eq("key", key).single(),
        supa
          .from("kalimat_questions")
          .select("section_index, sort_order, question, question_type, options, answer_index")
          .eq("kal_key", key)
          .order("section_index")
          .order("sort_order"),
      ])

      if (cancelled) return
      if (metaRes.error || questRes.error) {
        setLoading(false)
        return
      }

      const built = buildKalimatQuiz((questRes.data ?? []) as RawKalimatQuestion[])
      const saved = JSON.parse(localStorage.getItem("hsk_kal_state") ?? "{}")
      saved[key] = { allQ: built, kalQ: built, answered: {}, kalAnswered: {}, submitted: false }
      localStorage.setItem("hsk_kal_state", JSON.stringify(saved))

      setQuizTitle(metaRes.data.title)
      setAllQ(built)
      setAnswered({})
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [key])

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
      saved[key].kalQ = updatedQ
      saved[key].answered = updatedAns
      saved[key].kalAnswered = updatedAns
      localStorage.setItem("hsk_kal_state", JSON.stringify(saved))
    }

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

  function handleSubmit() {
    setSubmitted(true)
    const saved = JSON.parse(localStorage.getItem("hsk_kal_state") ?? "{}")
    if (saved[key]) {
      saved[key].submitted = true
      localStorage.setItem("hsk_kal_state", JSON.stringify(saved))
    }
    // type "kal" pakai jumlah benar mentah (dari total 60), bukan persentase —
    // harus sinkron dengan xpFromKalScore di get-user-stats (ambang 48/36 dari 60 soal)
    saveUserScore("kal", key, totalCorrect).catch(() => {})
  }

  function handleRetry() {
    const saved = JSON.parse(localStorage.getItem("hsk_kal_state") ?? "{}")
    delete saved[key]
    localStorage.setItem("hsk_kal_state", JSON.stringify(saved))
    window.location.reload()
  }

  if (!loading && submitted) {
    const skip = total - totalAnswered
    const wrong = totalAnswered - totalCorrect
    const pct = total > 0 ? Math.round((totalCorrect / total) * 100) : 0
    const { emoji, grade, msg } = getGrade(pct, quizTitle)
    const pctColor = pct >= 80 ? "#4ade80" : pct >= 60 ? "#e8d23e" : "#f87171"

    return (
      <div className={styles.page}>
        <div className={styles.result}>
          <div className={styles.resultEmoji}>{emoji}</div>
          <div style={{ color: pctColor, fontSize: 52, fontWeight: 900 }}>{pct}%</div>
          <div className={styles.resultGrade}>{grade}</div>
          <div className={styles.resultMsg}>{msg}</div>
          <div className={styles.resultStats}>
            <div className={styles.resultStat}><span className={`${styles.resultStatNum} ${styles.resultScore}`}>{totalCorrect}</span><span className={styles.resultStatLbl}>Benar</span></div>
            <div className={styles.resultStat}><span className={`${styles.resultStatNum} ${styles.resultWrong}`}>{wrong}</span><span className={styles.resultStatLbl}>Salah</span></div>
            <div className={styles.resultStat}><span className={`${styles.resultStatNum} ${styles.resultSkip}`}>{skip}</span><span className={styles.resultStatLbl}>Dilewati</span></div>
          </div>
          <div className={styles.resultBtns}>
            <button className={styles.btnBack} onClick={() => router.back()}>Kembali</button>
            <button className={styles.btnRetry} onClick={handleRetry}>Ulangi</button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.page} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #17344a", borderTopColor: "#42d6a4", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (allQ.length === 0) {
    return (
      <div className={styles.page} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 48 }}>📭</div>
        <div>Soal quiz kumulatif tidak ditemukan.</div>
        <button className={styles.btnBack} onClick={() => router.back()}>Kembali</button>
      </div>
    )
  }

  const visibleSections = [0, 1, 2, 3].filter(si => activeTab === "all" || activeTab === si)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={() => router.back()} aria-label="Keluar quiz">
          <X size={20} />
        </button>
        <div className={styles.progWrap}>
          <div className={styles.progFill} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.score}>{totalCorrect}/{totalAnswered}</div>
      </div>

      <div className={styles.tabs}>
        {([["all", "Semua"], [0, "Bagian 1"], [1, "Bagian 2"], [2, "Bagian 3"], [3, "Bagian 4"]] as const).map(([t, lbl]) => (
          <button key={String(t)} className={`${styles.tab} ${activeTab === t ? styles.tabActive : ""}`} onClick={() => setActiveTab(t)}>
            {lbl}
          </button>
        ))}
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
                <QuizCard key={q.gi} q={q} num={offset + li + 1} isAnswered={answered[q.gi] !== undefined} isCorrect={answered[q.gi]} onSelect={sel => selectAns(q.gi, sel, q.ans)} onReplay={() => replayQuestion(q.gi)} />
              ))}
            </React.Fragment>
          )
        })}

        <div className={styles.submitPanel}>
          <div className={styles.liveInfo}>
            <div className={styles.liveTxt}>{totalAnswered} / {total} dijawab</div>
            <div className={styles.liveScore}>{totalCorrect} benar</div>
          </div>
          <button className={styles.submitBtn} onClick={handleSubmit}>Selesai</button>
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
          const optText = q.si === 3 && (q.q.match(/_{2,}/g) || []).length >= 2 ? opt.split(" ").join("，") : opt
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
