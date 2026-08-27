"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Mic, Volume2, Check, X, RotateCcw, SkipForward, ChevronsLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
      <div className="flex min-h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !set) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-red-400">{error ?? "Set kalimat tidak ditemukan."}</p>
        <Button variant="outline" onClick={handleBack}>Kembali</Button>
      </div>
    )
  }

  if (practiceComplete) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8 space-y-4">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold">Latihan Selesai!</h2>
            <p className="text-muted-foreground">
              Kamu telah menyelesaikan {completedCount} dari {items.length} kalimat.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
              <Button onClick={handleRestart}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Ulangi
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.fullscreenContainer}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronsLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">Latihan Speaking</h1>
            <p className="truncate text-xs text-muted-foreground">{set.title}</p>
          </div>
          <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
            {currentIndex + 1}/{items.length}
          </span>
        </div>
        <div className="h-1 bg-muted">
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center p-6">
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
  )
}
