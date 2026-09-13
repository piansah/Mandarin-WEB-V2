"use client"

import * as React from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { SnakeBoard } from "@/components/games/snake-board"
import { Button } from "@/components/ui/button"
import { Loader2, Trophy, ArrowLeft, Gamepad2, Volume2, VolumeX } from "lucide-react"
import Link from "next/link"
import { saveUserScore } from "@/lib/user-scores"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { bgmController } from "@/lib/audio-fx"

export type GameWord = {
  id: number
  hanzi: string
  pinyin: string
  arti: string
}

export default function SnakeGamePage() {
  const supa = useSupabase()
  const [words, setWords] = React.useState<GameWord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [gameState, setGameState] = React.useState<"idle" | "playing" | "gameover">("idle")
  const [score, setScore] = React.useState(0)
  const [isMuted, setIsMuted] = React.useState(false)

  React.useEffect(() => {
    if (gameState === "playing" && !isMuted) {
      bgmController.start()
    } else {
      bgmController.stop()
    }
    return () => bgmController.stop()
  }, [gameState, isMuted])

  React.useEffect(() => {
    async function fetchWords() {
      try {
        const { data, error } = await supa
          .from("flashcard_cards")
          .select("id, hanzi, pinyin, arti")
          .neq("hanzi", null)
          .neq("pinyin", null)
          .limit(100)

        if (error) throw error

        const validWords = (data as GameWord[])
          .filter((w) => w.hanzi && w.pinyin)
          .sort(() => Math.random() - 0.5)

        setWords(validWords)
      } catch (err) {
        console.error("Error fetching words for snake game:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchWords()
  }, [supa])

  const startGame = () => {
    setScore(0)
    setGameState("playing")
  }

  const handleGameOver = async (finalScore: number) => {
    setScore(finalScore)
    setGameState("gameover")

    if (finalScore > 0) {
      try {
        await saveUserScore(
          "minigame_snake" as any,
          `snake_${Date.now()}`,
          finalScore
        )
      } catch (err) {
        console.error("Failed to save score:", err)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Memuat data kosakata...</p>
      </div>
    )
  }

  if (words.length < 5) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 text-center px-6">
        <p className="text-muted-foreground">Kosakata di deck flashcard Anda belum cukup untuk bermain (minimal 5).</p>
        <Link href="/dashboard/flashcard" className={cn(buttonVariants({ variant: "default" }))}>
          Tambah Flashcard
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header — selalu tampil di semua state */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b bg-card">
        <Link
          href="/dashboard/games"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Game Hub
        </Link>

        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Ular Tebak Hanzi</span>
        </div>

        {/* Actions (Volume & Skor) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title={isMuted ? "Nyalakan Musik" : "Matikan Musik"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold font-mono transition-all",
            gameState === "idle"
              ? "opacity-0 pointer-events-none"
              : "bg-primary/10 text-primary"
          )}>
            <Trophy className="w-3.5 h-3.5" />
            {score}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center overflow-hidden">

        {gameState === "idle" && (
          <div className="flex flex-col items-center text-center max-w-md px-6 space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-5xl">🐍</span>
            </div>
            <h1 className="text-4xl font-extrabold">Ular Tebak Hanzi</h1>
            <p className="text-muted-foreground text-base">
              Gunakan tombol panah (arrow keys) atau swipe layar untuk menggerakkan ular.
              Makan karakter Hanzi yang sesuai dengan petunjuk Pinyin dan Arti yang muncul!
            </p>
            <Button size="lg" className="w-full text-lg h-14 rounded-xl" onClick={startGame}>
              Mulai Bermain
            </Button>
          </div>
        )}

        {gameState === "playing" && (
          <div className="w-full max-w-xl h-full flex flex-col min-h-0 px-3 py-2">
            <SnakeBoard
              wordsPool={words}
              onGameOver={handleGameOver}
              onScoreChange={(s) => setScore(s)}
            />
          </div>
        )}

        {gameState === "gameover" && (
          <div className="flex flex-col items-center text-center max-w-sm px-6 space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center">
              <span className="text-5xl">💥</span>
            </div>
            <h2 className="text-3xl font-bold">Game Over!</h2>
            <div className="bg-secondary p-6 rounded-2xl w-full border">
              <p className="text-muted-foreground mb-2">Skor Akhir</p>
              <p className="text-6xl font-black text-primary">{score}</p>
              <p className="text-sm text-muted-foreground mt-4">+ {score} XP ditambahkan</p>
            </div>
            <div className="flex gap-4 w-full">
              <Link
                href="/dashboard/games"
                className={cn(buttonVariants({ variant: "outline" }), "flex-1 justify-center")}
              >
                Kembali
              </Link>
              <Button className="flex-1" onClick={startGame}>Main Lagi</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
