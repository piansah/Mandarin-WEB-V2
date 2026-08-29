"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { X } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { speakMandarin } from "@/lib/tts"
import { PracticeHeader } from "@/components/practice-header"
import { deleteGrammarScore, sessionKey, setGrammarScore } from "@/lib/grammar-scores"
import { saveUserScore } from "@/lib/user-scores"
import { shuffle } from "@/lib/array-utils"
import styles from "./page.module.css"

type Example = { hz?: string; py?: string; id?: string }
type ChipWord = { word: string; pinyin: string }
type AnswerChip = ChipWord & { idx: number }
type QuestionState = { answer: AnswerChip[]; used: boolean[]; checked: boolean; words: ChipWord[] }

type Pattern = {
  id: number
  title: string
  slug: string
  sub_title: string | null
  theory_text: string | null
  example_json: Example[] | null
}

type Question = {
  id: number
  words: string[]
  pinyin_word: string[]
  correct_order: string[]
  alt_orders: string[][] | null
  translation: string | null
  explanation: string | null
  shuffled?: ChipWord[]
}

type Phase = "theory" | "soal" | "done"

const toneMap: Record<string, string> = {
  ā: "tone1", á: "tone2", ǎ: "tone3", à: "tone4",
  ē: "tone1", é: "tone2", ě: "tone3", è: "tone4",
  ī: "tone1", í: "tone2", ǐ: "tone3", ì: "tone4",
  ō: "tone1", ó: "tone2", ǒ: "tone3", ò: "tone4",
  ū: "tone1", ú: "tone2", ǔ: "tone3", ù: "tone4",
  ǖ: "tone1", ǘ: "tone2", ǚ: "tone3", ǜ: "tone4",
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
}

function asAltOrders(value: unknown): string[][] | null {
  if (!Array.isArray(value)) return null
  const orders = value.map(asStringArray).filter((item) => item.length > 0)
  return orders.length > 0 ? orders : null
}

function asExamples(value: unknown): Example[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item && typeof item === "object") as Example[]
}

function isCorrect(user: string[], correct: string[], altOrders: string[][] | null) {
  const userStr = JSON.stringify(user)
  if (userStr === JSON.stringify(correct)) return true
  return Boolean(altOrders?.some((alt) => userStr === JSON.stringify(alt)))
}

function ColorPy({ text }: { text: string }) {
  return <>{text.split(/(\s+|[,!.?·。，！？、；：()]+)/).map((part, index) => {
    if (!part || /^(\s+|[,!.?·。，！？、；：()]+)$/.test(part)) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    const syllables = part.match(/[bpmfdtnlgkhjqxzcsryw]{0,2}[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜaeiouü]+(?:ng?|r)?/gi) ?? [part]
    return syllables.map((syllable, syllableIndex) => {
      const tone = [...syllable].map((char) => toneMap[char]).find(Boolean) ?? "tone0"
      return <span key={`${syllable}-${syllableIndex}`} className={styles[tone as "tone1"]}>{syllable}</span>
    })
  })}</>
}

function Chip({ word, pinyin, onClick, disabled, used }: { word: string; pinyin: string; onClick: () => void; disabled?: boolean; used?: boolean }) {
  return (
    <button type="button" className={`${styles.chip} ${used ? styles.chipUsed : ""}`} disabled={disabled || used} onClick={onClick}>
      <span className={styles.chipHanzi}>{word}</span>
      {pinyin ? <span className={styles.chipPinyin}><ColorPy text={pinyin} /></span> : null}
    </button>
  )
}

