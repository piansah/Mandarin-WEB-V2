"use client"

/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/* 
   page.tsx -- Dashboard - Scores, Stats, Progress, Activity List */

import * as React from "react"
import {
  RotateCcw,
  CheckCircle2,
  Languages,
  Flame,
  ClipboardList,
  FolderOpen,
  BookText,
  SquareStack,
  Zap,
  Play,
  RefreshCw,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  ChevronDown,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { fetchDashboardStats, type DashboardStats } from "@/lib/dashboard-stats"
import { fetchModulOverview } from "@/lib/modul"
import { useSupabase } from "@/hooks/use-supabase"
import { useRouter } from "next/navigation"
import { speakMandarin } from "@/lib/tts"

type LevelBreakdown = {
  mudah: number
  ingat: number
  sulit: number
  lupa: number
  notStarted: number
  totalCards: number
  due: number
}

type SrsStats = {
  total: number
  mature: number
  due: number
  hafalToday: number
  lupaToday: number
  pctToday: number
  totalToday: number
  // breakdown by quality (all levels)
  mudah: number
  ingat: number
  sulit: number
  lupa: number
  notStarted: number
  totalCards: number
  // per-HSK breakdown
  hskLevels: number[]
  byLevel: Record<number, LevelBreakdown>
}

type ActiveDeckHero = {
  id: number
  title: string
  hsk_level: number
  currentStep: number
  totalSteps: number
  stepName: string
  remainingMinutes: number
  percent: number
  watermarkList: string[]
  actionUrl: string
  isCompletedToday: boolean
}

export default function DashboardPage() {
  const supa = useSupabase()
  const router = useRouter()
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [srsStats, setSrsStats] = React.useState<SrsStats | null>(null)
  const [nextDeck, setNextDeck] = React.useState<{ id: number; title: string; hsk_level: number } | null>(null)
  const [activeDeckHero, setActiveDeckHero] = React.useState<ActiveDeckHero | null>(null)
  const [watermarkIndex, setWatermarkIndex] = React.useState(0)
  const [isWatermarkPopping, setIsWatermarkPopping] = React.useState(false)
  const [nextModule, setNextModule] = React.useState<{ slug: string; title: string } | null>(null)
  const [nextEstafet, setNextEstafet] = React.useState<{ key: string; title: string } | null>(null)
  const [deckQuotaMet, setDeckQuotaMet] = React.useState(false)
  const [runningDeckHsk, setRunningDeckHsk] = React.useState<number | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mandarin_running_hsk")
      if (saved) return Number(saved)
    }
    return null
  })
  const [hskFilterLevel, setHskFilterLevel] = React.useState<number | null>(null)

  const loadSrsStats = React.useCallback(async () => {
    try {
      const { data: { user } } = await supa.auth.getUser()
      if (!user) return

      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

      // Fetch sets (for hsk_level and card counts)
      const { data: sets } = await supa
        .from("flashcard_sets")
        .select("id, hsk_level, flashcard_cards(count)")
        .eq("is_default", true)

      // Total cards per level & setLevelMap
      const setLevelMap = new Map<number, number>()
      const totalByLevel = new Map<number, number>()
      let grandTotalCards = 0
      if (sets) {
        sets.forEach((s: any) => {
          setLevelMap.set(s.id, s.hsk_level)
          const lvl = s.hsk_level || 1
          const cnt = s.flashcard_cards?.[0]?.count ?? 0
          totalByLevel.set(lvl, (totalByLevel.get(lvl) || 0) + cnt)
          grandTotalCards += cnt
        })
      }

      const { data: progress } = await supa
        .from("user_card_progress")
        .select("card_id, srs_level, next_review, last_reviewed, last_quality")
        .eq("user_id", user.id)

      if (!progress) return

      const progressByCard = new Map()
      progress.forEach((row) => {
        if (!row.card_id) return
        const prev = progressByCard.get(row.card_id)
        const prevKey = `${prev?.last_reviewed || ""}|${prev?.next_review || ""}`
        const rowKey = `${row.last_reviewed || ""}|${row.next_review || ""}`
        if (!prev || rowKey >= prevKey) progressByCard.set(row.card_id, row)
      })

      const reviewed = [...progressByCard.values()]
      const total = reviewed.length

      // Map only reviewed cards to their level
      const cardLevelMap = new Map<string, number>()
      const reviewedCardIds = reviewed.map((r) => r.card_id).filter(Boolean)
      if (reviewedCardIds.length > 0) {
        const { data: studiedCards } = await supa
          .from("flashcard_cards")
          .select("id, set_id")
          .in("id", reviewedCardIds)

        if (studiedCards) {
          studiedCards.forEach((c) => {
            const lvl = setLevelMap.get(c.set_id)
            if (lvl !== undefined) cardLevelMap.set(c.id, lvl)
          })
        }
      }

      const todayCards = reviewed.filter((r) => r.last_reviewed === today)
      const hafalToday = todayCards.filter((r) => r.last_quality === 4 || r.last_quality === 5).length
      const lupaToday = todayCards.filter((r) => r.last_quality === 0 || r.srs_level === 0).length
      const totalToday = todayCards.length
      const totalHafal = reviewed.filter((r) => r.last_quality === 4 || r.last_quality === 5).length
      const dueCount = reviewed.filter((r) => r.next_review && r.next_review <= today).length
      const pct = totalToday > 0 ? Math.round((hafalToday / totalToday) * 100) : 0

      // Global quality breakdown
      const mudah = reviewed.filter((r) => r.last_quality === 5).length
      const ingat = reviewed.filter((r) => r.last_quality === 4).length
      const sulit = reviewed.filter((r) => r.last_quality === 3).length
      const lupa = reviewed.filter((r) => r.last_quality !== null && r.last_quality <= 2).length
      const totalCards = grandTotalCards || total
      const notStarted = Math.max(0, totalCards - total)

      // Per-level breakdown
      const hskLevels = Array.from(new Set(sets?.map(s => s.hsk_level) ?? [])).sort((a, b) => a - b)
      const byLevel: Record<number, LevelBreakdown> = {}
      for (const lvl of hskLevels) {
        const lvlCards = reviewed.filter(r => cardLevelMap.get(r.card_id) === lvl)
        const lvlTotal = totalByLevel.get(lvl) ?? 0
        const lvlDue = lvlCards.filter(r => r.next_review && r.next_review <= today).length
        byLevel[lvl] = {
          mudah: lvlCards.filter(r => r.last_quality === 5).length,
          ingat: lvlCards.filter(r => r.last_quality === 4).length,
          sulit: lvlCards.filter(r => r.last_quality === 3).length,
          lupa: lvlCards.filter(r => r.last_quality !== null && r.last_quality <= 2).length,
          totalCards: lvlTotal,
          notStarted: Math.max(0, lvlTotal - lvlCards.length),
          due: lvlDue,
        }
      }

      setSrsStats({
        total, mature: totalHafal, due: dueCount,
        hafalToday, lupaToday, pctToday: pct, totalToday,
        mudah, ingat, sulit, lupa, notStarted, totalCards,
        hskLevels, byLevel,
      })
    } catch (e) {
      console.error(e)
    }
  }, [supa])

  const loadNextContent = React.useCallback(async () => {
    try {
      const { data: { user } } = await supa.auth.getUser()
      if (!user) return

      // Load next deck (flashcard)
      const { data: decks } = await supa
        .from("flashcard_sets")
        .select("id, title, hsk_level")
        .eq("is_default", true)
        .order("hsk_level", { ascending: true })
        .order("id", { ascending: true })

      let completedDeckCount = 0
      let hasCompletedDeckToday = false
      let todayCompletedDeckId: number | null = null

      // Start of today in user's local timezone (pukul 00:00:00 waktu lokal)
      const now = new Date()
      const localStartOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const localStartOfTodayISO = localStartOfToday.toISOString()

      // Cek apakah user sudah menyelesaikan setidaknya 1 deck HARI INI (syarat lulus: Quiz bernilai >= 80% sejak pukul 00:00 waktu lokal)
      const { data: quizToday } = await supa
        .from("user_scores")
        .select("id, key, score, updated_at")
        .eq("user_id", user.id)
        .eq("type", "quiz")
        .gte("score", 80)
        .gte("updated_at", localStartOfTodayISO)
        .order("updated_at", { ascending: false })
        .limit(1)

      if (quizToday && quizToday.length > 0) {
        hasCompletedDeckToday = true
        todayCompletedDeckId = Number(quizToday[0].key)
      }

      if (decks && decks.length > 0) {
        // Ambil semua skor quiz user untuk mengecek deck yang sudah tuntas (skor >= 80%)
        const { data: allQuizScores } = await supa
          .from("user_scores")
          .select("key, score")
          .eq("user_id", user.id)
          .eq("type", "quiz")

        const quizScoreByDeck = new Map<number, number>()
        if (allQuizScores) {
          allQuizScores.forEach((qs) => {
            const deckId = Number(qs.key)
            const prev = quizScoreByDeck.get(deckId) ?? 0
            if ((qs.score ?? 0) > prev) {
              quizScoreByDeck.set(deckId, qs.score ?? 0)
            }
          })
        }

        // BATCH OPTIMIZATION: Get all card IDs and progress in single queries
        const deckIds = decks.map(d => d.id)

        // Get all card IDs and hanzi for all decks at once
        const { data: allDeckCards } = await supa
          .from("flashcard_cards")
          .select("id, set_id, hanzi")
          .in("set_id", deckIds)

        // Group cards by deck
        const cardsByDeck = new Map<number, { id: string; hanzi: string }[]>()
        if (allDeckCards) {
          allDeckCards.forEach(card => {
            const existing = cardsByDeck.get(card.set_id) || []
            existing.push({ id: card.id, hanzi: card.hanzi })
            cardsByDeck.set(card.set_id, existing)
          })
        }

        // Get all progress for user at once
        const { data: allProgress } = await supa
          .from("user_card_progress")
          .select("card_id, srs_level")
          .eq("user_id", user.id)

        // Group progress by card
        const progressByCard = new Map<string, { srs_level: number }>()
        if (allProgress) {
          allProgress.forEach(p => {
            if (p.card_id) {
              progressByCard.set(p.card_id, { srs_level: p.srs_level })
            }
          })
        }

        let firstIncompleteDeck = null

        // Find first incomplete deck (deck dianggap selesai jika quiz >= 80%)
        for (const deck of decks) {
          const quizScore = quizScoreByDeck.get(deck.id) ?? 0
          const isPassed = quizScore >= 80

          if (!isPassed) {
            firstIncompleteDeck = deck
            break
          }

          // Count completed decks
          completedDeckCount++
        }

        // Tentukan HSK level yang sedang berjalan sesuai progress deck
        const runningHsk = firstIncompleteDeck
          ? firstIncompleteDeck.hsk_level
          : (decks && decks.length > 0 ? decks[decks.length - 1].hsk_level : 1)
        setRunningDeckHsk(runningHsk)
        if (typeof window !== "undefined") {
          localStorage.setItem("mandarin_running_hsk", String(runningHsk))
        }

        // Cek apakah user melanjutkan mengerjakan deck berikutnya hari ini
        let isWorkingOnNewerDeck = false
        if (hasCompletedDeckToday && firstIncompleteDeck && firstIncompleteDeck.id !== todayCompletedDeckId) {
          const targetCards = cardsByDeck.get(firstIncompleteDeck.id) || []
          const hasCardProgress = targetCards.some(c => {
            const p = progressByCard.get(c.id)
            return p && p.srs_level >= 1
          })
          const hasQuizAttempt = quizScoreByDeck.has(firstIncompleteDeck.id)

          if (hasCardProgress || hasQuizAttempt) {
            isWorkingOnNewerDeck = true
          }
        }

        // Terapkan aturan 1 hari 1 deck untuk "Sesi Hari Ini" (reset tiap jam 12 malam waktu lokal)
        if (hasCompletedDeckToday && !isWorkingOnNewerDeck) {
          setDeckQuotaMet(true)
          setNextDeck(null)
        } else if (firstIncompleteDeck) {
          setDeckQuotaMet(false)
          setNextDeck(firstIncompleteDeck)
        } else {
          setDeckQuotaMet(true)
          setNextDeck(null)
        }

        // Determine target hero deck for "Lanjutkan belajar" (menyesuaikan ke deck baru jika dikerjakan)
        const targetHeroDeck = (hasCompletedDeckToday && !isWorkingOnNewerDeck && todayCompletedDeckId
          ? decks.find(d => d.id === todayCompletedDeckId)
          : null) || firstIncompleteDeck || decks[0]

        if (targetHeroDeck) {
          const { data: heroScores } = await supa
            .from("user_scores")
            .select("type, score")
            .eq("user_id", user.id)
            .eq("key", String(targetHeroDeck.id))
            .in("type", ["fc_session", "quiz"])

          const fcDone = heroScores?.some(s => s.type === "fc_session") ?? false
          const maxQuizScore = heroScores
            ?.filter(s => s.type === "quiz")
            .reduce((max, s) => Math.max(max, s.score ?? 0), 0) ?? 0
          const quizDone = maxQuizScore >= 80

          let currentStep = 1
          let stepName = "Flashcard"
          let actionUrl = `/dashboard/flashcard/${targetHeroDeck.id}`

          if (!fcDone) {
            currentStep = 1
            stepName = "Flashcard"
            actionUrl = `/dashboard/flashcard/${targetHeroDeck.id}`
          } else if (!quizDone) {
            currentStep = 2
            stepName = "Quiz Kosakata"
            actionUrl = `/dashboard/practice/quiz/${targetHeroDeck.id}`
          } else {
            currentStep = 2
            stepName = "Selesai"
            actionUrl = `/dashboard/flashcard/${targetHeroDeck.id}`
          }

          const targetCards = cardsByDeck.get(targetHeroDeck.id) || []
          const watermarkList: string[] = []

          // Ambil kata asli dari deck yang memiliki minimal 2 suku kata (karakter)
          targetCards.forEach((c) => {
            const h = c.hanzi?.trim()
            if (h && h.length >= 2 && !watermarkList.includes(h)) {
              watermarkList.push(h)
            }
          })

          // Jika tidak ada kata >= 2 karakter, gunakan semua kata dari deck
          if (watermarkList.length === 0) {
            targetCards.forEach((c) => {
              const h = c.hanzi?.trim()
              if (h && !watermarkList.includes(h)) {
                watermarkList.push(h)
              }
            })
          }

          // Fallback jika deck benar-benar kosong
          if (watermarkList.length === 0) {
            watermarkList.push("你好")
          }

          const isDeckFinished = (hasCompletedDeckToday && targetHeroDeck.id === todayCompletedDeckId) || (fcDone && quizDone)
          let percent = 0
          if (isDeckFinished) {
            percent = 100
          } else if (fcDone) {
            percent = 50
          } else {
            const cardDoneCount = targetCards.filter(c => {
              const p = progressByCard.get(c.id)
              return p && p.srs_level >= 1
            }).length
            const cardRatio = targetCards.length > 0 ? cardDoneCount / targetCards.length : 0
            percent = Math.min(45, Math.round(cardRatio * 50))
          }

          setActiveDeckHero({
            id: targetHeroDeck.id,
            title: targetHeroDeck.title,
            hsk_level: targetHeroDeck.hsk_level,
            currentStep,
            totalSteps: 2,
            stepName,
            remainingMinutes: 0,
            percent,
            watermarkList,
            actionUrl,
            isCompletedToday: isDeckFinished,
          })
        }
      }

      // completedDeckCount is used locally for estafet unlock logic

      // Load next module dari skema `modul` (lihat src/lib/modul.ts)
      fetchModulOverview()
        .then((overview) => {
          setNextModule(overview.nextStep ? { slug: overview.nextStep.slug, title: overview.nextStep.title } : null)
        })
        .catch(() => setNextModule(null))

      // Load next estafet (cumulative flashcard)
      const { data: estafetSets } = await supa
        .from("hanzi_sets")
        .select("key, title, unlock_after")
        .order("hsk_level", { ascending: true })
        .order("sort_order", { ascending: true })

      if (estafetSets && estafetSets.length > 0) {
        // BATCH OPTIMIZATION: Get all item counts at once
        const setKeys = estafetSets.map(s => s.key)
        const { data: allItems } = await supa
          .from("hanzi_items")
          .select("hanzi_key")
          .in("hanzi_key", setKeys)

        const itemCounts: Record<string, number> = {}
        if (allItems) {
          allItems.forEach(item => {
            itemCounts[item.hanzi_key] = (itemCounts[item.hanzi_key] || 0) + 1
          })
        }

        // Get read counts for all estafet sets
        const readCounts: Record<string, number> = {}
        for (const set of estafetSets) {
          const saved = window.localStorage.getItem(`hanzi_read_progress:${set.key}`)
          const completedIds = saved ? (JSON.parse(saved) as number[]) : []
          readCounts[set.key] = Array.isArray(completedIds) ? completedIds.length : 0
        }

        // Find first unlocked and incomplete estafet
        for (let i = 0; i < estafetSets.length; i++) {
          const set = estafetSets[i]

          // Check if estafet is unlocked based on completed deck count
          if (set.unlock_after > completedDeckCount) {
            continue
          }

          // Check if previous level is complete
          const prevSet = i > 0 ? estafetSets[i - 1] : null
          const prevDone = prevSet
            ? readCounts[prevSet.key] >= itemCounts[prevSet.key] && itemCounts[prevSet.key] > 0
            : true

          // If this level is unlocked and incomplete, show it
          if (prevDone && readCounts[set.key] < itemCounts[set.key]) {
            setNextEstafet(set)
            break
          }

          // If this level is unlocked and complete, check next level
          if (prevDone && readCounts[set.key] >= itemCounts[set.key] && itemCounts[set.key] > 0) {
            continue
          }

          // If this level is locked, check next level
          if (!prevDone) {
            continue
          }
        }
      }
    } catch (e) {
      console.error(e)
    }
  }, [supa])

  React.useEffect(() => {
    fetchDashboardStats().then((s) => {
      setStats(s)
      setLoading(false)
    })
    loadSrsStats()
    loadNextContent()
  }, [supa, loadSrsStats, loadNextContent])

  const hour = new Date().getHours()
  let GreetingIcon = Sun
  let greetingText = "Selamat Pagi"

  if (hour >= 18 || hour < 4) {
    GreetingIcon = Moon
    greetingText = "Selamat Malam"
  } else if (hour >= 15) {
    GreetingIcon = Sunset
    greetingText = "Selamat Sore"
  } else if (hour >= 11) {
    GreetingIcon = Sun
    greetingText = "Selamat Siang"
  } else if (hour >= 4) {
    GreetingIcon = Sunrise
    greetingText = "Selamat Pagi"
  }

  const handleNextWatermark = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!activeDeckHero || activeDeckHero.watermarkList.length === 0) return
    const list = activeDeckHero.watermarkList
    const currentWord = list[watermarkIndex % list.length] || list[0]
    const nextIdx = (watermarkIndex + 1) % list.length

    if (currentWord) {
      speakMandarin(currentWord)
    }

    setIsWatermarkPopping(true)
    setWatermarkIndex(nextIdx)
    setTimeout(() => setIsWatermarkPopping(false), 200)
  }, [activeDeckHero, watermarkIndex])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <p className="text-sm text-muted-foreground">Memuat dashboard...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <p className="text-sm text-muted-foreground">Kamu belum login.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6 flex flex-col gap-6">
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes flame-pop {
          0% { transform: scale(0.3) translateY(5px); opacity: 0; }
          60% { transform: scale(1.25) translateY(-2px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-flame-pop {
          animation: flame-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
      {/* Header Greeting */}
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex items-center gap-2 font-medium text-muted-foreground mb-1">
          <GreetingIcon className="h-5 w-5" />
          <span>{greetingText}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-normal tracking-tight">
          <span className="text-foreground/90">Halo, </span>
          <span className="font-extrabold text-foreground capitalize">{stats.displayName.toLowerCase()}</span>
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
          Ayo lanjutkan perjalanan belajar Mandarinmu!
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
            {stats.tierLabel}
          </Badge>
          <Badge variant="outline" className="border-muted-foreground/30">
            {stats.tierHsk}
          </Badge>
        </div>
      </div>

      {/* Grid Atas: Lanjutkan Belajar (Deck Hero) & Streak (60/40) */}
      <div className="grid gap-4 lg:grid-cols-[6fr_4fr] relative">
        {/* Lanjutkan Belajar (Deck Hero) */}
        <Card className="border-emerald-500/20 dark:border-emerald-500/30 bg-card backdrop-blur-md shadow-sm overflow-hidden relative group flex flex-col justify-center">
          {/* Ambient soft green shadow & gradient exclusively on the right side behind Hanzi */}
          <div className="absolute right-0 top-0 bottom-0 w-2/3 sm:w-1/2 bg-gradient-to-l from-emerald-100/50 via-emerald-50/20 to-transparent dark:from-emerald-950/25 dark:via-emerald-950/8 dark:to-transparent pointer-events-none rounded-r-xl" />
          <div className="absolute right-4 sm:right-10 top-1/2 -translate-y-1/2 w-36 sm:w-48 h-36 sm:h-48 bg-emerald-400/12 dark:bg-emerald-500/8 rounded-full blur-2xl sm:blur-3xl pointer-events-none" />

          {/* Watermark Hanzi in background (Tap area khusus untuk ganti kata dari deck ini) */}
          {(() => {
            const currentWatermark = activeDeckHero?.watermarkList[watermarkIndex % (activeDeckHero?.watermarkList.length || 1)] || "你好"
            const watermarkSizeClass = currentWatermark.length >= 4
              ? "text-4xl sm:text-5xl lg:text-6xl"
              : currentWatermark.length === 3
                ? "text-5xl sm:text-6xl lg:text-7xl"
                : "text-6xl sm:text-7xl lg:text-8xl"

            return (
              <button
                type="button"
                title="Klik/tap untuk ganti kata Hanzi dari deck ini"
                onClick={handleNextWatermark}
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 flex items-center justify-end z-20 cursor-pointer bg-transparent border-0 outline-none group/hanzi select-none p-1"
              >
                <span
                  className={`whitespace-nowrap inline-block ${watermarkSizeClass} font-black text-emerald-600/20 dark:text-emerald-400/30 group-hover/hanzi:text-emerald-600/30 dark:group-hover/hanzi:text-emerald-400/45 leading-none tracking-normal transition-all duration-200 active:scale-90 ${isWatermarkPopping ? "scale-105 opacity-80" : ""
                    }`}
                  style={{
                    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "SimHei", sans-serif',
                    fontWeight: 900,
                  }}
                >
                  {currentWatermark}
                </span>
              </button>
            )
          })()}

          <CardContent className="p-4 sm:p-5 relative z-10 flex flex-col justify-center h-full pointer-events-none">
            <div className="space-y-2 max-w-[260px] sm:max-w-md pointer-events-auto">
              <div>
                <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 tracking-wide">
                  Lanjutkan belajar
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-tight mt-0.5">
                  {activeDeckHero?.title || "Mulai Belajar Deck"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeDeckHero?.isCompletedToday
                    ? "Target harian selesai · Hebat, pertahankan konsistensimu!"
                    : `Bagian ${activeDeckHero?.currentStep || 1} dari 2`}
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-1 pt-0.5">
                <div className="h-1.5 sm:h-2 w-full max-w-xs rounded-full bg-emerald-500/10 dark:bg-muted/60 overflow-hidden border border-emerald-500/20 dark:border-border/40 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-out"
                    style={{ width: `${activeDeckHero?.percent || 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {activeDeckHero?.percent || 0}% deck selesai
                </p>
              </div>

              {/* Button langsung di bawah progress bar tanpa jarak jauh */}
              <div className="pt-2">
                <Button
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-full px-5 py-2 h-9 text-xs sm:text-sm transition-all flex items-center gap-1.5 group/btn cursor-pointer"
                  onClick={() => router.push(activeDeckHero?.actionUrl || `/dashboard/flashcard`)}
                >
                  <span>{activeDeckHero?.isCompletedToday ? "Ulangi Pelajaran" : "Lanjutkan pelajaran"}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Streak Widget */}
        <Card className="border-border/30 bg-card/40 backdrop-blur-md shadow-sm overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity duration-500">
            <Flame className="w-24 h-24 text-primary" />
          </div>

          <CardContent className="p-4 sm:p-5 relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-2.5 w-full">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                    Streak belajar
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-bold text-primary">{stats.streak}</span>
                    <span className="text-xs text-muted-foreground">hari beruntun</span>
                  </div>
                </div>
                <Flame className="h-5 w-5 text-primary drop-shadow-md" />
              </div>
            </div>

            <div className="relative mb-2.5 w-full px-1">
              {/* Connecting line behind dots */}
              <div className="absolute top-[16px] left-4 right-4 h-[1.5px] bg-border/40 -z-10" />

              <div className="grid grid-cols-7 gap-1 w-full relative z-10">
                {stats.weekDots.map((dot, i) => (
                  <div
                    key={i}
                    className={`flex flex-col items-center justify-center rounded-md py-1.5 px-0.5 transition-colors ${dot.isToday
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : dot.active
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-muted/30 text-muted-foreground border border-border/30"
                      }`}
                  >
                    <div className="text-xs font-bold mb-0.5 flex items-center justify-center min-h-[16px]">
                      {dot.active ? (
                        <Flame
                          className="w-3.5 h-3.5 fill-current animate-flame-pop"
                          style={{ animationDelay: `${i * 75}ms` }}
                        />
                      ) : dot.isToday ? (
                        "•"
                      ) : (
                        "-"
                      )}
                    </div>
                    <div className="text-[9px] font-medium uppercase tracking-wider">{dot.day}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 w-full">
              <div className="flex flex-col items-center justify-center rounded-lg bg-muted/20 border border-border/40 py-2 px-3">
                <span className="text-base sm:text-lg font-bold text-primary">{stats.bestStreak}</span>
                <span className="text-[10px] text-muted-foreground">Streak terbaik</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg bg-muted/20 border border-border/40 py-2 px-3">
                <span className="text-base sm:text-lg font-bold text-primary">{stats.consistency}%</span>
                <span className="text-[10px] text-muted-foreground">Konsistensi</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sesi Hari Ini - Full Width */}
      <Card className="border-border/30 bg-card/40 backdrop-blur-md shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-500">
                <Zap className="h-4 w-4 fill-current" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Sesi hari ini</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Pas dengan target harianmu</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <div className="mx-6 h-px bg-border/50 mb-4" />
        <CardContent>
          <div className="space-y-3">
            {/* Modul Card */}
            {nextModule ? (
              <a href={`/dashboard/modul`} className="block">
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:border-primary/50 transition-all">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderOpen className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base truncate tracking-tight">{nextModule.title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate tracking-tighter sm:tracking-normal">Lanjutan jalur kamu · bagian pertama dari modul</p>
                  </div>
                </div>
              </a>
            ) : (
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-muted/30">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                  <FolderOpen className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-muted-foreground text-sm sm:text-base truncate tracking-tight">Modul Pembelajaran</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate tracking-tighter sm:tracking-normal">Tidak ada modul tersedia saat ini</p>
                </div>
              </div>
            )}

            {/* Daftar Kata Card */}
            {nextDeck ? (
              <a href={`/dashboard/flashcard/${nextDeck.id}`} className="block">
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:border-amber-500/50 transition-all">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Languages className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base truncate tracking-tight">{nextDeck.title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate tracking-tighter sm:tracking-normal">Flashcard & quiz · HSK {nextDeck.hsk_level}</p>
                  </div>
                </div>
              </a>
            ) : (
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-emerald-500/10">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-emerald-700 dark:text-emerald-500 text-sm sm:text-base truncate tracking-tight">Daftar Kata</h3>
                  <p className="text-[10px] sm:text-xs text-emerald-600/80 dark:text-emerald-400/80 truncate tracking-tighter sm:tracking-normal">
                    {deckQuotaMet ? "Target harian selesai · Sesi baru besok jam 00:00" : "Semua deck sudah selesai"}
                  </p>
                </div>
              </div>
            )}

            {/* Review Kosakata (SRS) Event Shortcut */}
            <a href="/dashboard/review" className="block group">
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:border-blue-500/50 hover:bg-blue-500/5 transition-all">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                  <SquareStack className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base truncate tracking-tight">
                      {srsStats && srsStats.due > 0 ? `Review ${srsStats.due} Kartu` : "Review Kosakata"}
                    </h3>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate tracking-tighter sm:tracking-normal">
                    {srsStats && srsStats.due > 0
                      ? `${srsStats.due} kartu siap direview · Perkuat memori jangka panjang`
                      : "Semua kartu hari ini sudah aman · Klik untuk review berkala"}
                  </p>
                </div>
                {srsStats && srsStats.due > 0 ? (
                  <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-xs shrink-0 hidden sm:inline-flex">
                    Siap review
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-xs shrink-0 hidden sm:inline-flex">
                    SRS Aktif
                  </Badge>
                )}
              </div>
            </a>

            {/* Estafet Card */}
            {nextEstafet ? (
              <a href={`/dashboard/flashcard/cumulative/${nextEstafet.key}`} className="block">
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:border-blue-500/50 transition-all">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <BookText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base truncate tracking-tight">{nextEstafet.title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate tracking-tighter sm:tracking-normal">Baca kalimat berurutan untuk melatih pemahaman</p>
                  </div>
                </div>
              </a>
            ) : null}
          </div>

          {/* Mulai Sesi CTA */}
          {(() => {
            // Tentukan URL sesi pertama yang tersedia
            const firstSessionUrl = nextModule
              ? `/dashboard/modul/${nextModule.slug}`
              : nextDeck
                ? `/dashboard/flashcard/${nextDeck.id}`
                : (srsStats && srsStats.due > 0)
                  ? `/dashboard/review`
                  : nextEstafet
                    ? `/dashboard/flashcard/cumulative/${nextEstafet.key}`
                    : null

            return (
              <div className="mt-8 space-y-5">
                {firstSessionUrl ? (
                  <Button
                    className="w-full bg-foreground text-background hover:bg-white rounded-full h-14 gap-2 text-base font-semibold transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] group relative overflow-hidden"
                    onClick={() => router.push(firstSessionUrl)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    <Play className="h-5 w-5 fill-current transition-transform group-hover:scale-110" /> Mulai sesi
                  </Button>
                ) : (
                  <Button
                    disabled
                    className="w-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-full h-14 gap-2 text-base font-semibold cursor-not-allowed opacity-90"
                  >
                    <CheckCircle2 className="h-5 w-5" /> Target Hari Ini Selesai · Sesi Baru Besok Pukul 00:00
                  </Button>
                )}
                <div className="flex flex-col items-center gap-1.5 text-[10px] sm:text-xs tracking-tight sm:tracking-normal text-foreground/80 text-center overflow-hidden w-full">
                  <p className="whitespace-nowrap">
                    {firstSessionUrl
                      ? "Bisa dilanjut kapan aja lewat menu Sesi Hari Ini"
                      : "Semua target hari ini sudah beres · Istirahat sejenak"}
                  </p>
                  <p className="flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap">
                    <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                    <span>Besok komposisinya beda — nyesuaiin ke progresmu</span>
                  </p>
                </div>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Grid Bawah: Review Kosakata (SRS Stats) & Aktivitas Terbaru */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Review Kosakata (SRS) — new design */}
        <Card className="border-border/30 bg-card/40 backdrop-blur-md shadow-sm gap-0">
          {(() => {
            const activeLevel = hskFilterLevel === 0
              ? null
              : (hskFilterLevel ?? runningDeckHsk ?? activeDeckHero?.hsk_level ?? (srsStats?.hskLevels && srsStats.hskLevels.length > 0 ? srsStats.hskLevels[0] : 1))

            return (
              <>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-500">
                        <SquareStack className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold">Kosakata HSK</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Kondisi hafalanmu<span className="hidden sm:inline"> di level yang sedang dipelajari</span>
                        </p>
                      </div>
                    </div>

                    {/* HSK Filter Pill Dropdown */}
                    {srsStats?.hskLevels && srsStats.hskLevels.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border/60 bg-muted/40 hover:bg-muted/70 text-xs font-semibold text-foreground transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0">
                          <span>{activeLevel ? `HSK ${activeLevel}` : "Semua HSK"}</span>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-32 rounded-xl border border-border/50 bg-popover/95 backdrop-blur-md p-1 shadow-md">
                          {srsStats.hskLevels.map((lvl) => (
                            <DropdownMenuItem
                              key={lvl}
                              onClick={() => setHskFilterLevel(lvl)}
                              className={`rounded-lg text-xs cursor-pointer py-1.5 px-2.5 font-medium ${activeLevel === lvl ? "bg-accent font-bold" : ""}`}
                            >
                              HSK {lvl}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem
                            onClick={() => setHskFilterLevel(0)}
                            className={`rounded-lg text-xs cursor-pointer py-1.5 px-2.5 font-medium ${activeLevel === null ? "bg-accent font-bold" : ""}`}
                          >
                            Semua HSK
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <div className="mx-6 h-px bg-border/50" />
                <CardContent className="pt-3">
                  {srsStats ? (() => {
                    const activeData = (activeLevel && srsStats.byLevel && srsStats.byLevel[activeLevel])
                      ? srsStats.byLevel[activeLevel]
                      : srsStats

                    const { mudah, ingat, sulit, lupa, notStarted, totalCards, due } = activeData
                    const reviewed = mudah + ingat + sulit + lupa
                    const pctDikuasai = totalCards > 0 ? Math.round(((mudah + ingat) / totalCards) * 100) : 0
                    const countToReview = (due !== undefined && due > 0) ? due : lupa

                    // Donut chart data
                    const segments = [
                      { value: mudah, color: "#22c55e", label: "Mudah" },
                      { value: ingat, color: "#3b82f6", label: "Ingat" },
                      { value: sulit, color: "#eab308", label: "Sulit" },
                      { value: lupa, color: "#ef4444", label: "Lupa" },
                      { value: notStarted, color: "#374151", label: "Belum" },
                    ].filter(s => s.value > 0)

                    const total = totalCards || 1
                    const R = 52, cx = 64, cy = 64, strokeW = 16
                    const circumference = 2 * Math.PI * R

                    let offset = 0
                    const arcs = segments.map(seg => {
                      const fraction = seg.value / total
                      const dash = fraction * circumference
                      const arc = { ...seg, dash, gap: circumference - dash, offset }
                      offset += dash
                      return arc
                    })

                    const legendItems = [
                      { label: "Mudah", value: mudah, color: "#22c55e", border: "border-emerald-500/40", bg: "bg-emerald-500/5", text: "text-emerald-500 dark:text-emerald-400" },
                      { label: "Ingat", value: ingat, color: "#3b82f6", border: "border-blue-500/40", bg: "bg-blue-500/5", text: "text-blue-500 dark:text-blue-400" },
                      { label: "Sulit", value: sulit, color: "#eab308", border: "border-amber-500/40", bg: "bg-amber-500/5", text: "text-amber-500 dark:text-amber-400" },
                      { label: "Lupa", value: lupa, color: "#ef4444", border: "border-red-500/40", bg: "bg-red-500/5", text: "text-red-500 dark:text-red-400" },
                    ]

                    return (
                      <div className="space-y-4">
                        {/* Chart + Legend: mobile stacked (chart on top), desktop row */}
                        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
                          {/* Donut SVG */}
                          <div className="shrink-0 relative mx-auto sm:mx-0 my-1 sm:my-0">
                            <svg width="128" height="128" viewBox="0 0 128 128">
                              {/* track */}
                              <circle cx={cx} cy={cy} r={R} fill="none" stroke="currentColor"
                                strokeWidth={strokeW} className="text-muted/30" />
                              {arcs.map((arc, i) => (
                                <circle key={i} cx={cx} cy={cy} r={R} fill="none"
                                  stroke={arc.color} strokeWidth={strokeW}
                                  strokeDasharray={`${arc.dash} ${arc.gap}`}
                                  strokeDashoffset={-arc.offset}
                                  strokeLinecap="butt"
                                  style={{ transform: "rotate(-90deg)", transformOrigin: "64px 64px" }}
                                />
                              ))}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-2xl font-bold text-foreground leading-none">{pctDikuasai}%</span>
                              <span className="text-[10px] text-muted-foreground mt-0.5">dikuasai</span>
                            </div>
                          </div>

                          {/* Legend */}
                          <div className="w-full flex-1 space-y-2">
                            {legendItems.map(item => (
                              <div key={item.label}
                                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 border ${item.border} ${item.bg}`}
                              >
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                                <span className={`text-sm font-medium flex-1 ${item.text}`}>
                                  {item.label}
                                </span>
                                <span className="text-xs text-muted-foreground">{item.value} kata</span>
                                <span className="text-xs font-semibold text-muted-foreground w-8 text-right">
                                  {totalCards > 0 ? Math.round((item.value / totalCards) * 100) : 0}%
                                </span>
                              </div>
                            ))}
                            {notStarted > 0 && (
                              <p className="text-xs text-muted-foreground text-center pt-1">
                                {notStarted} kata belum dipelajari
                              </p>
                            )}
                          </div>
                        </div>

                        {/* CTA */}
                        {reviewed > 0 || lupa > 0 ? (
                          <Button
                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-full h-11 text-sm transition-all cursor-pointer"
                            onClick={() => router.push('/dashboard/review')}
                          >
                            {countToReview > 0 ? `Review ${countToReview} Kartu` : "Review Kartu"}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full rounded-full h-11 text-sm"
                            onClick={() => router.push('/dashboard/flashcard')}
                          >
                            Mulai belajar kosakata
                          </Button>
                        )}
                      </div>
                    )
                  })() : (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <span className="text-sm">Memuat statistik...</span>
                    </div>
                  )}
                </CardContent>
              </>
            )
          })()}
        </Card>

        {/* Aktivitas Terbaru */}
        <Card className="border-border/30 bg-card/40 backdrop-blur-md shadow-sm gap-0">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-purple-500">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Aktivitas Terbaru</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Rekap sesi belajar terakhirmu</p>
              </div>
            </div>
          </CardHeader>
          <div className="mx-6 h-px bg-border/50" />
          <CardContent className="pt-2">
            {stats.recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <p className="text-sm">Belum ada aktivitas. Mulai belajar sekarang!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {stats.recentActivity.map((act, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {act.xp !== null ? `+${act.xp}` : act.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{act.key}</p>
                      <p className="text-xs text-muted-foreground">{act.typeLabel} · {act.timeAgo}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {act.xp !== null ? `${act.xp} XP` : `Score: ${act.score}`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
