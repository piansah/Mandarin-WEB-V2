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
import { TonePinyin } from "@/components/tone-pinyin"
import { playErrorSound, playQuizCorrectSound, playSuccessSound } from "@/lib/audio-fx"
import { fetchModuleQuiz, saveQuizResult, type ModulQuiz } from "@/lib/modul"
import { speakMandarin } from "@/lib/tts"
import { PRONUNCIATION_PASS_THRESHOLD, scorePronunciation } from "@/lib/pronunciation-scoring"
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

function renderReadableQuestionText(text: string) {
  return text.split(/([\p{Script=Han}]+)/gu).map((part, index) =>
    /\p{Script=Han}/u.test(part)
      ? <span key={index} className="font-hanzi" style={{ fontWeight: 400, letterSpacing: "normal" }}>{part}</span>
      : <React.Fragment key={index}>{part}</React.Fragment>
  )
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
    const minimumAccuracy = question.minimumAccuracy ?? PRONUNCIATION_PASS_THRESHOLD
    return Boolean(result && typeof result === "object" && "accuracy" in result && Number(result.accuracy) >= minimumAccuracy)
  }
  return answer === question.correctOptionId
}

function playAnswerFeedback(correct: boolean, source: "answer" | "match" = "answer") {
  if (correct) {
    if (source === "match") playSuccessSound()
    else playQuizCorrectSound()
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(32)
    return source === "match" ? 450 : 850
  } else {
    playErrorSound()
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([45, 35, 45])
    return 400
  }
}

