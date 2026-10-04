import { toast } from "sonner";
import * as React from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"
import { SwipeFlashcard, FlashcardPrefs, SessionHeaderStats } from "./types"
import { shuffleArray, loadPrefs, savePrefs, normalizeChinese, getSimilarity } from "./utils"
import { speakMandarin } from "@/lib/tts"
import { SrsState, getCardSrsState, countSaved, todayStr, isCardDue, recordSrsReview, recordSrsReviewBatch, countSwipeMastered, computeSessionAccuracy, computeSessionStats } from "@/lib/srs"

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
  deckId,
  sessionId
}: {
  cards: SwipeFlashcard[]
  userId?: string | null
  deckCardIds?: string[]
  wordDetailPath?: (card: SwipeFlashcard) => string | null
  // eslint-disable-next-line
  onComplete?: (stats: any, reviews: any[]) => void
  disableSwipeProp?: boolean
  deckId?: number
  sessionId?: string | null
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

  const deckIdsRef = React.useRef(deckIds)
  deckIdsRef.current = deckIds

  const [idx, setIdx] = React.useState(0)
  const [flip, setFlip] = React.useState<0 | 1 | 2>(0)
  const [done, setDone] = React.useState(false)

  const [dueToday, setDueToday] = React.useState(0)
  const [sessionReviews, setSessionReviews] = React.useState<{ cardId: string; quality: 0 | 3 | 4 | 5; state: SrsState }[]>([])
  const saveErrorShownRef = React.useRef(false)
  const streakSavedRef = React.useRef(false)
  const [latestRatings, setLatestRatings] = React.useState<Map<string, 0 | 3 | 4 | 5>>(new Map())
  const [lapsedCardIds, setLapsedCardIds] = React.useState<Set<string>>(new Set())
  const failedCardIdsRef = React.useRef<Set<string>>(new Set())
  const canSaveSrs = !!userId && !!deckId
  const restoredKeyRef = React.useRef<string | null>(null)
  const restoreDoneRef = React.useRef(false)

  const [fullDeckIds, setFullDeckIds] = React.useState<string[]>([])
  const fullDeckIdsRef = React.useRef(fullDeckIds)
  React.useEffect(() => { fullDeckIdsRef.current = fullDeckIds }, [fullDeckIds])
  const [dbSavedIds, setDbSavedIds] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (!sessionStorageKey || typeof window === "undefined") return
    if (restoredKeyRef.current === sessionStorageKey) return
    if (cards.length === 0) return

    restoredKeyRef.current = sessionStorageKey
    restoreDoneRef.current = true

    try {
      const saved = localStorage.getItem(sessionStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        const hoursDiff = (Date.now() - (parsed.timestamp || Date.now())) / (1000 * 60 * 60)
        if (hoursDiff < 24) {
          const loadedReviews = parsed.sessionReviews ?? []
          const validReviews = loadedReviews.filter((r: { state?: SrsState }) => r.state != null)
          setSessionReviews(validReviews)

          const loadedRatings = parsed.latestRatings ?? []
          const validRatings = new Map<string, 0 | 3 | 4 | 5>()
          for (const [cardId, rating] of loadedRatings) {
            if (typeof cardId === 'string' && [0, 3, 4, 5].includes(rating)) {
              validRatings.set(cardId, rating as 0 | 3 | 4 | 5)
            }
          }
          setLatestRatings(validRatings)
          failedCardIdsRef.current.clear()

          const loadedLapsedIds = parsed.lapsedCardIds ?? []
          const validLapsedIds = new Set<string>()
          for (const id of loadedLapsedIds) {
            if (typeof id === 'string') {
              validLapsedIds.add(id)
            }
          }
          setLapsedCardIds(validLapsedIds)

          const loadedRepeatQueueIds = parsed.repeatQueueIds ?? []
          const validRepeatQueue: SwipeFlashcard[] = []
          const cardsById = new Map(cards.map(c => [String(c.id), c] as [string, SwipeFlashcard]))
          for (const id of loadedRepeatQueueIds) {
            const card = cardsById.get(id)
            if (card) {
              validRepeatQueue.push(card)
            }
          }
          setRepeatQueue(validRepeatQueue)

          const savedIdx = parsed.savedIdx ?? 0
          const totalCards = cards.length + validRepeatQueue.length
          const clampedIdx = totalCards > 0 ? Math.min(Math.max(0, savedIdx), totalCards - 1) : 0
          setIdx(clampedIdx)
        } else {
          localStorage.removeItem(sessionStorageKey)
        }
      }
    } catch {}
  }, [sessionStorageKey, cards])

  const [repeatQueue, setRepeatQueue] = React.useState<SwipeFlashcard[]>([])

  React.useEffect(() => {
    if (repeatQueue.length === 0 && idx >= orderedCards.length && orderedCards.length > 0) {
      setIdx(Math.max(0, orderedCards.length - 1))
    }
  }, [repeatQueue.length, idx, orderedCards.length])
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
  const skipPersistRef = React.useRef(false)
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

    const failedReviews = sessionReviews.filter(r => failedCardIdsRef.current.has(r.cardId))
    if (failedReviews.length > 0 && canSaveSrs) {
      recordSrsReviewBatch(supa, userId, failedReviews, sessionId)
        .catch((error: unknown) => {
          console.error("Gagal menyimpan progress SRS yang gagal sebelumnya:", error)
          toast.error("Gagal menyimpan progress SRS")
        })
    }

    const sessionStats = computeSessionStats(latestRatings, lapsedCardIds)
    onComplete?.({ mudah: sessionStats.mudah, lupa: sessionStats.lupa, sulit: sessionStats.sulit, ingat: sessionStats.ingat }, sessionReviews)
  }, [done, cards.length, latestRatings, lapsedCardIds, onComplete, sessionReviews, userId, deckCardIds, supa, sessionId, canSaveSrs])

  React.useEffect(() => {
    if (!done || cards.length === 0) {
      setResultRingValue(0)
      return
    }
    const target = computeSessionAccuracy(latestRatings, lapsedCardIds)

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
  }, [done, cards.length, latestRatings, lapsedCardIds])

  React.useEffect(() => {
    if (typeof window === "undefined" || done || skipPersistRef.current) return
    if (!restoreDoneRef.current) return
    try {
      const key = `flashcard_session_${userId}_${deckCardIds?.join('_')}`
      localStorage.setItem(key, JSON.stringify({
        savedIdx: idx,
        sessionReviews,
        latestRatings: Array.from(latestRatings.entries()),
        repeatQueueIds: repeatQueue.map(c => String(c.id)),
        lapsedCardIds: Array.from(lapsedCardIds),
        timestamp: Date.now()
      }))
    } catch {
    }
  }, [idx, sessionReviews, latestRatings, repeatQueue, lapsedCardIds, done, userId, deckCardIds])

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
    let cancelled = false

    async function fetchFullDeckIds() {
      if (!deckId) {
        if (!cancelled) setFullDeckIds(deckIdsRef.current)
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
            .order("id")
            .range(from, from + chunkSize - 1)

          if (error) {
            console.error("fetchFullDeckIds error:", error)
            if (!cancelled) setFullDeckIds(deckIdsRef.current)
            return
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

        if (!cancelled) setFullDeckIds(allIds)
      } catch (e) {
        console.error("fetchFullDeckIds exception:", e)
        if (!cancelled) setFullDeckIds(deckIdsRef.current)
      }
    }

    fetchFullDeckIds()
    return () => { cancelled = true }
  }, [deckId, supa, deckIdsStr])

  React.useEffect(() => {
    let cancelled = false

    async function fetchHeaderStats() {
      if (!userId) {
        if (!cancelled) setDueToday(0)
        return
      }

      const today = todayStr()
      let dueCount = 0
      const savedIds = new Set<string>()

      const targetIds = fullDeckIdsRef.current.length > 0 ? fullDeckIdsRef.current : deckIdsRef.current

      for (let i = 0; i < targetIds.length; i += 100) {
        const chunk = targetIds.slice(i, i + 100)
        const { data, error } = await supa
          .from("user_card_progress")
          .select("card_id, next_review")
          .eq("user_id", userId)
          .in("card_id", chunk)

        if (error) {
          console.error("fetchHeaderStats error:", error)
          return
        }

        const progressMap = new Map<string, { next_review: string | null }>()
        for (const row of data ?? []) {
          if (row.card_id) {
            progressMap.set(String(row.card_id), {
              next_review: row.next_review
            })
          }
        }

        for (const id of chunk) {
          const p = progressMap.get(id)
          if (p) {
            savedIds.add(id)
            if (!p.next_review || p.next_review <= today) {
              dueCount++
            }
          }
        }
      }

      if (!cancelled) {
        setDueToday(dueCount)
        setDbSavedIds(savedIds)
      }
    }

    fetchHeaderStats()
    return () => { cancelled = true }
  }, [userId, supa, deckIdsStr, fullDeckIdsStr])

  const headerStats = React.useMemo<SessionHeaderStats>(() => {
    const totalCards = fullDeckIds.length > 0 ? fullDeckIds.length : deckIds.length
    const saved = countSaved(fullDeckIds.length > 0 ? fullDeckIds : deckIds, dbSavedIds, sessionReviews)
    const mastered = countSwipeMastered(latestRatings, fullDeckIds.length > 0 ? fullDeckIds : deckIds, lapsedCardIds)
    const rated = latestRatings.size
    const accuracy = computeSessionAccuracy(latestRatings, lapsedCardIds)
    const clampedDueToday = Math.min(dueToday, saved)

    return {
      dueToday: clampedDueToday,
      totalCards,
      accuracy,
      mastered,
      rated,
      saved
    }
  }, [fullDeckIds, deckIds, dbSavedIds, sessionReviews, latestRatings, lapsedCardIds, dueToday])

  const sessionStats = React.useMemo(() => {
    return computeSessionStats(latestRatings, lapsedCardIds)
  }, [latestRatings, lapsedCardIds])

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
    const isDue = isCardDue(card.nextReview)
    const shouldRecordSrs = isDue || quality === 0

    if (!isFromRepeatQueue && shouldRecordSrs) {
      setSessionReviews(prev => {
        const filtered = prev.filter(r => r.cardId !== cardIdStr)
        return [...filtered, { cardId: cardIdStr, quality, state: getCardSrsState(card) }]
      })

      if (canSaveSrs) {
        void recordSrsReview(supa, userId, { cardId: cardIdStr, quality, state: getCardSrsState(card) }, sessionId)
          .then(() => {
            failedCardIdsRef.current.delete(cardIdStr)
          })
          .catch((error: unknown) => {
            console.error("Gagal menyimpan progress SRS untuk kartu:", cardIdStr, error)
            failedCardIdsRef.current.add(cardIdStr)
            if (!saveErrorShownRef.current) {
              toast.error("Gagal menyimpan progress SRS")
              saveErrorShownRef.current = true
            }
          })

        if (!streakSavedRef.current) {
          void (async () => {
            try {
              const { error } = await supa.from("daily_streaks").upsert(
                { user_id: userId, date: todayStr() },
                { onConflict: "user_id,date", ignoreDuplicates: true }
              )
              if (!error) {
                streakSavedRef.current = true
              }
            } catch (err: unknown) {
              console.error("Gagal merekam daily streak:", err)
            }
          })()
        }
      }
    }

    setLatestRatings(prev => new Map(prev).set(cardIdStr, quality))

    if (quality === 0) {
      setRepeatQueue(prev => [...prev, card])
      setLapsedCardIds(prev => new Set(prev).add(cardIdStr))
    }

    setDragX(0); setDragY(0); setFlip(0); setFeedback(null); setSelectedRating(null)

    if (idx + 1 >= currentTotal + (quality === 0 ? 1 : 0)) {
      setDone(true)
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

      skipPersistRef.current = true

      const key = `flashcard_session_${userId}_${deckCardIds?.join('_')}`
      localStorage.removeItem(key)

      setSessionReviews([])
      setDbSavedIds(new Set())
      setLatestRatings(new Map())
      setLapsedCardIds(new Set())
      setDueToday(0)
      failedCardIdsRef.current.clear()
      restoredKeyRef.current = null
      restoreDoneRef.current = false

      setShowResetModal(false)
      setResetSuccess(true)
      setTimeout(() => {
        localStorage.removeItem(key)
        window.location.reload()
      }, 1500)
      setTimeout(() => setResetSuccess(false), 3000)
    } catch (error) {
      skipPersistRef.current = false
      console.error("Error resetting SRS:", error)
      const message = error instanceof Error ? error.message : String(error)
      toast.error("Gagal reset SRS: " + message)
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
    dragX, dragY, isDragging, flyOut,
    cardRef, handleCardClick, onPointerDown, onPointerMove, onPointerCancel, onPointerUp,
    card, progress, currentTotal,
    headerStats, resultRingValue,
    selectedRating, advance, goToPrevious, hideAnswer, skipCard,
    isRecording, toggleListen, feedback,
    sessionStats
  }
}