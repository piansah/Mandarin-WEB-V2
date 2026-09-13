"use client"

import * as React from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { SpeedrunBoard } from "@/components/games/speedrun-board"
import { Button } from "@/components/ui/button"
import { Loader2, Trophy, ArrowLeft, Gamepad2, Volume2, VolumeX, ChevronRight, Lock } from "lucide-react"
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

type FlashcardSet = {
  id: number
  title: string
  hsk_level: number
  sort_order: number
}

type Stage = {
  index: number       // 1-based stage number within HSK level
  sets: FlashcardSet[]
  label: string
}

export default function SpeedrunGamePage() {
  const supa = useSupabase()

  // --- Data ---
  const [allSets, setAllSets] = React.useState<FlashcardSet[]>([])
  const [loading, setLoading] = React.useState(true)

  // --- Navigation state ---
  const [selectedHsk, setSelectedHsk] = React.useState<number | null>(null)
  const [selectedStage, setSelectedStage] = React.useState<Stage | null>(null)

  // --- Game state ---
  const [words, setWords] = React.useState<GameWord[]>([])
  const [gameState, setGameState] = React.useState<"idle" | "stage-select" | "playing" | "gameover">("idle")
  const [score, setScore] = React.useState(0)
  const [isMuted, setIsMuted] = React.useState(false)
  const [isWin, setIsWin] = React.useState(false)

  // Track cleared stages per HSK level in localStorage
  // key: `speedrun_cleared_hsk${level}` → Set of stage indexes (1-based)
  const [clearedStages, setClearedStages] = React.useState<Record<number, Set<number>>>({})

  const loadCleared = React.useCallback(() => {
    const result: Record<number, Set<number>> = {}
    for (const key of Object.keys(localStorage)) {
      const match = key.match(/^speedrun_cleared_hsk(\d+)$/)
      if (match) {
        const level = parseInt(match[1])
        try {
          const arr: number[] = JSON.parse(localStorage.getItem(key) || "[]")
          result[level] = new Set(arr)
        } catch { }
      }
    }
    return result
  }, [])

  React.useEffect(() => {
    setClearedStages(loadCleared())
  }, [loadCleared])

  const markStageCleared = (hskLevel: number, stageIndex: number) => {
    const key = `speedrun_cleared_hsk${hskLevel}`
    const existing: number[] = JSON.parse(localStorage.getItem(key) || "[]")
    if (!existing.includes(stageIndex)) {
      existing.push(stageIndex)
      localStorage.setItem(key, JSON.stringify(existing))
    }
    setClearedStages(prev => ({
      ...prev,
      [hskLevel]: new Set([...(prev[hskLevel] ?? []), stageIndex])
    }))
  }

  // BGM
  React.useEffect(() => {
    if (gameState === "playing" && !isMuted) {
      bgmController.start("speedrun")
    } else {
      bgmController.stop()
    }
    return () => bgmController.stop()
  }, [gameState, isMuted])

  // Fetch all default flashcard sets
  React.useEffect(() => {
    async function fetchSets() {
      try {
        const { data, error } = await supa
          .from("flashcard_sets")
          .select("id, title, hsk_level, sort_order")
          .eq("is_default", true)
          .order("hsk_level", { ascending: true })
          .order("sort_order", { ascending: true })
        if (error) throw error
        setAllSets(data || [])
      } catch (err) {
        console.error("Error fetching sets:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchSets()
  }, [supa])

  // Unique HSK levels available
  const hskLevels = React.useMemo(() => {
    const levels = [...new Set(allSets.map(s => s.hsk_level))].sort((a, b) => a - b)
    return levels
  }, [allSets])

  // Build stages for selected HSK level (3 decks per stage)
  const stages = React.useMemo<Stage[]>(() => {
    if (selectedHsk === null) return []
    const levelSets = allSets.filter(s => s.hsk_level === selectedHsk)
    const result: Stage[] = []
    for (let i = 0; i < levelSets.length; i += 3) {
      const chunk = levelSets.slice(i, i + 3)
      result.push({
        index: result.length + 1,
        sets: chunk,
        label: chunk.map(s => s.title).join(" + "),
      })
    }
    return result
  }, [allSets, selectedHsk])

  // Load words for a stage
  const loadStageWords = React.useCallback(async (stage: Stage) => {
    setLoading(true)
    try {
      const setIds = stage.sets.map(s => s.id)
      const { data, error } = await supa
        .from("flashcard_cards")
        .select("id, hanzi, pinyin, arti")
        .in("set_id", setIds)
        .neq("hanzi", null)
        .neq("pinyin", null)
      if (error) throw error
      const valid = (data as GameWord[]).filter(w => w.hanzi && w.pinyin)
      // Shuffle the valid words
      valid.sort(() => Math.random() - 0.5)
      setWords(valid)
    } catch (err) {
      console.error("Error loading stage words:", err)
    } finally {
      setLoading(false)
    }
  }, [supa])

  const handleSelectHsk = (level: number) => {
    setSelectedHsk(level)
    setGameState("stage-select")
    history.pushState({ speedrun: "stage-select" }, "")
  }

  const handleSelectStage = async (stage: Stage) => {
    setSelectedStage(stage)
    await loadStageWords(stage)
    setScore(0)
    setIsWin(false)
    setGameState("playing")
    history.pushState({ speedrun: "playing" }, "")
  }

  const handleGameOver = async (finalScore: number, win = false) => {
    setScore(finalScore)
    setIsWin(win)
    setGameState("gameover")
    // In Speedrun, completing the time means clearing the stage
    if (win && selectedStage && selectedHsk !== null) {
      markStageCleared(selectedHsk, selectedStage.index)
    }
    if (finalScore > 0) {
      try {
        await saveUserScore("minigame_speedrun" as any, `speedrun_${Date.now()}`, finalScore)
      } catch (err) {
        console.error("Failed to save score:", err)
      }
    }
  }

  const goBackToStages = () => {
    setSelectedStage(null)
    setWords([])
    setGameState("stage-select")
  }

  const goBackToHsk = () => {
    setSelectedHsk(null)
    setSelectedStage(null)
    setWords([])
    setGameState("idle")
  }

  // Intercept mouse back button / browser history back
  React.useEffect(() => {
    const handlePopState = () => {
      setGameState(prev => {
        if (prev === "playing" || prev === "gameover") {
          setSelectedStage(null)
          setWords([])
          return "stage-select"
        }
        if (prev === "stage-select") {
          setSelectedHsk(null)
          setSelectedStage(null)
          setWords([])
          return "idle"
        }
        return prev
      })
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b bg-card">
        {gameState === "idle" ? (
          <Link
            href="/dashboard/games"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Game Hub
          </Link>
        ) : (
          <button
            onClick={
              gameState === "stage-select" ? goBackToHsk :
                gameState === "playing" || gameState === "gameover" ? goBackToStages :
                  undefined
            }
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {gameState === "stage-select" ? "Pilih Level HSK" : "Pilih Stage"}
          </button>
        )}

        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Flashcard Speedrun</span>
        </div>

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
            gameState === "playing" || gameState === "gameover"
              ? "bg-primary/10 text-primary"
              : "opacity-0 pointer-events-none"
          )}>
            <Trophy className="w-3.5 h-3.5" />
            {score}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col items-center overflow-auto p-4 bg-gradient-to-b from-background to-secondary/10">

        {/* === Idle: Pick HSK Level === */}
        {gameState === "idle" && !loading && (
          <div className="flex flex-col items-center text-center max-w-md w-full space-y-6 my-auto animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
              <span className="text-5xl">⚡</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">Flashcard Speedrun</h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Uji refleks dan seberapa cepat Anda mengingat! Jawab sebanyak mungkin flashcard dengan benar dalam waktu 60 detik.
            </p>
            <div className="text-muted-foreground text-sm font-medium mb-2">Pilih level HSK untuk mulai bermain:</div>

            <div className="flex flex-col gap-3 w-full">
              {hskLevels.map((level, i) => {
                const levelSets = allSets.filter(s => s.hsk_level === level)
                const stageCount = Math.ceil(levelSets.length / 3) // 1 stage = 3 deck
                // HSK is cleared when all its stages are cleared
                const isHskCleared = stageCount > 0 && (clearedStages[level]?.size ?? 0) >= stageCount
                // HSK is locked if it's not the first and the previous HSK isn't fully cleared
                const prevLevel = hskLevels[i - 1]
                const prevLevelSets = prevLevel ? allSets.filter(s => s.hsk_level === prevLevel) : []
                const prevStageCount = Math.ceil(prevLevelSets.length / 3)
                const isLocked = i > 0 && (clearedStages[prevLevel]?.size ?? 0) < prevStageCount

                return (
                  <button
                    key={level}
                    onClick={() => !isLocked && handleSelectHsk(level)}
                    disabled={isLocked}
                    className={cn(
                      "group flex items-center gap-4 px-5 py-4 rounded-2xl border bg-card transition-all duration-200 text-left w-full shadow-sm",
                      isLocked
                        ? "border-border opacity-50 cursor-not-allowed"
                        : "hover:border-red-500/50 hover:bg-red-500/5 hover:shadow-md hover:scale-[1.02] cursor-pointer"
                    )}
                  >
                    {/* Level icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-base",
                      isLocked ? "bg-muted text-muted-foreground" :
                        isHskCleared ? "bg-green-500/10 text-green-500" :
                          "bg-red-500/10 text-red-500"
                    )}>
                      {isLocked ? <Lock className="w-5 h-5" /> :
                        isHskCleared ? "✓" :
                          level}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base">HSK {level}</span>
                        {isHskCleared && (
                          <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-semibold">Selesai</span>
                        )}
                        {isLocked && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">Terkunci</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {stageCount} stage · {levelSets.length} deck
                      </p>
                    </div>

                    {!isLocked && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-red-500 shrink-0 transition-colors" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* === Stage Select === */}
        {gameState === "stage-select" && selectedHsk !== null && (
          <div className="flex flex-col items-center max-w-md w-full space-y-4 my-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center shrink-0">
              <span className="text-4xl">⚡</span>
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-extrabold">HSK {selectedHsk}</h2>
              <p className="text-muted-foreground text-sm">Pilih stage untuk mulai bermain</p>
            </div>

            <div className="flex flex-col gap-3 w-full">
              {stages.map(stage => {
                const isCleared = clearedStages[selectedHsk]?.has(stage.index) ?? false
                const isLocked = stage.index > 1 && !(clearedStages[selectedHsk]?.has(stage.index - 1) ?? false)
                return (
                  <button
                    key={stage.index}
                    onClick={() => !isLocked && handleSelectStage(stage)}
                    disabled={loading || isLocked}
                    className={cn(
                      "group flex items-center gap-4 px-5 py-4 rounded-2xl border bg-card transition-all duration-200 text-left w-full shadow-sm",
                      isLocked
                        ? "border-border opacity-50 cursor-not-allowed"
                        : "hover:border-red-500/50 hover:bg-red-500/5 hover:shadow-md hover:scale-[1.02] cursor-pointer"
                    )}
                  >
                    {/* Stage icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-black",
                      isLocked ? "bg-muted text-muted-foreground" :
                        isCleared ? "bg-green-500/10 text-green-500" :
                          "bg-red-500/10 text-red-500"
                    )}>
                      {isLocked ? <Lock className="w-5 h-5" /> :
                        isCleared ? "✓" :
                          stage.index}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base">Stage {stage.index}</span>
                        {isCleared && (
                          <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-semibold">Selesai</span>
                        )}
                        {isLocked && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">Terkunci</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{stage.label}</p>
                    </div>

                    {!isLocked && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-red-500 shrink-0 transition-colors" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* === Loading === */}
        {loading && (
          <div className="flex flex-col items-center gap-3 my-auto">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm animate-pulse">Memuat kosakata...</p>
          </div>
        )}

        {/* === Playing === */}
        {gameState === "playing" && !loading && words.length >= 4 && (
          <div className="w-full max-w-2xl h-full flex flex-col min-h-0 px-3 py-2">
            {selectedStage && (
              <p className="text-center text-xs text-muted-foreground mb-4 shrink-0">
                Stage {selectedStage.index} · {words.length} kata
              </p>
            )}
            <SpeedrunBoard
              wordsPool={words}
              onGameOver={handleGameOver}
              onScoreChange={(s: number) => setScore(s)}
            />
          </div>
        )}

        {gameState === "playing" && !loading && words.length < 4 && (
          <div className="text-center space-y-3 my-auto">
            <p className="text-muted-foreground">Stage ini belum punya cukup kosakata (minimal 4 untuk pilihan ganda).</p>
            <Button variant="outline" onClick={goBackToStages}>Pilih Stage Lain</Button>
          </div>
        )}

        {/* === Game Over === */}
        {gameState === "gameover" && (
          <div className="flex flex-col items-center text-center max-w-sm w-full px-6 space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-500 my-auto">
            <div className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center",
              isWin ? "bg-green-500/10" : "bg-destructive/10"
            )}>
              <span className="text-5xl">{isWin ? "🏆" : "⏰"}</span>
            </div>
            <h2 className="text-3xl font-bold">{isWin ? "Waktu Habis!" : "Game Over!"}</h2>
            {selectedStage && (
              <p className="text-sm text-muted-foreground">
                HSK {selectedHsk} · Stage {selectedStage.index}
              </p>
            )}
            <div className="bg-card p-6 rounded-3xl w-full border shadow-sm">
              <p className="text-muted-foreground mb-2 font-medium">Skor Akhir</p>
              <p className="text-6xl font-black text-red-500">{score}</p>
              <p className="text-sm text-muted-foreground mt-3">+ {score} XP ditambahkan</p>
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={goBackToStages}>
                Stage Lain
              </Button>
              <Button
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                onClick={() => selectedStage && handleSelectStage(selectedStage)}
              >
                Main Lagi
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
