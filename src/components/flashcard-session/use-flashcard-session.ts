import { toast } from "sonner";
import * as React from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"
import { SwipeFlashcard, FlashcardPrefs, SessionHeaderStats } from "./types"
import { shuffleArray, loadPrefs, savePrefs, normalizeChinese, getSimilarity } from "./utils"
import { speakMandarin } from "@/lib/tts"
import { SrsState, getCardSrsState, countMastered, countSaved, todayStr } from "@/lib/srs"

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  // eslint-disable-next-line
  onresult: ((event: any) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

export function useFlashcardSession({
  cards,
  userId,
  deckCardIds,
  wordDetailPath,
  onComplete,
  disableSwipeProp = false,
  deckId
}: {
  cards: SwipeFlashcard[]
  userId?: string | null
  deckCardIds?: string[]
  wordDetailPath?: (card: SwipeFlashcard) => string | null
  // eslint-disable-next-line
  onComplete?: (stats: any, reviews: any[]) => void
  disableSwipeProp?: boolean
  deckId?: number
}) {
  const router = useRouter()
  const supa = useSupabase()

  const [prefs, setPrefs] = React.useState<FlashcardPrefs>({ autoPlayTts: true, cardOrder: "sequential", swipeEnabled: true })
  const [showSettings, setShowSettings] = React.useState(false)
  const [showResetModal, setShowResetModal] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)
  const [resetSuccess, setResetSuccess] = React.useState(false)
  const [orderedCards, setOrderedCards] = React.useState<SwipeFlashcard[]>([])

  React.useEffect(() => {
    setPrefs(loadPrefs())
  }, [])

  React.useEffect(() => {
    setOrderedCards(prefs.cardOrder === "shuffle" ? shuffleArray(cards) : [...cards])
  }, [cards, prefs.cardOrder])

  const disableSwipe = disableSwipeProp || !prefs.swipeEnabled

  const sessionStorageKey = `flashcard_session_${userId}_${deckCardIds?.join('_')}`

  const deckIds = React.useMemo(() => {
    const rawIds = deckCardIds && deckCardIds.length > 0 ? deckCardIds.map(String) : cards.map(c => String(c.id))
    return Array.from(new Set(rawIds))
  }, [deckCardIds, cards])

  const [idx, setIdx] = React.useState(0)
  const [flip, setFlip] = React.useState<0 | 1 | 2>(0)
  const [mudah, setMudah] = React.useState(0)
  const [lupa, setLupa] = React.useState(0)
  const [sulit, setSulit] = React.useState(0)
  const [ingat, setIngat] = React.useState(0)
  const [done, setDone] = React.useState(false)
  
  const [dbIntervals, setDbIntervals] = React.useState<Map<string, number>>(new Map())
  const [dueToday, setDueToday] = React.useState(0)
  const [sessionReviews, setSessionReviews] = React.useState<{ cardId: string; quality: 0 | 3 | 4 | 5; state: SrsState }[]>([])

  const [fullDeckIds, setFullDeckIds] = React.useState<string[]>([])
  const [dbSavedIds, setDbSavedIds] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (!sessionStorageKey || typeof window === "undefined") return
    try {
      const saved = localStorage.getItem(sessionStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        const hoursDiff = (Date.now() - (parsed.timestamp || Date.now())) / (1000 * 60 * 60)
        if (hoursDiff < 24) {
          setIdx(parsed.savedIdx ?? 0)
          setMudah(parsed.mudah ?? 0)
          setLupa(parsed.lupa ?? 0)
          setSulit(parsed.sulit ?? 0)
          setIngat(parsed.ingat ?? 0)
          
          const loadedReviews = parsed.sessionReviews ?? []
          const validReviews = loadedReviews.filter((r: { state?: SrsState }) => r.state != null)
          setSessionReviews(validReviews)
        } else {
          localStorage.removeItem(sessionStorageKey)
        }
      }
    } catch {}
  }, [sessionStorageKey])

  const [repeatQueue, setRepeatQueue] = React.useState<SwipeFlashcard[]>([])
  const [dragX, setDragX] = React.useState(0)
  const [dragY, setDragY] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  
  const startX = React.useRef(0)
  const startY = React.useRef(0)
  const cardRef = React.useRef<HTMLDivElement | null>(null)
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = React.useRef(false)
  
  const [isRecording, setIsRecording] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{ type: "ok" | "warn" | "err" | "interim"; msg: string; hanzi?: string } | null>(null)
  const recogRef = React.useRef<SpeechRecognitionLike | null>(null)
  const [flyOut, setFlyOut] = React.useState<{ x: number; y: number } | null>(null)
  const scoreSavedRef = React.useRef(false)
  const [selectedRating, setSelectedRating] = React.useState<0 | 3 | 4 | 5 | null>(null)
  const [resultRingValue, setResultRingValue] = React.useState(0)
  const prefersReducedMotionRef = React.useRef(false)

  React.useEffect(() => {
    prefersReducedMotionRef.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  const totalOriginal = orderedCards.length
  const currentTotal = totalOriginal + repeatQueue.length
  const card = idx < totalOriginal ? orderedCards[idx] : repeatQueue[idx - totalOriginal]
  const progress = currentTotal > 0 ? (idx / currentTotal) * 100 : 0

  React.useEffect(() => {
    if (flip === 1 && !isRecording && card?.hanzi && prefs.autoPlayTts) {
      speakMandarin(card.hanzi)
    }
  }, [flip, idx, isRecording, card?.hanzi, prefs.autoPlayTts])

  React.useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }
  }, [])

  React.useEffect(() => {
    if (!done || cards.length === 0 || scoreSavedRef.current) return
    scoreSavedRef.current = true
    const key = `flashcard_session_${userId}_${deckCardIds?.join('_')}`
    localStorage.removeItem(key)
    onComplete?.({ mudah, lupa, sulit, ingat }, sessionReviews)
  }, [done, cards.length, mudah, lupa, sulit, ingat, onComplete, sessionReviews, userId, deckCardIds])

  React.useEffect(() => {
    if (!done || cards.length === 0) {
      setResultRingValue(0)
      return
    }
    const total = mudah + ingat + sulit + lupa
    const target = total > 0 ? Math.round(((mudah + ingat) / total) * 100) : 0

    if (prefersReducedMotionRef.current) {
      setResultRingValue(target)
      return
    }

    setResultRingValue(0)
    let raf = 0
    const start = performance.now()
    const duration = 900
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setResultRingValue(Math.round(eased * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    const delay = setTimeout(() => { raf = requestAnimationFrame(tick) }, 150)
    return () => { clearTimeout(delay); if (raf) cancelAnimationFrame(raf) }
  }, [done, cards.length, mudah, ingat, sulit, lupa])

  React.useEffect(() => {
    if (typeof window === "undefined" || done) return
    try {
      const key = `flashcard_session_${userId}_${deckCardIds?.join('_')}`
      localStorage.setItem(key, JSON.stringify({
        savedIdx: idx,
        mudah,
        lupa,
        sulit,
        ingat,
        sessionReviews,
        timestamp: Date.now()
      }))
    } catch {
    }
  }, [idx, mudah, lupa, sulit, ingat, sessionReviews, done, userId, deckCardIds])

  React.useEffect(() => {
    if (disableSwipe && cardRef.current) {
      cardRef.current.style.touchAction = 'none'
    } else if (cardRef.current) {
      cardRef.current.style.touchAction = 'auto'
    }
  }, [disableSwipe])

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return
      const target = e.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return
      if (!card || flyOut || done) return
      if (flip === 2) return
      e.preventDefault()
      setFlip((f) => (f === 0 ? 1 : f === 1 ? 2 : f))
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [flip, flyOut, done, card])

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return
      if (!card || flyOut || done) return

      if (e.key === "1") { e.preventDefault(); setSelectedRating(0); advance(0); return }
      if (e.key === "2") { e.preventDefault(); setSelectedRating(3); advance(3); return }
      if (e.key === "3") { e.preventDefault(); setSelectedRating(4); advance(4); return }
      if (e.key === "4") { e.preventDefault(); setSelectedRating(5); advance(5); return }
      if (e.key === "ArrowLeft") { e.preventDefault(); goToPrevious(); return }
      if (e.key === "ArrowRight") { e.preventDefault(); skipCard(); return }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line
  }, [card, flyOut, done, idx])

  function handleCardClick() {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    if (isDragging || dragX > 10 || dragX < -10 || dragY > 10 || dragY < -10) return

    if (flip === 0) setFlip(1)
    else if (flip === 1) setFlip(2)
  }

  const deckIdsStr = deckIds.join(",")
  const fullDeckIdsStr = fullDeckIds.join(",")

  React.useEffect(() => {
    async function fetchFullDeckIds() {
      if (!deckId) {
        setFullDeckIds(deckIds)
        return
      }

      try {
        const allIds: string[] = []
        let from = 0
        const chunkSize = 1000

        while (true) {
          const { data, error } = await supa
            .from("flashcard_cards")
            .select("id")
            .eq("set_id", deckId)
            .range(from, from + chunkSize - 1)

          if (error) {
            console.error("fetchFullDeckIds error:", error)
            break
          }

          if (!data || data.length === 0) break

          for (const row of data) {
            if (row.id != null) {
              allIds.push(String(row.id))
            }
          }

          if (data.length < chunkSize) break
          from += chunkSize
        }

        setFullDeckIds(allIds)
      } catch (e) {
        console.error("fetchFullDeckIds exception:", e)
        setFullDeckIds(deckIds)
      }
    }

    fetchFullDeckIds()
  }, [deckId, supa, deckIds])

  React.useEffect(() => {
    async function fetchHeaderStats() {
      if (!userId) {
        setDueToday(deckIds.length)
        return
      }

      const today = todayStr()
      let dueCount = 0
      const intervals = new Map<string, number>()
      const savedIds = new Set<string>()

      const targetIds = fullDeckIds.length > 0 ? fullDeckIds : deckIds

      for (let i = 0; i < targetIds.length; i += 100) {
        const chunk = targetIds.slice(i, i + 100)
        const { data, error } = await supa
          .from("user_card_progress")
          .select("card_id, next_review, interval_days")
          .eq("user_id", userId)
          .in("card_id", chunk)

        if (error) {
          console.error("fetchHeaderStats error:", error)
          continue
        }

        const progressMap = new Map<string, { next_review: string | null; interval_days: number }>()
        for (const row of data ?? []) {
          if (row.card_id) {
            progressMap.set(String(row.card_id), {
              next_review: row.next_review,
              interval_days: row.interval_days ?? 0
            })
          }
        }

        for (const id of chunk) {
          const p = progressMap.get(id)
          if (!p || (p.next_review && p.next_review <= today)) {
            dueCount++
          }
          if (p && p.interval_days != null) {
            intervals.set(id, p.interval_days)
          }
          if (p) {
            savedIds.add(id)
          }
        }
      }

      setDueToday(dueCount)
      setDbIntervals(intervals)
      setDbSavedIds(savedIds)
    }
    fetchHeaderStats()
  }, [userId, supa, deckIdsStr, fullDeckIdsStr, deckIds, fullDeckIds])

  const headerStats = React.useMemo<SessionHeaderStats>(() => {
    const totalCards = fullDeckIds.length > 0 ? fullDeckIds.length : deckIds.length
    const saved = countSaved(fullDeckIds.length > 0 ? fullDeckIds : deckIds, dbSavedIds, sessionReviews)
    const rated = mudah + ingat + sulit + lupa
    const accuracy = rated > 0 ? Math.round(((mudah + ingat) / rated) * 100) : 0
    const mastered = countMastered(deckIds, dbIntervals, sessionReviews)

    return {
      dueToday,
      totalCards,
      accuracy,
      mastered,
      rated,
      saved
    }
  }, [deckIds, fullDeckIds, dueToday, mudah, ingat, sulit, lupa, dbIntervals, dbSavedIds, sessionReviews])

  function cancelLongPress() {
    if (!longPressTimer.current) return
    clearTimeout(longPressTimer.current)
    longPressTimer.current = null
  }

  function animateFlyOutAndAdvance(quality: 0 | 3 | 4 | 5, toX: number, toY: number) {
    setIsDragging(false)
    setFlyOut({ x: toX, y: toY })
    setTimeout(() => {
      advance(quality)
      setFlyOut(null)
    }, 250)
  }

  function advance(quality: 0 | 3 | 4 | 5) {
    if (!card) return
    const cardIdStr = String(card.id)

    const isFromRepeatQueue = idx >= totalOriginal

    if (!isFromRepeatQueue) {
      setSessionReviews(prev => {
        const filtered = prev.filter(r => r.cardId !== cardIdStr)
        return [...filtered, { cardId: cardIdStr, quality, state: getCardSrsState(card) }]
      })
    }

    let nextMudah = mudah
    let nextIngat = ingat
    let nextSulit = sulit
    let nextLupa = lupa

    if (quality === 5) {
      nextMudah = mudah + 1
      setMudah(nextMudah)
    } else if (quality === 4) {
      nextIngat = ingat + 1
      setIngat(nextIngat)
    } else if (quality === 3) {
      nextSulit = sulit + 1
      setSulit(nextSulit)
    } else {
      nextLupa = lupa + 1
      setLupa(nextLupa)
      setRepeatQueue(prev => [...prev, card])
    }

    setDragX(0); setDragY(0); setFlip(0); setFeedback(null); setSelectedRating(null)

    if (idx + 1 >= currentTotal + (quality === 0 ? 1 : 0)) {
      setDone(true)
      const stats = {
        mudah: nextMudah,
        ingat: nextIngat,
        sulit: nextSulit,
        lupa: nextLupa,
      }
      const latestReviews = isFromRepeatQueue ? sessionReviews : [
        ...sessionReviews.filter(r => r.cardId !== cardIdStr),
        { cardId: cardIdStr, quality, state: getCardSrsState(card) }
      ]
      setTimeout(() => onComplete?.(stats, latestReviews), 0)
    } else {
      setIdx((i: number) => i + 1)
    }
  }

  function goToPrevious() {
    if (idx === 0) return
    setDragX(0); setDragY(0); setFlip(0); setFeedback(null); setSelectedRating(null)
    setIdx((i: number) => Math.max(0, i - 1))
  }

  function hideAnswer() {
    setFlip(0); setFeedback(null); setSelectedRating(null)
  }

  function skipCard() {
    if (!card) return
    setDragX(0); setDragY(0); setFlip(0); setFeedback(null); setSelectedRating(null)
    if (idx + 1 >= currentTotal) setDone(true)
    else setIdx((i: number) => i + 1)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (flyOut || !card) return
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return
    if (disableSwipe) return

    didLongPress.current = false
    startX.current = e.clientX
    startY.current = e.clientY
    setIsDragging(true)
    cardRef.current?.setPointerCapture(e.pointerId)
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      didLongPress.current = true
      setIsDragging(false)
      const href = wordDetailPath?.(card) ?? null
      if (href) router.push(href)
    }, 600)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging || flyOut || disableSwipe) return
    const nextDragX = e.clientX - startX.current
    const nextDragY = e.clientY - startY.current

    if (Math.abs(nextDragX) > 10 || Math.abs(nextDragY) > 10) cancelLongPress()
    if (Math.abs(nextDragX) > 14 || Math.abs(nextDragY) > 14) setFlip(currentFlip => (currentFlip === 2 ? currentFlip : 2))

    setDragX(nextDragX)
    setDragY(nextDragY)
  }

  function onPointerUp() {
    cancelLongPress()
    if (!isDragging || flyOut || disableSwipe) return
    const absX = Math.abs(dragX)

    if (dragY > absX && dragY > 80) animateFlyOutAndAdvance(3, 0, 500)
    else if (dragY < -absX && dragY < -80) animateFlyOutAndAdvance(4, 0, -500)
    else if (absX > dragY && absX > 80) {
      if (dragX > 0) animateFlyOutAndAdvance(5, 500, 0)
      else animateFlyOutAndAdvance(0, -500, 0)
    } else {
      setDragX(0); setDragY(0); setIsDragging(false)
    }
  }

  function onPointerCancel() {
    cancelLongPress()
    setDragX(0); setDragY(0); setIsDragging(false)
  }

  function toggleListen() {
    if (typeof window === "undefined" || !card) return
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!SR) {
      setFeedback({ type: "err", msg: "Browser tidak mendukung. Gunakan Chrome." })
      return
    }

    if (isRecording) {
      recogRef.current?.stop()
      setIsRecording(false)
      return
    }

    setIsRecording(true)
    setFeedback(null)
    const recog = new SR()
    recog.lang = "zh-CN"
    recog.interimResults = true
    recog.maxAlternatives = 1

    // eslint-disable-next-line
    recog.onresult = (e: any) => {
      const result = e.results[0]
      const isFinal = result.isFinal
      const text = result[0].transcript.trim()

      if (!isFinal) {
        setFeedback({ type: "interim", msg: `"${text}" ...` })
        return
      }

      const tNorm = normalizeChinese(text.toLowerCase())
      const hzNorm = normalizeChinese(card.hanzi)

      let bestScore = getSimilarity(tNorm, hzNorm)
      if (hzNorm.includes(tNorm) && tNorm.length / hzNorm.length >= 0.75) {
        bestScore = Math.max(bestScore, 85)
      }

      const displayResult = bestScore >= 60 ? card.hanzi : text

      if (bestScore >= 80) setFeedback({ type: "ok", msg: `✓ Bagus! ${bestScore}% Tepat Sekali!`, hanzi: displayResult })
      else if (bestScore >= 60) setFeedback({ type: "warn", msg: `${bestScore}% — Hampir Sesuai`, hanzi: displayResult })
      else setFeedback({ type: "err", msg: `${bestScore}% — HUH WKWK?!`, hanzi: displayResult })
    }

    recog.onerror = () => { setFeedback({ type: "err", msg: "Gagal mendengarkan" }); setIsRecording(false) }
    recog.onend = () => setIsRecording(false)

    recogRef.current = recog
    recog.start()
  }

  async function resetDeckProgress(deckId: number) {
    try {
      setResetting(true)
      const { data: { user } } = await supa.auth.getUser()
      if (!user) return

      const { data: cardData } = await supa.from("flashcard_cards").select("id").eq("set_id", deckId)

      if (cardData && cardData.length > 0) {
        const cardIds = cardData.map(c => c.id)
        const { error } = await supa.from("user_card_progress").delete().in("card_id", cardIds).eq("user_id", user.id)
        if (error) throw error
      }

      const key = `flashcard_session_${userId}_${deckCardIds?.join('_')}`
      localStorage.removeItem(key)

      setShowResetModal(false)
      setResetSuccess(true)
      setTimeout(() => window.location.reload(), 1500)
      setTimeout(() => setResetSuccess(false), 3000)
    } catch (error) {
      console.error("Error resetting SRS:", error)
      // eslint-disable-next-line
      toast.error("Gagal reset SRS: " + (error as any).message)
    } finally {
      setResetting(false)
    }
  }

  return {
    prefs, setPrefs, updatePrefs: (p: FlashcardPrefs) => { setPrefs(p); savePrefs(p) },
    showSettings, setShowSettings,
    showResetModal, setShowResetModal,
    resetting, resetSuccess, resetDeckProgress,
    idx, flip, done, 
    mudah, lupa, sulit, ingat,
    dragX, dragY, isDragging, flyOut,
    cardRef, handleCardClick, onPointerDown, onPointerMove, onPointerCancel, onPointerUp,
    card, progress, currentTotal,
    headerStats, resultRingValue,
    selectedRating, advance, goToPrevious, hideAnswer, skipCard,
    isRecording, toggleListen, feedback
  }
}