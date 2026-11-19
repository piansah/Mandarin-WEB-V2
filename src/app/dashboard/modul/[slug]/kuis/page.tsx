"use client"

/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/* Modul quiz uses the same one-question-at-a-time flow as grammar practice. */

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Mic, RotateCcw, Volume2, XCircle } from "lucide-react"
import { PageLoader } from "@/components/page-loader"
import { PracticeHeader } from "@/components/practice-header"
import { ResultWatermark } from "@/components/result-watermark"
import { fetchModuleQuiz, saveQuizResult, type ModulQuiz } from "@/lib/modul"
import { speakMandarin } from "@/lib/tts"
import { scorePronunciation } from "@/lib/pronunciation-scoring"
import { shuffle } from "@/lib/array-utils"

type SavedQuizState = {
  answers?: Record<string, string>
  currentIndex?: number
  finished?: boolean
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: { 0: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function parsedAnswer(value: string | undefined): unknown {
  if (!value) return null
  try { return JSON.parse(value) as unknown } catch { return value }
}

function answerIsCorrect(question: ModulQuiz["questions"][number], answer: string | undefined): boolean {
  if (answer === undefined) return false
  if (question.questionType === "word_order") {
    const submitted = parsedAnswer(answer)
    return Array.isArray(submitted) && JSON.stringify(submitted) === JSON.stringify(question.correctOrder ?? [])
  }
  if (question.questionType === "matching") {
    const submitted = parsedAnswer(answer)
    if (!submitted || typeof submitted !== "object" || Array.isArray(submitted) || !question.matching) return false
    const pairs = submitted as Record<string, string>
    return question.matching.correctPairs.every((pair) => pairs[pair.leftId] === pair.rightId)
      && Object.keys(pairs).length === question.matching.correctPairs.length
  }
  if (question.questionType === "speaking") {
    const result = parsedAnswer(answer)
    return Boolean(result && typeof result === "object" && "accuracy" in result && Number(result.accuracy) >= 80)
  }
  return answer === question.correctOptionId
}

function readQuizState(): Record<string, SavedQuizState> {
  try {
    return JSON.parse(localStorage.getItem("modul_quiz_state") ?? "{}") as Record<string, SavedQuizState>
  } catch {
    return {}
  }
}

export default function ModulKuisPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const [quiz, setQuiz] = React.useState<ModulQuiz | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [selectedOptionId, setSelectedOptionId] = React.useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [finished, setFinished] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [wordAnswer, setWordAnswer] = React.useState<string[]>([])
  const [matchingAnswer, setMatchingAnswer] = React.useState<Record<string, string>>({})
  const [pendingMatchLeft, setPendingMatchLeft] = React.useState<string | null>(null)
  const [speechResult, setSpeechResult] = React.useState<{ transcript: string; accuracy: number } | null>(null)
  const [speechError, setSpeechError] = React.useState<string | null>(null)
  const [isRecording, setIsRecording] = React.useState(false)
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)

  React.useEffect(() => {
    let active = true
    setLoading(true)
    fetchModuleQuiz(params.slug)
      .then((data) => {
        if (!active) return
        if (!data || data.questions.length === 0) {
          setError("Kuis untuk modul ini belum tersedia.")
          return
        }

        const storageKey = `modul_quiz_${params.slug}`
        const existing = readQuizState()[storageKey]
        setQuiz(data)
        if (existing && !existing.finished) {
          setAnswers(existing.answers ?? {})
          setCurrentIndex(Math.min(existing.currentIndex ?? 0, data.questions.length - 1))
        } else {
          setAnswers({})
          setCurrentIndex(0)
          const savedState = readQuizState()
          savedState[storageKey] = { answers: {}, currentIndex: 0, finished: false }
          localStorage.setItem("modul_quiz_state", JSON.stringify(savedState))
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [params.slug])

  const questions = quiz?.questions ?? []
  const currentQuestion = questions[currentIndex]
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined
  const isChecked = currentAnswer !== undefined
  const isCorrect = Boolean(currentQuestion && answerIsCorrect(currentQuestion, currentAnswer))
  const correctCount = questions.filter((question) => answerIsCorrect(question, answers[question.id])).length
  const progress = questions.length ? (currentIndex / questions.length) * 100 : 0
  const scorePercent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0
  const passed = Boolean(quiz && scorePercent >= quiz.passingScore)

  React.useEffect(() => {
    if (!currentQuestion) return
    const savedAnswer = parsedAnswer(answers[currentQuestion.id])
    setSelectedOptionId(typeof savedAnswer === "string" ? savedAnswer : null)
    setWordAnswer(currentQuestion.questionType === "word_order" && Array.isArray(savedAnswer) ? savedAnswer.map(String) : [])
    setMatchingAnswer(currentQuestion.questionType === "matching" && savedAnswer && typeof savedAnswer === "object" && !Array.isArray(savedAnswer) ? savedAnswer as Record<string, string> : {})
    setSpeechResult(currentQuestion.questionType === "speaking" && savedAnswer && typeof savedAnswer === "object" && !Array.isArray(savedAnswer) && "transcript" in savedAnswer && "accuracy" in savedAnswer
      ? { transcript: String(savedAnswer.transcript), accuracy: Number(savedAnswer.accuracy) }
      : null)
    setPendingMatchLeft(null)
    setSpeechError(null)
  }, [currentQuestion?.id, answers])

  React.useEffect(() => () => recognitionRef.current?.stop(), [])

  const shuffledWordBank = React.useMemo(
    () => currentQuestion?.questionType === "word_order" ? shuffle(currentQuestion.options) : [],
    [currentQuestion?.id],
  )
  const shuffledMatchingRight = React.useMemo(
    () => currentQuestion?.matching ? shuffle(currentQuestion.matching.right) : [],
    [currentQuestion?.id],
  )

  function saveState(nextAnswers: Record<string, string>, nextIndex: number, isFinished = false) {
    const storageKey = `modul_quiz_${params.slug}`
    const savedState = readQuizState()
    savedState[storageKey] = { answers: nextAnswers, currentIndex: nextIndex, finished: isFinished }
    localStorage.setItem("modul_quiz_state", JSON.stringify(savedState))
  }

  function handleCheckAnswer() {
    if (!currentQuestion || isChecked) return
    let answerValue: string | null = null
    if (currentQuestion.questionType === "word_order") {
      if (!currentQuestion.correctOrder?.length || wordAnswer.length !== currentQuestion.correctOrder.length) return
      answerValue = JSON.stringify(wordAnswer)
    } else if (currentQuestion.questionType === "matching") {
      if (!currentQuestion.matching?.left.length || currentQuestion.matching.correctPairs.length !== currentQuestion.matching.left.length || Object.keys(matchingAnswer).length !== currentQuestion.matching.left.length) return
      answerValue = JSON.stringify(matchingAnswer)
    } else if (currentQuestion.questionType === "speaking") {
      if (!speechResult) return
      answerValue = JSON.stringify(speechResult)
    } else {
      if (!selectedOptionId) return
      answerValue = selectedOptionId
    }
    const nextAnswers = { ...answers, [currentQuestion.id]: answerValue }
    setAnswers(nextAnswers)
    saveState(nextAnswers, currentIndex)
  }

  function startSpeakingAttempt() {
    if (!currentQuestion) return
    setSpeechError(null)
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      setSpeechError("Browser ini belum mendukung pengenalan suara. Coba gunakan Chrome terbaru.")
      return
    }
    const target = currentQuestion.options.find((option) => option.id === currentQuestion.correctOptionId)?.text
    if (!target) {
      setSpeechError("Teks target speaking belum tersedia pada data soal.")
      return
    }
    setSpeechResult(null)
    const recognition = new Recognition()
    recognition.lang = "zh-CN"
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim()
      setSpeechResult({ transcript, accuracy: scorePronunciation(transcript, target) })
      setIsRecording(false)
    }
    recognition.onerror = () => {
      setSpeechError("Gagal mendengarkan. Pastikan izin mikrofon diberikan, lalu coba lagi.")
      setIsRecording(false)
    }
    recognition.onend = () => setIsRecording(false)
    recognitionRef.current = recognition
    setIsRecording(true)
    recognition.start()
  }

  function chooseMatchRight(rightId: string) {
    if (!pendingMatchLeft) return
    setMatchingAnswer((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([leftId, currentRight]) => leftId !== pendingMatchLeft && currentRight !== rightId))
      next[pendingMatchLeft] = rightId
      return next
    })
    setPendingMatchLeft(null)
  }

  async function handleNext() {
    if (!quiz || !currentQuestion || !isChecked) return
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setSelectedOptionId(answers[questions[nextIndex].id] ?? null)
      saveState(answers, nextIndex)
      return
    }

    setSaving(true)
    try {
      await saveQuizResult(quiz.moduleId, scorePercent, passed)
      saveState(answers, currentIndex, true)
      setFinished(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Skor kuis gagal disimpan.")
    } finally {
      setSaving(false)
    }
  }

  function handlePrevious() {
    if (currentIndex <= 0) return
    const previousIndex = currentIndex - 1
    setCurrentIndex(previousIndex)
    setSelectedOptionId(answers[questions[previousIndex].id] ?? null)
    saveState(answers, previousIndex)
  }

  function handleRetry() {
    setAnswers({})
    setSelectedOptionId(null)
    setCurrentIndex(0)
    setFinished(false)
    setError(null)
    setWordAnswer([])
    setMatchingAnswer({})
    setSpeechResult(null)
    saveState({}, 0)
  }

  if (loading) return <PageLoader />

  if (error || !quiz) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-red-400">{error ?? "Kuis tidak ditemukan."}</p>
        <Link href={`/dashboard/modul/${params.slug}`} className="text-sm text-primary hover:underline">Kembali ke modul</Link>
      </div>
    )
  }

  if (finished) {
    const circumference = 2 * Math.PI * 54
    const ringOffset = circumference - (scorePercent / 100) * circumference
    const scoreColor = passed ? "#34d399" : "#f87171"
    return (
      <div className="relative flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center gap-7 overflow-hidden p-5 text-foreground sm:p-8">
        <ResultWatermark />
        <div className="relative z-10 flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">{passed ? "Kuis Selesai!" : "Perlu Mengulang"}</h1>
          <p className="text-sm text-muted-foreground">{questions.length} soal dijawab · Batas lulus {quiz.passingScore}%</p>
        </div>

        <div className="relative z-10 flex items-center justify-center">
          <svg width="152" height="152" viewBox="0 0 120 120" className="-rotate-90">
            <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/60" />
            <circle cx="60" cy="60" r="54" fill="none" stroke={scoreColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={ringOffset} />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-4xl font-bold tabular-nums">{scorePercent}%</span>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Akurasi</span>
          </div>
        </div>

        <div className="relative z-10 max-w-sm rounded-2xl border border-border/60 bg-background/75 p-4 text-center text-sm text-muted-foreground">
          {passed ? "Bagus! Modul ini berhasil diselesaikan." : `Skor kamu ${scorePercent}%. Coba ulangi kuis untuk mencapai nilai ${quiz.passingScore}%.`}
        </div>

        <div className="relative z-10 flex w-full max-w-sm gap-3">
          <button type="button" className="h-12 flex-1 rounded-2xl border border-border/60 bg-background transition-colors hover:bg-muted/50" onClick={() => router.push(`/dashboard/modul/${params.slug}`)}>Kembali</button>
          {!passed && <button type="button" className="h-12 flex-1 rounded-2xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90" onClick={handleRetry}><RotateCcw className="mr-2 inline h-4 w-4" />Ulangi</button>}
        </div>
      </div>
    )
  }

  if (!currentQuestion) return null

  const typeLabels: Record<string, string> = {
    mcq: "Pilih jawaban",
    audio: "Dengarkan",
    fill_blank: "Lengkapi kalimat",
    word_order: "Susun kalimat",
    sentence_choice: "Pilih kalimat",
    matching: "Cocokkan pasangan",
    speaking: "Latihan speaking",
  }
  const typeLabel = typeLabels[currentQuestion.questionType] ?? "Pilih jawaban"
  const needsChoice = ["mcq", "audio", "fill_blank", "sentence_choice"].includes(currentQuestion.questionType)
  const canCheckAnswer = currentQuestion.questionType === "word_order"
    ? Boolean(currentQuestion.correctOrder?.length && wordAnswer.length === currentQuestion.correctOrder.length)
    : currentQuestion.questionType === "matching"
      ? Boolean(currentQuestion.matching?.left.length && currentQuestion.matching.correctPairs.length === currentQuestion.matching.left.length && Object.keys(matchingAnswer).length === currentQuestion.matching.left.length)
      : currentQuestion.questionType === "speaking"
        ? Boolean(speechResult)
        : Boolean(selectedOptionId)
  const promptParts = currentQuestion.questionText.split(/(__+|_{2,})/g)

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] min-w-0 flex-1 flex-col">
      <PracticeHeader
        title={quiz.title}
        subtitle={`${questions.length} soal · Kuis Modul`}
        progress={progress}
        rightContent={`${currentIndex + 1}/${questions.length}`}
        showStats={false}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <Link href={`/dashboard/modul/${params.slug}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Keluar ke modul</Link>
          <span>{quiz.levelLabel}</span>
        </div>

        <section className="flex flex-1 flex-col justify-center gap-5 rounded-3xl border border-border/70 bg-card p-5 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{typeLabel} · Soal {currentIndex + 1}</p>
              <h2 className="text-xl font-semibold leading-relaxed sm:text-2xl">
                {currentQuestion.questionType === "fill_blank"
                  ? promptParts.map((part, index) => /^_{2,}$/.test(part) ? <span key={index} className="mx-1 inline-block min-w-16 border-b-2 border-primary text-center text-primary">?</span> : <React.Fragment key={index}>{part}</React.Fragment>)
                  : currentQuestion.questionText}
              </h2>
            </div>
            {currentQuestion.questionType !== "speaking" ? <button type="button" aria-label="Putar soal" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:text-foreground" onClick={() => speakMandarin(currentQuestion.questionText)}><Volume2 className="h-5 w-5" /></button> : null}
          </div>

          {needsChoice ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {currentQuestion.options.map((option, optionIndex) => {
                const selected = selectedOptionId === option.id
                const correctOption = option.id === currentQuestion.correctOptionId
                const stateClass = isChecked
                  ? correctOption ? "border-emerald-500 bg-emerald-500/10 text-foreground" : selected ? "border-red-500 bg-red-500/10 text-foreground" : "border-border/50 opacity-55"
                  : selected ? "border-primary bg-primary/10 text-foreground" : "border-border/70 hover:border-primary/60 hover:bg-muted/40"
                return (
                  <button key={option.id} type="button" disabled={isChecked} aria-pressed={selected} className={`flex min-h-16 items-center gap-3 rounded-2xl border p-4 text-left transition-colors disabled:cursor-default ${stateClass}`} onClick={() => setSelectedOptionId(option.id)}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{optionIndex + 1}</span>
                    <span className="text-sm font-medium sm:text-base">{option.text}</span>
                    {option.pinyin ? <span className="text-sm text-muted-foreground">{option.pinyin}</span> : null}
                    {isChecked && correctOption ? <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-emerald-500" /> : null}
                    {isChecked && selected && !correctOption ? <XCircle className="ml-auto h-5 w-5 shrink-0 text-red-500" /> : null}
                  </button>
                )
              })}
            </div>
          ) : null}

          {currentQuestion.questionType === "word_order" ? (
            <div className="flex flex-col gap-5">
              <div className="flex min-h-20 flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/60 p-4">
                {wordAnswer.length ? wordAnswer.map((tokenId, index) => {
                  const token = currentQuestion.options.find((option) => option.id === tokenId)
                  return <button key={`${tokenId}-${index}`} type="button" disabled={isChecked} onClick={() => setWordAnswer((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl border border-primary/50 bg-primary/10 px-3 py-2 text-base font-medium">{token?.text ?? tokenId}</button>
                }) : <span className="text-sm text-muted-foreground">Ketuk kata untuk menyusun kalimat...</span>}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {shuffledWordBank.map((token) => {
                  const used = wordAnswer.includes(token.id)
                  return <button key={token.id} type="button" disabled={isChecked || used} onClick={() => setWordAnswer((current) => [...current, token.id])} className="rounded-xl border border-border/70 bg-card px-4 py-3 text-lg font-medium transition-colors hover:border-primary/60 disabled:opacity-35">{token.text}</button>
                })}
              </div>
            </div>
          ) : null}

          {currentQuestion.questionType === "matching" && currentQuestion.matching ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              {[currentQuestion.matching.left, shuffledMatchingRight].map((items, columnIndex) => (
                <div key={columnIndex} className="flex flex-col gap-2">
                  {items.map((item) => {
                    const selected = columnIndex === 0 ? pendingMatchLeft === item.id : Object.values(matchingAnswer).includes(item.id)
                    const matchedRight = columnIndex === 0 ? matchingAnswer[item.id] : undefined
                    const label = columnIndex === 0 && matchedRight
                      ? `${item.text}  ↔  ${currentQuestion.matching?.right.find((right) => right.id === matchedRight)?.text ?? ""}`
                      : item.text
                    return <button key={item.id} type="button" disabled={isChecked} onClick={() => columnIndex === 0 ? setPendingMatchLeft(item.id) : chooseMatchRight(item.id)} className={`min-h-14 rounded-2xl border p-3 text-sm font-medium transition-colors sm:p-4 sm:text-base ${selected ? "border-primary bg-primary/10" : matchedRight ? "border-emerald-500/60 bg-emerald-500/5" : "border-border/70 hover:border-primary/50"}`}>{label}</button>
                  })}
                </div>
              ))}
            </div>
          ) : null}

          {currentQuestion.questionType === "speaking" ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-background/50 p-5 text-center">
              <p className="text-sm text-muted-foreground">Tekan mikrofon, lalu ucapkan kalimat Mandarin. Nilai minimal 80% dihitung benar.</p>
              <button type="button" disabled={isChecked || isRecording} onClick={startSpeakingAttempt} className="grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"><Mic className="h-7 w-7" /></button>
              {isRecording ? <button type="button" onClick={() => recognitionRef.current?.stop()} className="text-sm font-medium text-red-500">Berhenti merekam</button> : null}
              {speechResult ? <div className="space-y-1 text-sm"><p>Hasil yang terdengar: <strong>{speechResult.transcript}</strong></p><p className={speechResult.accuracy >= 80 ? "font-semibold text-emerald-500" : "font-semibold text-red-500"}>Akurasi {speechResult.accuracy}% · target 80%</p></div> : null}
              {speechError ? <p className="text-sm text-red-500">{speechError}</p> : null}
              {speechResult && !isChecked ? <button type="button" onClick={startSpeakingAttempt} className="text-sm text-primary hover:underline">Rekam ulang</button> : null}
            </div>
          ) : null}

          {isChecked && (
            <div className={`rounded-2xl p-4 text-sm font-medium ${isCorrect ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
              {isCorrect ? <span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />Jawaban kamu benar!</span> : <span className="flex items-center gap-2"><XCircle className="h-5 w-5" />{currentQuestion.questionType === "speaking" ? `Akurasi belum mencapai 80%. Target: ${currentQuestion.options.find((option) => option.id === currentQuestion.correctOptionId)?.text ?? ""}` : currentQuestion.questionType === "word_order" ? `Urutan benar: ${(currentQuestion.correctOrder ?? []).map((id) => currentQuestion.options.find((option) => option.id === id)?.text ?? id).join(" ")}` : currentQuestion.questionType === "matching" ? "Masih ada pasangan yang tertukar." : `Belum tepat. Jawaban benar: ${currentQuestion.options.find((option) => option.id === currentQuestion.correctOptionId)?.text ?? ""}`}</span>}
            </div>
          )}
        </section>

        <footer className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
          <button type="button" disabled={currentIndex === 0} onClick={handlePrevious} className="h-11 rounded-xl px-4 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:invisible"><ArrowLeft className="mr-1.5 inline h-4 w-4" />Sebelumnya</button>
          {!isChecked ? (
            <button type="button" disabled={!canCheckAnswer || isRecording} onClick={handleCheckAnswer} className="h-11 min-w-32 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">Periksa</button>
          ) : (
            <button type="button" disabled={saving} onClick={handleNext} className="h-11 min-w-32 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60">{saving ? "Menyimpan…" : currentIndex === questions.length - 1 ? "Lihat Hasil" : "Lanjut"}</button>
          )}
        </footer>
      </main>
    </div>
  )
}
