"use client"

import * as React from "react"
import { GameWord } from "@/app/dashboard/games/snake/page"
import { TonePinyin } from "@/components/tone-pinyin"
import { playSuccessSound, playErrorSound } from "@/lib/audio-fx"

const GRID_SIZE = 15
const INITIAL_SPEED = 200

type Point = { x: number; y: number }
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT"

// A food item occupies one cell per hanzi character, placed horizontally
type FoodItem = {
  cells: Point[]   // one entry per character
  word: GameWord
}

interface SnakeBoardProps {
  wordsPool: GameWord[]
  onGameOver: (score: number) => void
  onScoreChange: (score: number) => void
}

export function SnakeBoard({ wordsPool, onGameOver, onScoreChange }: SnakeBoardProps) {
  const [snake, setSnake] = React.useState<Point[]>([
    { x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }
  ])
  const [direction, setDirection] = React.useState<Direction>("RIGHT")
  const [nextDirection, setNextDirection] = React.useState<Direction>("RIGHT")
  const [currentWord, setCurrentWord] = React.useState<GameWord>(wordsPool[0])
  const [foods, setFoods] = React.useState<FoodItem[]>([])
  const [score, setScore] = React.useState(0)
  const [speed, setSpeed] = React.useState(INITIAL_SPEED)
  const [isGameOver, setIsGameOver] = React.useState(false)
  // Track which word IDs have been correctly eaten
  const [clearedWordIds, setClearedWordIds] = React.useState<Set<number>>(new Set())

  // Find a starting point where `len` horizontal cells fit without collision
  const findFoodStart = React.useCallback(
    (len: number, occupied: Set<string>): Point | null => {
      for (let tries = 0; tries < 300; tries++) {
        const x = Math.floor(Math.random() * (GRID_SIZE - len))
        const y = Math.floor(Math.random() * GRID_SIZE)
        const fits = Array.from({ length: len }, (_, i) => `${x + i},${y}`)
          .every(k => !occupied.has(k))
        if (fits) return { x, y }
      }
      return null
    },
    []
  )

  const buildOccupiedSet = (snakeBody: Point[], existingFoods: FoodItem[]): Set<string> => {
    const set = new Set<string>()
    snakeBody.forEach(p => set.add(`${p.x},${p.y}`))
    existingFoods.forEach(f => f.cells.forEach(c => set.add(`${c.x},${c.y}`)))
    return set
  }

  // Spawn all 4 foods at start
  const spawnAllFoods = React.useCallback(
    (targetWord: GameWord, snakeBody: Point[]) => {
      const shuffledPool = [...wordsPool].sort(() => Math.random() - 0.5)
      const wrongWords = shuffledPool.filter(w => w.id !== targetWord.id).slice(0, 3)
      const allWords = [targetWord, ...wrongWords].sort(() => Math.random() - 0.5)

      const result: FoodItem[] = []
      for (const word of allWords) {
        const len = word.hanzi.length
        const occupied = buildOccupiedSet(snakeBody, result)
        const start = findFoodStart(len, occupied)
        if (!start) continue
        const cells = Array.from({ length: len }, (_, i) => ({ x: start.x + i, y: start.y }))
        result.push({ cells, word })
      }
      setFoods(result)
    },
    [wordsPool, findFoodStart]
  )

  // Initial spawn
  React.useEffect(() => {
    if (wordsPool.length > 0) {
      const first = wordsPool[Math.floor(Math.random() * wordsPool.length)]
      setCurrentWord(first)
      spawnAllFoods(first, snake)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard input
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "w", "W"].includes(e.key) && direction !== "DOWN") setNextDirection("UP")
      if (["ArrowDown", "s", "S"].includes(e.key) && direction !== "UP") setNextDirection("DOWN")
      if (["ArrowLeft", "a", "A"].includes(e.key) && direction !== "RIGHT") setNextDirection("LEFT")
      if (["ArrowRight", "d", "D"].includes(e.key) && direction !== "LEFT") setNextDirection("RIGHT")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [direction])

  // Game loop
  React.useEffect(() => {
    if (isGameOver) return
    const tickId = setTimeout(() => {
      const head = { ...snake[0] }
      setDirection(nextDirection)
      switch (nextDirection) {
        case "UP": head.y -= 1; break
        case "DOWN": head.y += 1; break
        case "LEFT": head.x -= 1; break
        case "RIGHT": head.x += 1; break
      }
      // Wrap-around
      if (head.x < 0) head.x = GRID_SIZE - 1
      if (head.x >= GRID_SIZE) head.x = 0
      if (head.y < 0) head.y = GRID_SIZE - 1
      if (head.y >= GRID_SIZE) head.y = 0

      // Self collision
      if (snake.some(s => s.x === head.x && s.y === head.y)) {
        playErrorSound()
        setIsGameOver(true)
        onGameOver(score)
        return
      }

      const newSnake = [head, ...snake]

      // Food collision — check which food the head hit
      const hitIdx = foods.findIndex(f => f.cells.some(c => c.x === head.x && c.y === head.y))
      if (hitIdx !== -1) {
        const hit = foods[hitIdx]
        if (hit.word.id === currentWord.id) {
          // Correct!
          playSuccessSound()
          const ns = score + 10
          setScore(ns)
          onScoreChange(ns)
          setSpeed(s => Math.max(80, s - 5))
          const remaining = foods.filter((_, i) => i !== hitIdx)

          // Mark this word as cleared
          const newCleared = new Set(clearedWordIds)
          newCleared.add(currentWord.id)
          setClearedWordIds(newCleared)

          // Check if all deck words have been cleared → WIN!
          if (newCleared.size >= wordsPool.length) {
            setFoods([])
            setIsGameOver(true)
            onGameOver(ns)
            return
          }

          // Only spawn words that haven't been cleared yet
          const onBoardIds = new Set(remaining.map(f => f.word.id))
          const unclearedWords = wordsPool.filter(w => !newCleared.has(w.id) && !onBoardIds.has(w.id))
          const spawnPool = unclearedWords.length > 0 ? unclearedWords : wordsPool.filter(w => !onBoardIds.has(w.id))
          const newWordSpawn = spawnPool.length > 0
            ? spawnPool[Math.floor(Math.random() * spawnPool.length)]
            : wordsPool[Math.floor(Math.random() * wordsPool.length)]

          const occupied = buildOccupiedSet(newSnake, remaining)
          const len = newWordSpawn.hanzi.length
          let start: Point | null = null
          for (let t = 0; t < 300; t++) {
            const x = Math.floor(Math.random() * (GRID_SIZE - len))
            const y = Math.floor(Math.random() * GRID_SIZE)
            if (Array.from({ length: len }, (_, i) => `${x + i},${y}`).every(k => !occupied.has(k))) {
              start = { x, y }; break
            }
          }

          let newFoods = remaining
          if (start) {
            const cells = Array.from({ length: len }, (_, i) => ({ x: (start as Point).x + i, y: (start as Point).y }))
            newFoods = [...remaining, { cells, word: newWordSpawn }]
          }

          setFoods(newFoods)

          // Next question: prioritize uncleared words that are on the board
          const unclearedOnBoard = newFoods.filter(f => !newCleared.has(f.word.id))
          const nextPool = unclearedOnBoard.length > 0 ? unclearedOnBoard : newFoods
          const nextQuestionWord = nextPool[Math.floor(Math.random() * nextPool.length)].word
          setCurrentWord(nextQuestionWord)
          setSnake(newSnake)
        } else {
          playErrorSound()
          setIsGameOver(true)
          onGameOver(score)
        }
      } else {
        newSnake.pop()
        setSnake(newSnake)
      }
    }, speed)
    return () => clearTimeout(tickId)
  }, [snake, direction, nextDirection, foods, currentWord, isGameOver, speed, score, onGameOver, onScoreChange, wordsPool])

  // Mobile swipe
  const [touchStart, setTouchStart] = React.useState<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return
    const dx = e.changedTouches[0].clientX - touchStart.x
    const dy = e.changedTouches[0].clientY - touchStart.y
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && direction !== "LEFT") setNextDirection("RIGHT")
      else if (dx < 0 && direction !== "RIGHT") setNextDirection("LEFT")
    } else {
      if (dy > 0 && direction !== "UP") setNextDirection("DOWN")
      else if (dy < 0 && direction !== "DOWN") setNextDirection("UP")
    }
    setTouchStart(null)
  }

  // Build render maps
  const snakeKeys = new Set(snake.map(s => `${s.x},${s.y}`))
  const headKey = `${snake[0].x},${snake[0].y}`
  // cell → { char, word, pos: 'only'|'first'|'middle'|'last' }
  type CellPos = "only" | "first" | "middle" | "last"
  const foodCellMap = new Map<string, { char: string; word: GameWord; pos: CellPos }>()
  foods.forEach(f => {
    const len = f.cells.length
    f.cells.forEach((c, i) => {
      const pos: CellPos = len === 1 ? "only" : i === 0 ? "first" : i === len - 1 ? "last" : "middle"
      foodCellMap.set(`${c.x},${c.y}`, { char: f.word.hanzi[i], word: f.word, pos })
    })
  })

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Question card */}
      <div className="w-full bg-card rounded-xl border shadow px-4 py-3 flex flex-col items-center text-center shrink-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Cari Hanzi Untuk:</p>
        <p className="text-2xl font-bold leading-tight">
          <TonePinyin text={currentWord?.pinyin ?? ""} />
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">{currentWord?.arti}</p>
      </div>

      {/* Square grid wrapper */}
      <div className="w-full flex justify-center min-h-0">
        <div
          className="bg-card rounded-xl border border-border overflow-hidden p-1.5"
          style={{
            // Perfect square: size = min(available-width, available-height)
            width: "min(100%, 65vh)",
            aspectRatio: "1 / 1",
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            gap: "2px",
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
            const x = i % GRID_SIZE
            const y = Math.floor(i / GRID_SIZE)
            const key = `${x},${y}`
            const isHead = key === headKey
            const isBody = !isHead && snakeKeys.has(key)
            const fc = foodCellMap.get(key)

            const borderRadius = !fc
              ? "2px"
              : fc.pos === "only" ? "4px"
                : fc.pos === "first" ? "4px 0 0 4px"
                  : fc.pos === "last" ? "0 4px 4px 0"
                    : "0"
            const extendRight = fc && fc.pos !== "only" && fc.pos !== "last"

            return (
              <div
                key={key}
                className={[
                  "flex items-center justify-center relative",
                  isHead ? "bg-primary" : "",
                  isBody ? "bg-primary/60" : "",
                  !isHead && !isBody && !fc ? "bg-secondary/20" : "",
                  fc ? "bg-secondary/50" : "",
                ].join(" ")}
                style={{
                  borderRadius,
                  marginRight: extendRight ? "-2px" : undefined,
                  zIndex: extendRight ? 1 : undefined,
                }}
              >
                {fc && (
                  <span
                    className="font-hanzi font-bold text-foreground select-none"
                    style={{ fontSize: "clamp(14px, 4.5vmin, 32px)", lineHeight: 1 }}
                  >
                    {fc.char}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <p className="md:hidden text-center text-muted-foreground text-xs shrink-0">👆 Geser untuk bergerak</p>
    </div>
  )
}