function getFeedbackSpeechText(question: ModulQuiz["questions"][number]): string {
  const hanzi = question.feedback?.hanzi
  return (Array.isArray(hanzi) ? hanzi : [hanzi]).filter(Boolean).join(" ")
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
  const [matchingWrongLeftIds, setMatchingWrongLeftIds] = React.useState<string[]>([])
  const [matchingWrongRightIds, setMatchingWrongRightIds] = React.useState<string[]>([])
  const matchingWrongTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingMatchLeft, setPendingMatchLeft] = React.useState<string | null>(null)
  const [speechResult, setSpeechResult] = React.useState<{ transcript: string; accuracy: number } | null>(null)
  const [speechError, setSpeechError] = React.useState<string | null>(null)
  const [isRecording, setIsRecording] = React.useState(false)
  const [feedbackDismissed, setFeedbackDismissed] = React.useState(false)
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  const feedbackTtsTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelPendingFeedbackSpeech() {
    if (feedbackTtsTimeoutRef.current) clearTimeout(feedbackTtsTimeoutRef.current)
    feedbackTtsTimeoutRef.current = null
  }

  function queueFeedbackSpeech(text: string, delayMs: number) {
    cancelPendingFeedbackSpeech()
    if (!text) return
    feedbackTtsTimeoutRef.current = setTimeout(() => {
      feedbackTtsTimeoutRef.current = null
      speakMandarin(text, { silent: true, rate: 0.8 })
    }, delayMs)
  }

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
        setFeedbackDismissed(false)
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
  const earnedAccuracy = questions.reduce((total, question) => {
    const answer = answers[question.id]
    if (question.questionType === "speaking") {
      const result = parsedAnswer(answer)
      return total + (result && typeof result === "object" && "accuracy" in result ? Math.max(0, Math.min(100, Number(result.accuracy) || 0)) : 0)
    }
    return total + (answerIsCorrect(question, answer) ? 100 : 0)
  }, 0)
  const correctCount = questions.filter((question) => answerIsCorrect(question, answers[question.id])).length
  const progress = questions.length ? (currentIndex / questions.length) * 100 : 0
  const scorePercent = questions.length ? Math.round(earnedAccuracy / questions.length) : 0
  const passed = Boolean(quiz && scorePercent >= quiz.passingScore)

  React.useEffect(() => {
    if (!currentQuestion) return
    const savedAnswer = parsedAnswer(answers[currentQuestion.id])
    setSelectedOptionId(typeof savedAnswer === "string" ? savedAnswer : null)
    setWordAnswer(currentQuestion.questionType === "word_order" && Array.isArray(savedAnswer) ? savedAnswer.map(String) : [])
    setMatchingAnswer(currentQuestion.questionType === "matching" && savedAnswer && typeof savedAnswer === "object" && !Array.isArray(savedAnswer) ? savedAnswer as Record<string, string> : {})
    setMatchingWrongLeftIds([])
    setMatchingWrongRightIds([])
    setSpeechResult(currentQuestion.questionType === "speaking" && savedAnswer && typeof savedAnswer === "object" && !Array.isArray(savedAnswer) && "transcript" in savedAnswer && "accuracy" in savedAnswer
      ? { transcript: String(savedAnswer.transcript), accuracy: Number(savedAnswer.accuracy) }
      : null)
    setPendingMatchLeft(null)
    setSpeechError(null)
  }, [currentQuestion?.id, answers])

  React.useEffect(() => () => {
    recognitionRef.current?.stop()
    if (matchingWrongTimeoutRef.current) clearTimeout(matchingWrongTimeoutRef.current)
    if (feedbackTtsTimeoutRef.current) clearTimeout(feedbackTtsTimeoutRef.current)
  }, [])

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
      const wrongPairs = currentQuestion.matching.correctPairs.filter((pair) => matchingAnswer[pair.leftId] !== pair.rightId)
      if (wrongPairs.length) {
        setMatchingWrongLeftIds(wrongPairs.map((pair) => pair.leftId))
        setMatchingWrongRightIds(wrongPairs.map((pair) => matchingAnswer[pair.leftId]).filter(Boolean))
        if (matchingWrongTimeoutRef.current) clearTimeout(matchingWrongTimeoutRef.current)
        matchingWrongTimeoutRef.current = setTimeout(() => {
          setMatchingWrongLeftIds([])
          setMatchingWrongRightIds([])
          matchingWrongTimeoutRef.current = null
        }, 1000)
        return
      }
      setMatchingWrongLeftIds([])
      setMatchingWrongRightIds([])
      answerValue = JSON.stringify(matchingAnswer)
    } else if (currentQuestion.questionType === "speaking") {
      if (!speechResult) return
      answerValue = JSON.stringify(speechResult)
    } else {
      if (!selectedOptionId) return
      answerValue = selectedOptionId
    }
    const nextAnswers = { ...answers, [currentQuestion.id]: answerValue }
    if (currentQuestion.questionType !== "matching") {
      const correct = answerIsCorrect(currentQuestion, answerValue)
      const soundDuration = playAnswerFeedback(correct)
      queueFeedbackSpeech(getFeedbackSpeechText(currentQuestion), soundDuration)
    }
    setAnswers(nextAnswers)
    setFeedbackDismissed(false)
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
    const target = currentQuestion.speakingTarget
      ?? currentQuestion.options.find((option) => option.id === currentQuestion.correctOptionId)?.text
    if (!target) {
      setSpeechError("Teks target speaking belum tersedia pada data soal.")
      return
    }
    setSpeechResult(null)
    const recognition = new Recognition()
    recognition.lang = "zh-CN"
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const spoken = event.results[0]
      const transcript = spoken[0].transcript.trim()
      if (!spoken.isFinal) return
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
    const correctPair = currentQuestion?.matching?.correctPairs.find((pair) => pair.leftId === pendingMatchLeft)
    if (correctPair?.rightId !== rightId) {
      playAnswerFeedback(false)
      setMatchingWrongLeftIds([pendingMatchLeft])
      setMatchingWrongRightIds([rightId])
      if (matchingWrongTimeoutRef.current) clearTimeout(matchingWrongTimeoutRef.current)
      matchingWrongTimeoutRef.current = setTimeout(() => {
        setMatchingWrongLeftIds([])
        setMatchingWrongRightIds([])
        matchingWrongTimeoutRef.current = null
      }, 1000)
      return
    }

    playAnswerFeedback(true, "match")
    if (matchingWrongTimeoutRef.current) clearTimeout(matchingWrongTimeoutRef.current)
    matchingWrongTimeoutRef.current = null
    setMatchingWrongLeftIds([])
    setMatchingWrongRightIds([])
    setMatchingAnswer((current) => ({ ...current, [pendingMatchLeft]: rightId }))
    setPendingMatchLeft(null)
  }

  async function handleNext() {
    if (!quiz || !currentQuestion || !isChecked) return
    cancelPendingFeedbackSpeech()
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1
      setFeedbackDismissed(false)
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
    cancelPendingFeedbackSpeech()
    const previousIndex = currentIndex - 1
    setFeedbackDismissed(true)
    setCurrentIndex(previousIndex)
    setSelectedOptionId(answers[questions[previousIndex].id] ?? null)
    saveState(answers, previousIndex)
  }

  function handleRetry() {
    cancelPendingFeedbackSpeech()
    setAnswers({})
    setFeedbackDismissed(false)
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
    mcq: /baca|kalimat/i.test(currentQuestion.questionText) ? "Baca dan pilih jawaban" : "Pilihan ganda kosakata",
    true_false: "Benar atau salah",
    audio: "Dengarkan",
    fill_blank: "Lengkapi kalimat",
    word_order: "Susun kalimat",
    sentence_choice: "Pilih kalimat",
    matching: "Cocokkan pasangan",
    speaking: "Berbicara",
  }
  const typeLabel = typeLabels[currentQuestion.questionType] ?? "Pilih jawaban"
  const answersArePinyin = /\bpinyin\b/i.test(currentQuestion.questionText)
  const correctAnswerText = currentQuestion.options.find((option) => option.id === currentQuestion.correctOptionId)?.text
    ?? currentQuestion.speakingTarget
    ?? ""
  const feedbackValues = (value: string | string[] | undefined) =>
    value === undefined ? [] : Array.isArray(value) ? value : [value]
  const feedbackHanzi = feedbackValues(currentQuestion.feedback?.hanzi)
  const feedbackPinyin = feedbackValues(currentQuestion.feedback?.pinyin)
  const feedbackMeaning = feedbackValues(currentQuestion.feedback?.arti)
  const feedbackRows = Array.from({ length: Math.max(feedbackHanzi.length, feedbackPinyin.length, feedbackMeaning.length) }, (_, index) => ({
    hanzi: feedbackHanzi[index] ?? "",
    pinyin: feedbackPinyin[index] ?? "",
    meaning: feedbackMeaning[index] ?? "",
  }))
  const feedbackSpeechText = feedbackHanzi.filter(Boolean).join(" ")
  const pinyinPromptParts = currentQuestion.questionType === "word_order"
    ? currentQuestion.questionText.match(/^(.*?\bpinyin(?:\s+berikut)?\s*:\s*)(.+)$/i)
    : null
  const needsChoice = ["mcq", "true_false", "audio", "fill_blank", "sentence_choice"].includes(currentQuestion.questionType)
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
              {currentQuestion.questionType !== "matching" ? (
                <h2 className="text-xl font-semibold leading-relaxed sm:text-2xl">
                  {currentQuestion.questionType === "fill_blank"
                    ? promptParts.map((part, index) => /^_{2,}$/.test(part) ? <span key={index} className="mx-1 inline-block min-w-12 border-b-2 border-primary align-baseline" aria-label="Bagian kosong" /> : <React.Fragment key={index}>{renderReadableQuestionText(part)}</React.Fragment>)
                    : pinyinPromptParts
                      ? <>{renderReadableQuestionText(pinyinPromptParts[1])}<TonePinyin text={pinyinPromptParts[2]} className="font-semibold" /></>
                    : renderReadableQuestionText(currentQuestion.questionText)}
                </h2>
              ) : null}
            </div>
          </div>

          {needsChoice ? (
            <div className="grid grid-cols-2 gap-3">
              {currentQuestion.options.map((option, optionIndex) => {
                const selected = selectedOptionId === option.id
                const correctOption = option.id === currentQuestion.correctOptionId
                const stateClass = isChecked
                  ? correctOption ? "border-emerald-500 bg-emerald-500/10 text-foreground" : selected ? "border-red-500 bg-red-500/10 text-foreground" : "border-border/50 opacity-55"
                  : selected ? "border-primary bg-primary/10 text-foreground" : "border-border/70 hover:border-primary/60 hover:bg-muted/40"
                return (
                  <button key={option.id} type="button" disabled={isChecked} aria-pressed={selected} className={`flex min-h-16 items-center gap-3 rounded-2xl border p-4 text-left transition-colors disabled:cursor-default ${stateClass}`} onClick={() => setSelectedOptionId(option.id)}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{optionIndex + 1}</span>
                    {answersArePinyin
                      ? <TonePinyin text={option.text} className="text-sm font-medium sm:text-base" />
                      : <span className="text-sm font-medium sm:text-base">{option.text}</span>}
                    {option.pinyin ? <TonePinyin text={option.pinyin} className="text-sm" /> : null}
                    {isChecked && correctOption ? <CheckCircle2 className="ml-auto hidden h-5 w-5 shrink-0 text-emerald-500 md:block" /> : null}
                    {isChecked && selected && !correctOption ? <XCircle className="ml-auto hidden h-5 w-5 shrink-0 text-red-500 md:block" /> : null}
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
                  return (
                    <button key={`${tokenId}-${index}`} type="button" disabled={isChecked} onClick={() => setWordAnswer((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="flex flex-col items-center gap-1 rounded-xl border border-primary/50 bg-primary/10 px-3 py-2 text-base font-medium">
                      <span>{token?.text ?? tokenId}</span>
                      {!answersArePinyin && token?.pinyin ? <TonePinyin text={token.pinyin} className="text-xs" /> : null}
                    </button>
                  )
                }) : <span className="text-sm text-muted-foreground">Ketuk kata untuk menyusun kalimat...</span>}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {shuffledWordBank.map((token) => {
                  const used = wordAnswer.includes(token.id)
                  return (
                    <button key={token.id} type="button" disabled={isChecked || used} onClick={() => { setWordAnswer((current) => [...current, token.id]); if (!answersArePinyin) speakMandarin(token.text) }} className="flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-card px-4 py-3 text-lg font-medium transition-colors hover:border-primary/60 disabled:opacity-35">
                      <span>{token.text}</span>
                      {!answersArePinyin && token.pinyin ? <TonePinyin text={token.pinyin} className="text-xs" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {currentQuestion.questionType === "matching" && currentQuestion.matching ? (
            <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-5">
              {[currentQuestion.matching.left, shuffledMatchingRight].map((items, columnIndex) => (
                <div key={columnIndex} className="grid auto-rows-fr gap-2">
                  {items.map((item) => {
                    const matched = columnIndex === 0
                      ? matchingAnswer[item.id] !== undefined
                      : Object.values(matchingAnswer).includes(item.id)
                    const selected = columnIndex === 0 ? pendingMatchLeft === item.id : matched
                    const matchedRight = columnIndex === 0 ? matchingAnswer[item.id] : undefined
                    const isWrong = columnIndex === 0
                      ? matchingWrongLeftIds.includes(item.id)
                      : matchingWrongRightIds.includes(item.id)
                    return <button key={item.id} type="button" disabled={isChecked || matched} onClick={() => {
                      if (columnIndex === 0) {
                        if (matchingWrongTimeoutRef.current) clearTimeout(matchingWrongTimeoutRef.current)
                        matchingWrongTimeoutRef.current = null
                        setMatchingWrongLeftIds([])
                        setMatchingWrongRightIds([])
                        setPendingMatchLeft(item.id)
                      } else {
                        chooseMatchRight(item.id)
                      }
                    }} className={`h-full min-h-14 rounded-2xl border p-3 text-sm font-medium transition-colors sm:p-4 sm:text-base ${isWrong ? "border-red-500 bg-red-500/10 text-red-400" : matchedRight || (columnIndex === 1 && matched) ? "border-emerald-500/60 bg-emerald-500/5" : selected ? "border-primary bg-primary/10" : "border-border/70 hover:border-border hover:bg-muted/40"}`}>{item.text}</button>
                  })}
                </div>
              ))}
            </div>
          ) : null}

          {currentQuestion.questionType === "speaking" ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-background/50 p-5 text-center">
              <p className="text-3xl font-bold tracking-wide text-foreground">{currentQuestion.speakingTarget ?? correctAnswerText}</p>
              <p className="text-sm text-muted-foreground">Tekan mikrofon, lalu ucapkan Hanzi di atas. Nilai minimal {currentQuestion.minimumAccuracy ?? PRONUNCIATION_PASS_THRESHOLD}% dihitung lulus.</p>
              <button type="button" disabled={isChecked || isRecording} onClick={startSpeakingAttempt} className="grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"><Mic className="h-7 w-7" /></button>
              {isRecording ? <button type="button" data-bottom-accent="off" onClick={() => recognitionRef.current?.stop()} className="text-sm font-medium text-red-500">Berhenti merekam</button> : null}
              {speechResult ? <div className="space-y-1 text-sm"><p>Hasil yang terdengar: <strong>{speechResult.transcript}</strong></p><p className={speechResult.accuracy >= (currentQuestion.minimumAccuracy ?? PRONUNCIATION_PASS_THRESHOLD) ? "font-semibold text-emerald-500" : "font-semibold text-red-500"}>Akurasi {speechResult.accuracy}% · target {currentQuestion.minimumAccuracy ?? PRONUNCIATION_PASS_THRESHOLD}%</p></div> : null}
              {speechError ? <p className="text-sm text-red-500">{speechError}</p> : null}
              {speechResult && !isChecked ? <button type="button" data-bottom-accent="off" onClick={startSpeakingAttempt} className="text-sm text-primary hover:underline">Rekam ulang</button> : null}
            </div>
          ) : null}

        </section>

        {!isChecked || feedbackDismissed ? <footer className={`flex items-center gap-3 border-t border-border/70 pt-4 ${currentIndex === 0 ? "justify-center md:justify-between" : "justify-between"}`}>
          <button type="button" disabled={currentIndex === 0} onClick={handlePrevious} className={`h-11 rounded-xl px-4 text-sm text-muted-foreground transition-colors hover:text-foreground ${currentIndex === 0 ? "hidden md:inline-flex md:invisible" : ""}`}><ArrowLeft className="mr-1.5 inline h-4 w-4" />Sebelumnya</button>
          {isChecked ? (
            <button type="button" disabled={saving} onClick={handleNext} className={`h-11 min-w-32 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 ${currentIndex === 0 ? "w-full md:w-auto" : ""}`}>{saving ? "Menyimpan…" : currentIndex === questions.length - 1 ? "Lihat Hasil" : "Lanjut"}</button>
          ) : (
            <button type="button" disabled={!canCheckAnswer || isRecording} onClick={handleCheckAnswer} className="h-11 min-w-32 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">Periksa</button>
          )}
        </footer> : null}
      </main>

      {isChecked && !feedbackDismissed ? (
        <aside className="fixed inset-x-0 bottom-0 z-30 px-3 md:left-[var(--sidebar-width)] md:px-6" aria-live="polite">
          <div className={`mx-auto flex w-full max-w-3xl animate-in slide-in-from-bottom-6 fade-in flex-col gap-3 rounded-t-3xl border-2 px-5 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(0,0,0,0.22)] duration-300 md:rounded-3xl md:pb-4 ${isCorrect ? "border-emerald-500/40 bg-emerald-950 text-emerald-300" : "border-red-500/40 bg-red-950 text-red-200"}`}>
            <div className="flex items-center gap-2 font-semibold">
              {isCorrect ? <CheckCircle2 className="hidden h-5 w-5 shrink-0 md:block" /> : <XCircle className="hidden h-5 w-5 shrink-0 md:block" />}
              {isCorrect ? "Jawaban kamu benar!" : currentQuestion.questionType === "speaking" ? `Akurasi belum mencapai ${currentQuestion.minimumAccuracy ?? PRONUNCIATION_PASS_THRESHOLD}%.` : "Belum tepat. Pelajari jawaban yang benar:"}
            </div>

            {feedbackRows.length && currentQuestion.questionType !== "matching" ? (
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  data-bottom-accent="off"
                  disabled={!feedbackSpeechText}
                  aria-label="Putar pelafalan Hanzi"
                  onClick={() => feedbackSpeechText && speakMandarin(feedbackSpeechText)}
                  className="flex min-w-0 flex-1 flex-col items-start gap-2 text-left disabled:cursor-default"
                >
                  {feedbackRows.map((row, index) => (
                    <span key={index} className="flex min-w-0 flex-col items-start gap-0.5">
                      <span className="text-lg font-bold text-white">{row.hanzi}</span>
                      {row.pinyin ? <span><TonePinyin text={row.pinyin} className="text-sm" /></span> : null}
                      {row.meaning ? <span className="text-sm text-white/75">{row.meaning}</span> : null}
                    </span>
                  ))}
                </button>
                <button
                  type="button"
                  data-bottom-accent="off"
                  disabled={!feedbackSpeechText}
                  aria-label="Putar Hanzi"
                  onClick={() => feedbackSpeechText && speakMandarin(feedbackSpeechText)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-current/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
            ) : !isCorrect ? (
              <p className="text-sm text-white/80">
                {currentQuestion.questionType === "word_order"
                  ? `Urutan benar: ${(currentQuestion.correctOrder ?? []).map((id) => currentQuestion.options.find((option) => option.id === id)?.text ?? id).join(" ")}`
                  : currentQuestion.questionType === "matching"
                    ? "Masih ada pasangan yang tertukar."
                    : `Jawaban benar: ${correctAnswerText}`}
              </p>
            ) : null}

            <button type="button" disabled={saving} onClick={handleNext} className={`h-11 w-full rounded-xl font-bold transition-colors disabled:opacity-60 ${isCorrect ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400" : "bg-red-500 text-red-950 hover:bg-red-400"}`}>
              {saving ? "Menyimpan…" : currentIndex === questions.length - 1 ? "Lihat Hasil" : "Lanjut"}
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  )
}
