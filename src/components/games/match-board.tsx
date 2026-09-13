"use client"

import * as React from "react"
import { GameWord } from "@/app/dashboard/games/match/page"
import { playSuccessSound, playErrorSound } from "@/lib/audio-fx"
import { TonePinyin } from "@/components/tone-pinyin"
import { cn } from "@/lib/utils"

type MatchCard = {
  id: string
  wordId: number
  type: "hanzi" | "pinyin"
  hanzi?: string
  pinyin?: string
  arti?: string
  isFlipped: boolean
  isMatched: boolean
}

interface MatchBoardProps {
  wordsPool: GameWord[]
  onGameOver: (score: number, win?: boolean) => void
  onScoreChange: (score: number) => void
}

export function MatchBoard({ wordsPool, onGameOver, onScoreChange }: MatchBoardProps) {
  const [cards, setCards] = React.useState<MatchCard[]>([])
  const [queue, setQueue] = React.useState<GameWord[]>([])
  const [flippedIndices, setFlippedIndices] = React.useState<number[]>([])
  const [isLocked, setIsLocked] = React.useState(false)
  const [score, setScore] = React.useState(0)

  // Stable refs so callbacks never cause effect re-runs
  const onScoreChangeRef = React.useRef(onScoreChange)
  const onGameOverRef = React.useRef(onGameOver)
  React.useEffect(() => { onScoreChangeRef.current = onScoreChange }, [onScoreChange])
  React.useEffect(() => { onGameOverRef.current = onGameOver }, [onGameOver])

  const hasInitialized = React.useRef(false)

  // Initialize board ONCE
  React.useEffect(() => {
    if (hasInitialized.current) return
    if (!wordsPool || wordsPool.length < 8) return
    hasInitialized.current = true

    // Pick 8 words for board, rest to queue
    const shuffledPool = [...wordsPool].sort(() => Math.random() - 0.5)
    const boardWords = shuffledPool.slice(0, 8)
    const remainingWords = shuffledPool.slice(8)

    // Create 2 cards per word (16 total)
    const newCards: MatchCard[] = []
    boardWords.forEach(word => {
      newCards.push({
        id: `hanzi-${word.id}`,
        wordId: word.id,
        type: "hanzi",
        hanzi: word.hanzi,
        isFlipped: false,
        isMatched: false
      })
      newCards.push({
        id: `pinyin-${word.id}`,
        wordId: word.id,
        type: "pinyin",
        pinyin: word.pinyin,
        arti: word.arti,
        isFlipped: false,
        isMatched: false
      })
    })

    // Shuffle the 16 cards
    newCards.sort(() => Math.random() - 0.5)

    setCards(newCards)
    setQueue(remainingWords)
    setScore(0)
    onScoreChangeRef.current(0)
  }, [wordsPool])

  const handleCardClick = (index: number) => {
    if (isLocked) return
    if (cards[index].isFlipped || cards[index].isMatched) return

    const newCards = [...cards]
    newCards[index] = { ...newCards[index], isFlipped: true }
    setCards(newCards)

    const newFlippedIndices = [...flippedIndices, index]
    setFlippedIndices(newFlippedIndices)

    if (newFlippedIndices.length === 2) {
      setIsLocked(true)
      const [firstIdx, secondIdx] = newFlippedIndices
      const firstCard = newCards[firstIdx]
      const secondCard = newCards[secondIdx]

      if (firstCard.wordId === secondCard.wordId) {
        // Match!
        playSuccessSound()
        setTimeout(() => {
          setQueue(prevQueue => {
            const nextQueue = [...prevQueue]
            const nextWord = nextQueue.shift()

            setCards(prevCards => {
              const updated = [...prevCards]
              if (nextWord) {
                // Continuous Replenishment: Create 2 new cards and place them at matched indices
                const newCardsToInsert: MatchCard[] = [
                  {
                    id: `hanzi-${nextWord.id}`,
                    wordId: nextWord.id,
                    type: "hanzi",
                    hanzi: nextWord.hanzi,
                    isFlipped: false,
                    isMatched: false
                  },
                  {
                    id: `pinyin-${nextWord.id}`,
                    wordId: nextWord.id,
                    type: "pinyin",
                    pinyin: nextWord.pinyin,
                    arti: nextWord.arti,
                    isFlipped: false,
                    isMatched: false
                  }
                ]
                // Randomize which new card goes to which index
                if (Math.random() > 0.5) newCardsToInsert.reverse()
                
                updated[firstIdx] = newCardsToInsert[0]
                updated[secondIdx] = newCardsToInsert[1]
              } else {
                // Queue empty: just mark as matched (transparent)
                updated[firstIdx] = { ...updated[firstIdx], isMatched: true }
                updated[secondIdx] = { ...updated[secondIdx], isMatched: true }

                // Check win condition
                const totalMatched = updated.filter(c => c.isMatched).length
                if (totalMatched === updated.length) {
                  const finalScore = score + 10
                  setTimeout(() => onGameOverRef.current(finalScore, true), 500)
                }
              }
              return updated
            })

            return nextQueue
          })
          const newScore = score + 10
          setScore(newScore)
          onScoreChangeRef.current(newScore)
          setFlippedIndices([])
          setIsLocked(false)
        }, 400)
      } else {
        // No match
        playErrorSound()
        setTimeout(() => {
          setCards(prev => prev.map((c, i) =>
            i === firstIdx || i === secondIdx ? { ...c, isFlipped: false } : c
          ))
          const newScore = Math.floor(score / 2)
          setScore(newScore)
          onScoreChangeRef.current(newScore)
          setFlippedIndices([])
          setIsLocked(false)
        }, 1000)
      }
    }
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
      <div
        className="grid grid-cols-4 gap-2 sm:gap-3 w-full max-w-2xl"
        style={{ perspective: "1000px" }}
      >
        {cards.map((card, idx) => {
          if (card.isMatched) {
            return (
              <div
                key={card.id}
                className="relative aspect-square"
                aria-hidden="true"
              />
            )
          }

          return (
            <div
              key={card.id}
              className="relative aspect-square cursor-pointer group transition-all duration-700"
              style={{ perspective: "1000px" }}
              onClick={() => handleCardClick(idx)}
            >
              <div
                className="relative w-full h-full transition-transform duration-500 shadow-sm rounded-xl sm:rounded-2xl"
                style={{
                  transformStyle: "preserve-3d",
                  transform: (card.isFlipped || card.isMatched) ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* Front side (Unknown state) */}
                <div
                  className="absolute inset-0 w-full h-full rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/20"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div className="w-1/2 h-1/2 bg-primary/20 rounded-full blur-xl absolute" />
                  <div className="text-4xl text-primary/30 font-black relative z-10">?</div>
                </div>

                {/* Back side (Content state) */}
                <div
                  className={cn(
                    "absolute inset-0 w-full h-full rounded-xl sm:rounded-2xl border flex flex-col items-center justify-center p-2 text-center overflow-hidden",
                    card.isMatched ? "bg-green-500/10 border-green-500/30" : "bg-card border-border"
                  )}
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  {card.type === "hanzi" ? (
                    <span className="font-hanzi font-bold text-3xl sm:text-5xl text-foreground">
                      {card.hanzi}
                    </span>
                  ) : (
                    <div className="flex flex-col items-center gap-1 sm:gap-2">
                      <span className="font-bold text-base sm:text-xl leading-tight">
                        <TonePinyin text={card.pinyin || ""} />
                      </span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground leading-tight line-clamp-2 px-1">
                        {card.arti}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
