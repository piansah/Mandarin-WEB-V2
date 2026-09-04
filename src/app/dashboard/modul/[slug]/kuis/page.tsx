"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { RotateCcw, ArrowLeft, CheckCircle2, XCircle, PartyPopper, ChevronRight } from "lucide-react"
import { fetchModuleQuiz, saveQuizResult, type ModulQuiz } from "@/lib/modul"

export default function ModulKuisPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()

  const [quiz, setQuiz] = React.useState<ModulQuiz | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Jawaban yang sudah dikirim per soal: questionId -> optionId
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  // Pilihan yang sedang aktif di layar (belum tentu sudah dikirim)
  const [selectedOptionId, setSelectedOptionId] = React.useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [finished, setFinished] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

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
        setQuiz(data)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [params.slug])



  const questions = quiz?.questions ?? []
  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const answeredCount = Object.keys(answers).length

  function handleSelectOption(optionId: string) {
    setSelectedOptionId(optionId)
  }

  function handleReset() {
    setSelectedOptionId(null)
  }

  function handlePrevious() {
    if (currentIndex === 0) return
    const prevIndex = currentIndex - 1
    setCurrentIndex(prevIndex)
    setSelectedOptionId(answers[questions[prevIndex].id] ?? null)
  }

  async function handleSubmitAnswer() {
    if (!selectedOptionId || !quiz) return

    const isAnswered = Boolean(answers[currentQuestion.id])

    if (isAnswered) {
      if (isLastQuestion) {
        // Hitung skor akhir & simpan hasil.
        const correctCount = questions.filter((q) => answers[q.id] === q.correctOptionId).length
        const scorePercent = Math.round((correctCount / questions.length) * 100)
        const passed = scorePercent >= quiz.passingScore

        setSaving(true)
        await saveQuizResult(quiz.moduleId, scorePercent, passed)
        setSaving(false)
        setFinished(true)
      } else {
        const nextIndex = currentIndex + 1
        setCurrentIndex(nextIndex)
        setSelectedOptionId(answers[questions[nextIndex].id] ?? null)
      }
      return
    }

    const nextAnswers = { ...answers, [currentQuestion.id]: selectedOptionId }
    setAnswers(nextAnswers)
  }

  function goToQuestion(index: number) {
    // Hanya izinkan lompat ke soal yang sudah pernah dijawab, atau satu
    // langkah maju dari yang terakhir dijawab, supaya alurnya tetap runtut.
    const targetAnswered = Boolean(answers[questions[index].id])
    const isNextUnanswered = index === answeredCount
    if (!targetAnswered && !isNextUnanswered) return
    setCurrentIndex(index)
    setSelectedOptionId(answers[questions[index].id] ?? null)
  }

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (finished || saving) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Tombol 1-4 untuk memilih opsi
      if (['1', '2', '3', '4'].includes(e.key)) {
        const optionIndex = parseInt(e.key) - 1
        if (currentQuestion?.options[optionIndex]) {
          // Hanya izinkan pilih jika belum disubmit/dijawab
          if (!answers[currentQuestion.id]) {
            handleSelectOption(currentQuestion.options[optionIndex].id)
          }
        }
      }

      // Enter untuk submit/lanjut
      if (e.key === 'Enter') {
        if (selectedOptionId) {
          void handleSubmitAnswer()
        }
      }

      // ArrowLeft untuk soal sebelumnya
      if (e.key === 'ArrowLeft') {
        handlePrevious()
      }

      // ArrowRight untuk soal selanjutnya (jika diizinkan)
      if (e.key === 'ArrowRight') {
        if (currentIndex < questions.length - 1) {
          goToQuestion(currentIndex + 1)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentIndex, currentQuestion, selectedOptionId, answers, saving, finished, questions.length])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm text-red-400">{error ?? "Kuis tidak ditemukan."}</p>
        <Link href={`/dashboard/modul/${params.slug}`} className="text-sm text-primary hover:underline">
          Kembali ke modul
        </Link>
      </div>
    )
  }

  if (finished) {
    const correctCount = questions.filter((q) => answers[q.id] === q.correctOptionId).length
    const scorePercent = Math.round((correctCount / questions.length) * 100)
    const passed = scorePercent >= quiz.passingScore

    return (
      <div className="flex flex-col max-w-2xl mx-auto p-4 md:p-6 gap-6 text-foreground min-h-[70vh] justify-center">
        <div className="flex flex-col items-center text-center gap-4">
          {passed ? (
            <PartyPopper className="w-12 h-12 text-primary" />
          ) : (
            <XCircle className="w-12 h-12 text-red-400" />
          )}
          <h1 className="text-2xl sm:text-3xl font-bold">
            {passed ? "Selamat, kamu lulus kuis!" : "Belum lulus, coba lagi ya"}
          </h1>
          <p className="text-muted-foreground">
            Skor kamu <span className="font-bold text-foreground">{scorePercent}%</span> ({correctCount} dari{" "}
            {questions.length} benar). Minimal kelulusan adalah {quiz.passingScore}%.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
          {!passed && (
            <Button
              variant="outline"
              className="rounded-full px-6 h-12"
              onClick={() => {
                setAnswers({})
                setSelectedOptionId(null)
                setCurrentIndex(0)
                setFinished(false)
              }}
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Ulangi kuis
            </Button>
          )}
          <Button
            className="rounded-full px-6 h-12 bg-foreground text-background hover:bg-foreground/90"
            onClick={() => router.push("/dashboard/modul")}
          >
            Kembali ke daftar modul
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col max-w-6xl mx-auto p-4 md:p-6 gap-6 text-foreground">
      {/* Top Bar: Breadcrumbs & Progress */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur pb-4 pt-4 md:pt-6 -mt-4 md:-mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm text-muted-foreground border-b mb-4">
        
        {/* Desktop Breadcrumb */}
        <div className="hidden sm:flex items-center gap-2 overflow-x-auto whitespace-nowrap w-full sm:w-auto pb-2 sm:pb-0 hide-scrollbar">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Beranda</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <Link href="/dashboard/modul" className="hover:text-foreground transition-colors">Modul</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <Link href={`/dashboard/modul/${params.slug}`} className="hover:text-foreground transition-colors">{quiz.levelLabel}</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <span className="text-foreground font-medium">Kuis: {quiz.title}</span>
        </div>

        {/* Mobile Back Button */}
        <div className="flex sm:hidden items-center">
          <Link href={`/dashboard/modul/${params.slug}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Modul
          </Link>
        </div>

        {/* Progress Bar (Desktop Only) */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <span>Soal {currentIndex + 1}/{questions.length}</span>
          <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-2 w-24 sm:w-32" />
        </div>
      </div>

      <div className="flex flex-col w-full gap-6">
        {/* Header */}
        <div>
          <div className="text-primary font-bold text-sm tracking-wider mb-2 uppercase">
            KUIS MODUL · {quiz.levelLabel.split(" - ")[0]}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">{quiz.title}</h1>
          <p className="text-sm text-muted-foreground">
            Soal diambil dari evaluasi modul ini. Raih minimal {quiz.passingScore}% untuk menandai modul selesai.
          </p>
        </div>

      {/* Kartu Soal */}
      <div className="border rounded-2xl p-5 sm:p-6 bg-card flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="bg-primary/10 text-primary font-medium">
              Pilihan Ganda
            </Badge>
            <span className="text-sm sm:text-base font-medium">{currentQuestion.questionText}</span>
          </div>
          <button
            onClick={handleReset}
            disabled={!selectedOptionId}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>

        <div className={`grid ${currentQuestion.options.every(o => o.text.length < 25) ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"} gap-3`}>
          {currentQuestion.options.map((option, i) => {
            const isSelected = selectedOptionId === option.id
            const isAnswered = Boolean(answers[currentQuestion.id])
            const isCorrectOption = option.id === currentQuestion.correctOptionId
            const isWrongSelected = isSelected && !isCorrectOption

            let optionClass = "border-muted hover:border-muted-foreground/40 hover:bg-muted/40"
            let badgeClass = "bg-muted text-muted-foreground"

            if (isAnswered) {
              if (isCorrectOption) {
                optionClass = "border-primary bg-primary/5 ring-1 ring-primary"
                badgeClass = "bg-primary text-primary-foreground"
              } else if (isWrongSelected) {
                optionClass = "border-red-500 bg-red-500/5 ring-1 ring-red-500"
                badgeClass = "bg-red-500 text-white"
              } else {
                optionClass = "border-muted opacity-50"
              }
            } else if (isSelected) {
              optionClass = "border-primary bg-primary/5"
              badgeClass = "bg-primary text-primary-foreground"
            }

            return (
              <button
                key={option.id}
                onClick={() => handleSelectOption(option.id)}
                disabled={isAnswered}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${optionClass}`}
              >
                <span
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${badgeClass}`}
                >
                  {i + 1}
                </span>
                <span className="text-sm">{option.text}</span>
              </button>
            )
          })}
        </div>

        {/* Feedback Section */}
        {answers[currentQuestion.id] && (
          <div className={`p-4 rounded-xl text-sm font-medium ${
            answers[currentQuestion.id] === currentQuestion.correctOptionId 
              ? "bg-primary/10 text-primary" 
              : "bg-red-500/10 text-red-500"
          }`}>
            {answers[currentQuestion.id] === currentQuestion.correctOptionId ? (
              <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Jawaban kamu benar!</span>
            ) : (
              <span className="flex items-center gap-2"><XCircle className="w-5 h-5" /> Jawaban kurang tepat.</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" /> Sebelumnya
          </button>
          <Button
            className="rounded-full px-6 bg-foreground text-background hover:bg-foreground/90"
            disabled={!selectedOptionId || saving}
            onClick={handleSubmitAnswer}
          >
            {saving ? "Menyimpan..." : answers[currentQuestion.id] ? (isLastQuestion ? "Selesaikan kuis" : "Selanjutnya") : "Cek jawaban"}
          </Button>
        </div>
      </div>

      {/* Pagination nomor soal */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {questions.map((q, i) => {
          const isCurrent = i === currentIndex
          const isAnswered = Boolean(answers[q.id])
          return (
            <button
              key={q.id}
              onClick={() => goToQuestion(i)}
              className={`w-8 h-8 rounded-md text-xs font-bold flex items-center justify-center transition-colors ${
                isCurrent
                  ? "bg-foreground text-background"
                  : isAnswered
                    ? answers[q.id] === q.correctOptionId ? "bg-primary/10 text-primary" : "bg-red-500/10 text-red-500"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isAnswered && !isCurrent ? (
                answers[q.id] === q.correctOptionId ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />
              ) : (
                i + 1
              )}
            </button>
          )
        })}
      </div>
        {/* Keyboard hints */}
        <div className="hidden sm:flex items-center justify-center gap-4 flex-wrap text-xs text-muted-foreground mt-2 w-full">
          <span className="flex items-center gap-1.5"><kbd className="border rounded-md px-1.5 py-0.5 bg-muted/50 font-sans">1</kbd> - <kbd className="border rounded-md px-1.5 py-0.5 bg-muted/50 font-sans">4</kbd> pilih jawaban</span>
          <span className="flex items-center gap-1.5"><kbd className="border rounded-md px-1.5 py-0.5 bg-muted/50 font-sans">Enter</kbd> kirim</span>
          <span className="flex items-center gap-1.5"><kbd className="border rounded-md px-1.5 py-0.5 bg-muted/50 font-sans">←</kbd> <kbd className="border rounded-md px-1.5 py-0.5 bg-muted/50 font-sans">→</kbd> pindah soal</span>
        </div>
      </div>
    </div>
  )
}
