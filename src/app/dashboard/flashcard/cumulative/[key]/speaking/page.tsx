"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Mic, Volume2, Check, RotateCcw, SkipForward, CheckCircle2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PracticeHeader } from "@/components/practice-header"
import { TonePinyin } from "@/components/tone-pinyin"
import { useSupabase } from "@/hooks/use-supabase"
import { speakMandarin } from "@/lib/tts"
import { saveUserScore } from "@/lib/user-scores"
import styles from "./page.module.css"

type HanziSet = {
  key: string
  title: string
  sub: string
}

type HanziItem = {
  id: number
  section_label: string
  section_tag: string
  sort_order: number
  hanzi: string
  pinyin: string
  arti: string
}

export default function SpeakingPracticePage() {
  const params = useParams<{ key: string }>()
  const router = useRouter()
  const key = params.key
  const supa = useSupabase()

  const [set, setSet] = React.useState<HanziSet | null>(null)
  const [items, setItems] = React.useState<HanziItem[]>([])
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isRecording, setIsRecording] = React.useState(false)
  const [recordedAudio, setRecordedAudio] = React.useState<string | null>(null)
  const [showResult, setShowResult] = React.useState(false)
  const [practiceComplete, setPracticeComplete] = React.useState(false)
  const [completedCount, setCompletedCount] = React.useState(0)

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      const [setResult, itemsResult] = await Promise.all([
        supa.from("hanzi_sets").select("key, title, sub").eq("key", key).single(),
        supa
          .from("hanzi_items")
          .select("id, section_label, section_tag, sort_order, hanzi, pinyin, arti")
          .eq("hanzi_key", key)
          .order("sort_order", { ascending: true }),
      ])

      if (cancelled) return
      if (setResult.error || !setResult.data) {
        setError("Set kalimat tidak ditemukan.")
        setLoading(false)
        return
      }
      if (itemsResult.error) {
        setError(`Gagal memuat kalimat: ${itemsResult.error.message}`)
        setLoading(false)
        return
      }

      setSet(setResult.data)
      setItems(itemsResult.data ?? [])
      setLoading(false)
    }

    load().catch(() => {
      if (!cancelled) {
        setError("Gagal memuat set kalimat.")
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [key])

  const currentItem = items[currentIndex]
  const progress = items.length ? ((currentIndex + 1) / items.length) * 100 : 0

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
        const audioUrl = URL.createObjectURL(audioBlob)
        setRecordedAudio(audioUrl)
        setShowResult(true)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error("Error accessing microphone:", err)
      alert("Gagal mengakses mikrofon. Pastikan izin mikrofon diberikan.")
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      // Stop all tracks to release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
  }

  function handleRecordAgain() {
    setRecordedAudio(null)
    setShowResult(false)
  }

  function handleNext() {
    setCompletedCount(prev => prev + 1)
    setRecordedAudio(null)
    setShowResult(false)
    
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      setPracticeComplete(true)
      // Save score for speaking practice
      saveUserScore("speaking_session", key, 100).catch(() => {})
    }
  }

  function handleSkip() {
    handleNext()
  }

  function handleRestart() {
    setCurrentIndex(0)
    setCompletedCount(0)
    setPracticeComplete(false)
    setRecordedAudio(null)
    setShowResult(false)
  }

  function handleBack() {
    router.push(`/dashboard/flashcard/cumulative/${key}`)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !set) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background p-6">
        <p className="text-sm text-red-400">{error ?? "Set kalimat tidak ditemukan."}</p>
        <Button variant="outline" onClick={handleBack}>Kembali</Button>
      </div>
    )
  }

  if (practiceComplete) {
    const pct = items.length ? Math.round((completedCount / items.length) * 100) : 0
    const circumference = 2 * Math.PI * 54
    const ringOffset = circumference - (pct / 100) * circumference
    const pctColor = pct >= 80 ? "#34d399" : pct >= 50 ? "#f59e0b" : "#f87171"

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
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Latihan Selesai!</h2>
              <p className="text-sm text-muted-foreground">{completedCount} dari {items.length} kalimat selesai</p>
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
                <span className="text-sm font-semibold text-emerald-500 tabular-nums">{completedCount}</span>
                <span className="text-xs text-muted-foreground">Selesai</span>
              </div>
              <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500/15 text-blue-500"><Star className="h-3.5 w-3.5" /></span>
                <span className="text-sm font-semibold text-blue-500 tabular-nums">{items.length}</span>
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
            </div>

            <div className="flex gap-3 w-full max-w-xs relative z-10">
              <button className="flex-1 rounded-2xl h-11 border border-border/60 bg-background hover:bg-muted/50 transition-colors" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2 inline" />
                Kembali
              </button>
              <button className="flex-1 rounded-2xl h-11 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors" onClick={handleRestart}>
                <RotateCcw className="h-4 w-4 mr-2 inline" />
                Ulangi
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className="flex flex-col flex-1 select-none relative z-10 min-h-0">
        {/* Header */}
        <PracticeHeader
          title="Latihan Speaking"
          subtitle={set.title}
          progress={progress}
          rightContent={`${currentIndex + 1}/${items.length}`}
          showStats={false}
        />

        {/* Main Content */}
        <main className="flex flex-1 flex-col items-center justify-center p-6 overflow-x-hidden">
          <Card className="w-full max-w-2xl">
            <CardContent className="p-8 space-y-6">
              {/* Sentence Display */}
              <div className="text-center space-y-4">
                <div className="font-hanzi text-4xl font-bold leading-relaxed">
                  {currentItem?.hanzi}
                </div>
                <TonePinyin text={currentItem?.pinyin || ""} className="text-xl" />
                <div className="text-lg text-muted-foreground">
                  {currentItem?.arti}
                </div>
              </div>

              {/* Audio Controls */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => speakMandarin(currentItem?.hanzi || "")}
                >
                  <Volume2 className="h-5 w-5 mr-2" />
                  Dengar Contoh
                </Button>
              </div>

              {/* Recording Section */}
              {!showResult ? (
                <div className="space-y-4">
                  <div className="text-center text-sm text-muted-foreground">
                    Tekan tombol mikrofon dan bacalah kalimat di atas
                  </div>
                  <div className="flex justify-center">
                    <Button
                      size="lg"
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`h-16 w-16 rounded-full ${isRecording ? "bg-red-500 hover:bg-red-600" : ""}`}
                    >
                      <Mic className={`h-8 w-8 ${isRecording ? "animate-pulse" : ""}`} />
                    </Button>
                  </div>
                  {isRecording && (
                    <div className="text-center text-sm text-red-400">
                      Merekam...
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center text-sm text-muted-foreground">
                    Hasil rekamanmu:
                  </div>
                  {recordedAudio && (
                    <div className="flex justify-center">
                      <audio controls src={recordedAudio} className="w-full max-w-md" />
                    </div>
                  )}
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={handleRecordAgain}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Rekam Ulang
                    </Button>
                    <Button onClick={handleNext}>
                      <Check className="h-4 w-4 mr-2" />
                      Lanjut
                    </Button>
                  </div>
                </div>
              )}

              {/* Skip Button */}
              {!showResult && (
                <div className="flex justify-center">
                  <Button variant="ghost" onClick={handleSkip}>
                    <SkipForward className="h-4 w-4 mr-2" />
                    Lewati
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