export default function GrammarPracticePage() {
  const params = useParams()
  const router = useRouter()
  const slug = String(params.slug)
  const supa = useSupabase()
  const [loading, setLoading] = React.useState(true)
  const [pattern, setPattern] = React.useState<Pattern | null>(null)
  const [questions, setQuestions] = React.useState<Question[]>([])
  const [phase, setPhase] = React.useState<Phase>("theory")
  const [idx, setIdx] = React.useState(0)
  const [answer, setAnswer] = React.useState<AnswerChip[]>([])
  const [used, setUsed] = React.useState<boolean[]>([])
  const [checked, setChecked] = React.useState(false)
  const [correctCount, setCorrectCount] = React.useState(0)
  const [wrongCount, setWrongCount] = React.useState(0)
  const [states, setStates] = React.useState<QuestionState[]>([])
  const [wrongQuestions, setWrongQuestions] = React.useState<Question[]>([])
  const [reviewRound, setReviewRound] = React.useState(0)
  const [bankWords, setBankWords] = React.useState<ChipWord[]>([])

  const persist = React.useCallback((next: Partial<{ questions: Question[]; states: QuestionState[]; idx: number; correctCount: number; wrongCount: number; finished: boolean }>) => {
    const payload = {
      gramQuestions: next.questions ?? questions,
      gramStates: next.states ?? states,
      gramIdx: next.idx ?? idx,
      gramCorrect: next.correctCount ?? correctCount,
      gramWrong: next.wrongCount ?? wrongCount,
      finished: next.finished ?? false,
    }
    window.localStorage.setItem(sessionKey(slug), JSON.stringify(payload))
  }, [questions, states, idx, correctCount, wrongCount, slug])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const patternRes = await supa.from("grammar_patterns").select("id, title, slug, sub_title, theory_text, example_json").eq("slug", slug).single()
      if (patternRes.error || !patternRes.data) {
        if (!cancelled) { setPattern(null); setLoading(false) }
        return
      }
      const questionRes = await supa.from("grammar_questions").select("id, words, pinyin_word, correct_order, alt_orders, translation, explanation, sort_order").eq("pattern_id", patternRes.data.id).order("sort_order", { ascending: true })
      if (cancelled) return
      const loaded: Question[] = (questionRes.data ?? []).map((row) => ({
        id: row.id,
        words: asStringArray(row.words),
        pinyin_word: asStringArray(row.pinyin_word),
        correct_order: asStringArray(row.correct_order),
        alt_orders: asAltOrders(row.alt_orders),
        translation: row.translation,
        explanation: row.explanation,
      }))
      setPattern({ ...patternRes.data, example_json: asExamples(patternRes.data.example_json) })
      setQuestions(loaded)

      try {
        const saved = JSON.parse(window.localStorage.getItem(sessionKey(slug)) ?? "null")
        if (saved?.gramQuestions?.length === loaded.length) {
          setQuestions(saved.gramQuestions)
          setStates(saved.gramStates ?? [])
          setIdx(saved.gramIdx ?? 0)
          setCorrectCount(saved.gramCorrect ?? 0)
          setWrongCount(saved.gramWrong ?? 0)
          if (saved.finished) setPhase("done")
        }
      } catch {
        // ignore broken session
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [slug, supa])

  const question = questions[idx]
  const examples = pattern?.example_json ?? []
  const progress = questions.length ? (phase === "done" ? 100 : (idx / questions.length) * 100) : 0

  function chipsFor(q: Question, restored?: ChipWord[]) {
    if (restored) return restored
    if (!q.shuffled) {
      q.shuffled = shuffle(q.words.map((word, wordIndex) => ({ word, pinyin: q.pinyin_word[wordIndex] || "" })))
    }
    return q.shuffled
  }

  function openSoal(fromIdx = idx, restored?: QuestionState) {
    const q = questions[fromIdx]
    if (!q) return
    const words = chipsFor(q, restored?.words)
    setBankWords(words)
    setAnswer(restored?.answer ?? [])
    setUsed(restored?.used ?? words.map(() => false))
    setChecked(restored?.checked ?? false)
    setPhase("soal")
  }

  function saveCurrent(overrides?: Partial<QuestionState>) {
    const nextStates = [...states]
    nextStates[idx] = {
      answer: overrides?.answer ?? answer,
      used: overrides?.used ?? used,
      checked: overrides?.checked ?? checked,
      words: overrides?.words ?? bankWords,
    }
    setStates(nextStates)
    persist({ states: nextStates })
    return nextStates
  }

  function addWord(chipIndex: number) {
    if (checked || used[chipIndex]) return
    const chip = bankWords[chipIndex]
    speakMandarin(chip.word)
    const nextAnswer = [...answer, { ...chip, idx: chipIndex }]
    const nextUsed = used.map((value, index) => index === chipIndex ? true : value)
    setAnswer(nextAnswer)
    setUsed(nextUsed)
  }

  function removeWord(answerIndex: number) {
    const item = answer[answerIndex]
    if (!item) return
    speakMandarin(item.word)
    if (checked) return
    setAnswer(answer.filter((_, index) => index !== answerIndex))
    setUsed(used.map((value, index) => index === item.idx ? false : value))
  }

  function checkAnswer() {
    if (!question || answer.length < question.correct_order.length || checked) return
    const ok = isCorrect(answer.map((item) => item.word), question.correct_order, question.alt_orders)
    const nextCorrect = ok ? correctCount + 1 : correctCount
    const nextWrong = ok ? wrongCount : wrongCount + 1
    setChecked(true)
    setCorrectCount(nextCorrect)
    setWrongCount(nextWrong)
    if (!ok) setWrongQuestions((current) => current.some((item) => item.id === question.id) ? current : [...current, question])
    if (ok) setTimeout(() => speakMandarin(question.correct_order.join("")), 300)
    const nextStates = saveCurrent({ checked: true })
    persist({ states: nextStates, correctCount: nextCorrect, wrongCount: nextWrong, idx })
  }

  function goPrev() {
    if (idx === 0) {
      saveCurrent()
      setPhase("theory")
      return
    }
    const nextStates = saveCurrent()
    const prev = idx - 1
    setIdx(prev)
    persist({ idx: prev, states: nextStates })
    openSoal(prev, nextStates[prev])
  }

  function startReview(source: Question[]) {
    const nextQuestions = shuffle(source).map((item) => ({ ...item, shuffled: undefined }))
    setQuestions(nextQuestions)
    setWrongQuestions([])
    setReviewRound((value) => value + 1)
    setIdx(0)
    setCorrectCount(0)
    setWrongCount(0)
    setChecked(false)
    setStates([])
    setAnswer([])
    setUsed([])
    persist({ questions: nextQuestions, states: [], idx: 0, correctCount: 0, wrongCount: 0 })
    const first = nextQuestions[0]
    const words = chipsFor(first)
    setBankWords(words)
    setUsed(words.map(() => false))
    setPhase("soal")
  }

  function finish(pct: number) {
    setGrammarScore(slug, pct)
    saveUserScore("grammar", slug, pct).catch(() => {})
    window.localStorage.removeItem(sessionKey(slug))
    setPhase("done")
  }

  function goNext() {
    if (!question) return
    const remainingWrong = isCorrect(answer.map((item) => item.word), question.correct_order, question.alt_orders)
      ? wrongQuestions.filter((item) => item.id !== question.id)
      : wrongQuestions
    const nextStates = saveCurrent()
    if (idx >= questions.length - 1) {
      if (remainingWrong.length > 0) {
        if (reviewRound === 0) {
          const firstPassPct = questions.length ? Math.round((correctCount / questions.length) * 100) : 0
          setGrammarScore(slug, firstPassPct)
          saveUserScore("grammar", slug, firstPassPct).catch(() => {})
        }
        startReview(remainingWrong)
        return
      }
      finish(questions.length ? Math.round((correctCount / questions.length) * 100) : 0)
      return
    }
    const nextIdx = idx + 1
    setIdx(nextIdx)
    persist({ idx: nextIdx, states: nextStates })
    openSoal(nextIdx, nextStates[nextIdx])
  }

  function restart() {
    if (!pattern) return
    window.localStorage.removeItem(sessionKey(slug))
    deleteGrammarScore(slug)
    window.location.reload()
  }

  if (loading) {
    return <div className={styles.page}><div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div></div>
  }

  if (!pattern) {
    return <div className={styles.page}><div className="p-8 text-sm text-red-400">Pola grammar tidak ditemukan.</div></div>
  }

  const ok = question ? isCorrect(answer.map((item) => item.word), question.correct_order, question.alt_orders) : false
  const canCheck = Boolean(question && answer.length >= question.correct_order.length && !checked)

  return (
    <div className={styles.page}>
      <PracticeHeader
        title={pattern.title}
        subtitle={reviewRound > 0 ? `Ronde ${reviewRound + 1} — Review salah` : pattern.sub_title || `${questions.length} soal susun kata`}
        progress={phase !== "theory" ? progress : undefined}
        rightContent={phase !== "theory" ? `${correctCount}/${questions.length}` : undefined}
        stats={
          phase !== "theory"
            ? {
                accuracy: questions.length ? Math.round((correctCount / questions.length) * 100) : 0,
                rated: correctCount + wrongCount,
              }
            : undefined
        }
        showStats={phase !== "theory"}
      />

      <div className={styles.body}>
        {phase === "theory" && (
          <div className={styles.theoryGrid}>
            <section className={styles.theoryCard}>
              <div className={styles.kicker}>Penjelasan</div>
              <p className={styles.theoryText}>{pattern.theory_text || "Belum ada teori untuk pola ini."}</p>
            </section>
            {examples.length > 0 && (
              <section className={styles.exampleCard}>
                <div className={styles.kicker}>Contoh</div>
                <div className={styles.exampleList}>
                  {examples.map((example, index) => (
                    <button key={`${example.hz}-${index}`} type="button" className={styles.exampleItem} onClick={() => example.hz && speakMandarin(example.hz)}>
                      <div className={styles.exampleHz}>{example.hz}</div>
                      {example.py ? <div className={styles.examplePy}><ColorPy text={example.py} /></div> : null}
                      {example.id ? <div className={styles.exampleId}>{example.id}</div> : null}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {phase === "soal" && question && (
          <>
            <section className={styles.soalCard}>
              <div className={styles.kicker}>{reviewRound > 0 ? `Review R${reviewRound + 1} — Soal ${idx + 1} dari ${questions.length}` : `Soal ${idx + 1} dari ${questions.length} — Susun Kata`}</div>
              <div className={styles.target}>{question.translation}</div>
            </section>
            <div className={styles.answerZone}>
              {answer.length === 0 ? (
                <span className={styles.placeholder}>Ketuk kata di bawah untuk menyusun...</span>
              ) : answer.map((item, index) => (
                <Chip key={`${item.word}-${index}`} word={item.word} pinyin={item.pinyin} onClick={() => removeWord(index)} />
              ))}
            </div>
            <div className={styles.bank}>
              {bankWords.map((item, index) => (
                <Chip key={`${item.word}-${index}`} word={item.word} pinyin={item.pinyin} used={used[index]} disabled={checked} onClick={() => addWord(index)} />
              ))}
            </div>
            {checked && (
              <div className={`${styles.resultBox} ${ok ? styles.resultOk : styles.resultBad}`}>
                <button type="button" className={styles.resultMain} onClick={() => speakMandarin(question.correct_order.join(""))}>
                  {ok ? `Benar! ${question.correct_order.join("")} — ${question.translation}` : `Belum tepat. Urutan benar: ${question.correct_order.join("")}`}
                </button>
                {question.explanation ? <div className={styles.explain}>{question.explanation}</div> : null}
              </div>
            )}
          </>
        )}

        {phase === "done" && (
          <section className={styles.doneCard}>
            <div className={styles.kicker}>Selesai</div>
            <div className={styles.donePct}>{questions.length ? Math.round((correctCount / questions.length) * 100) : 0}%</div>
            <div className={styles.doneStats}>
              <div className={styles.stat}><span className={`${styles.statNum} ${styles.ok}`}>{correctCount}</span><span className={styles.statLbl}>Benar</span></div>
              <div className={styles.stat}><span className={`${styles.statNum} ${styles.bad}`}>{wrongCount}</span><span className={styles.statLbl}>Salah</span></div>
              <div className={styles.stat}><span className={styles.statNum}>{questions.length}</span><span className={styles.statLbl}>Total</span></div>
            </div>
          </section>
        )}
      </div>

      <footer className={styles.footer}>
        {phase === "theory" && (
          <button type="button" className={styles.btnPrimary} onClick={() => openSoal(idx, states[idx])}>Mulai Latihan</button>
        )}
        {phase === "soal" && (
          <>
            <button type="button" className={styles.btnGhost} onClick={goPrev}>{idx === 0 ? "Teori" : "Sebelumnya"}</button>
            {!checked ? (
              <button type="button" className={styles.btnPrimary} disabled={!canCheck} onClick={checkAnswer}>Periksa</button>
            ) : (
              <button type="button" className={styles.btnPrimary} onClick={goNext}>
                {idx >= questions.length - 1 && (ok ? wrongQuestions.filter((item) => item.id !== question.id) : wrongQuestions).length === 0 ? "Lihat Hasil" : "Lanjut"}
              </button>
            )}
          </>
        )}
        {phase === "done" && (
          <>
            <button type="button" className={styles.btnGhost} onClick={() => router.push("/dashboard/grammar")}>Kembali</button>
            <button type="button" className={styles.btnPrimary} onClick={restart}>Ulangi</button>
          </>
        )}
      </footer>
    </div>
  )
}