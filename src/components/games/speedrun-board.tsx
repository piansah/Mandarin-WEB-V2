"use client"

import * as React from "react"
import { GameWord } from "@/app/dashboard/games/speedrun/page"
import { playSuccessSound, playErrorSound } from "@/lib/audio-fx"
import { TonePinyin } from "@/components/tone-pinyin"
import { cn } from "@/lib/utils"

interface SpeedrunBoardProps {
  wordsPool: GameWord[]
  onGameOver: (score: number, win?: boolean) => void
  onScoreChange: (score: number) => void
}

export function SpeedrunBoard({ wordsPool, onGameOver, onScoreChange }: SpeedrunBoardProps) {
  const [timeLeft, setTimeLeft] = React.useState(60)
  const [score, setScore] = React.useState(0)
  
  const [currentWord, setCurrentWord] = React.useState<GameWord | null>(null)
  const [options, setOptions] = React.useState<GameWord[]>([])
  const [isLocked, setIsLocked] = React.useState(false)

  // Stable refs
  const onScoreChangeRef = React.useRef(onScoreChange)
  const onGameOverRef = React.useRef(onGameOver)
  const scoreRef = React.useRef(score)
  React.useEffect(() => { onScoreChangeRef.current = onScoreChange }, [onScoreChange])
  React.useEffect(() => { onGameOverRef.current = onGameOver }, [onGameOver])
  React.useEffect(() => { scoreRef.current = score }, [score])

  const generateQuestion = React.useCallback(() => {
    if (wordsPool.length < 4) return

    // Pick 1 random correct word
    const correctIdx = Math.floor(Math.random() * wordsPool.length)
    const correct = wordsPool[correctIdx]

    // Pick 3 random wrong words
    const wrongWords: GameWord[] = []
    while (wrongWords.length < 3) {
      const wIdx = Math.floor(Math.random() * wordsPool.length)
      if (wIdx !== correctIdx && !wrongWords.find(w => w.id === wordsPool[wIdx].id)) {
        wrongWords.push(wordsPool[wIdx])
      }
    }

    // Combine and shuffle
    const newOptions = [correct, ...wrongWords].sort(() => Math.random() - 0.5)

    setCurrentWord(correct)
    setOptions(newOptions)
  }, [wordsPool])

  // Initialize game
  const hasInitialized = React.useRef(false)
  React.useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    generateQuestion()
  }, [generateQuestion])

  // Timer
  React.useEffect(() => {
    if (timeLeft <= 0) {
      onGameOverRef.current(scoreRef.current, true)
      return
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  const handleOptionClick = (option: GameWord) => {
    if (isLocked || !currentWord) return
    
    if (option.id === currentWord.id) {
      // Correct!
      playSuccessSound()
      const newScore = score + 10
      setScore(newScore)
      onScoreChangeRef.current(newScore)
      generateQuestion() // Instant next question
    } else {
      // Wrong!
      playErrorSound()
      setIsLocked(true)
      const newScore = Math.max(0, score - 5) // Penalty but no negative
      setScore(newScore)
      onScoreChangeRef.current(newScore)
      
      // Flash red and wait a tiny bit
      setTimeout(() => {
        setIsLocked(false)
      }, 400)
    }
  }

  if (!currentWord) return null

  // Calculate color for progress bar (green -> yellow -> red)
  const progressColor = 
    timeLeft > 30 ? "bg-green-500" :
    timeLeft > 10 ? "bg-amber-500" : "bg-red-500 animate-pulse"

  return (
    <div className="w-full h-full flex flex-col items-center justify-center max-w-lg mx-auto">
      
      {/* Timer Bar */}
      <div className="w-full bg-card rounded-full h-4 mb-6 shadow-inner overflow-hidden border">
        <div 
          className={cn("h-full transition-all duration-1000 ease-linear rounded-full", progressColor)}
          style={{ width: `${(timeLeft / 60) * 100}%` }}
        />
      </div>
      <div className="text-2xl font-black font-mono mb-8 tabular-nums tracking-tighter text-foreground/80">
        00:{timeLeft.toString().padStart(2, '0')}
      </div>

      {/* Main Flashcard UI (Reused aesthetic from swipe session) */}
      <div className="w-full aspect-[4/3] max-w-sm mb-8 relative perspective-[800px]">
        <div className="absolute inset-0 w-full h-full rounded-3xl border-2 flex flex-col items-center justify-center p-6 text-center bg-card shadow-xl transition-transform duration-300">
          <span className="font-hanzi font-bold text-7xl md:text-8xl text-foreground">
            {currentWord.hanzi}
          </span>
        </div>
      </div>

      {/* 4 Multiple Choice Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-4">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleOptionClick(opt)}
            disabled={isLocked}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-2xl border-2 bg-card transition-all text-center min-h-[5rem]",
              isLocked 
                ? "opacity-80" 
                : "hover:border-primary/50 hover:bg-primary/5 active:scale-95 cursor-pointer shadow-sm"
            )}
          >
            <span className="font-bold text-lg mb-1">
              <TonePinyin text={opt.pinyin} />
            </span>
            <span className="text-sm text-muted-foreground line-clamp-2">
              {opt.arti}
            </span>
          </button>
        ))}
      </div>

    </div>
  )
}
