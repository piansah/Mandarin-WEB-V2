"use client"

/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/* 
   page.tsx -- Dashboard - Scores, Stats, Progress, Activity List */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { PageLoader } from "@/components/page-loader"
import {
  RotateCcw,
  CheckCircle2,
  Languages,
  Search,
  MessageCircle,
  Flame,
  ClipboardList,
  FolderOpen,
  BookMarked,
  PenLine,
  Gamepad2,
  BookText,
  SquareStack,
  Zap,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  ChevronDown,
  Network,
  Map as MapIcon,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { getHanziReadProgressBySet } from "@/lib/user-scores"
import { fetchLearningPath, type PathStep } from "@/lib/path"

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

function DashboardImageCard({
  href,
  image,
  category,
  title,
  description,
  icon: Icon,
  tone,
  compact = false,
  unavailableText,
}: {
  href?: string
  image: string
  category: "Modul" | "Flashcard" | "Review" | "Estafet"
  title: string
  description: string
  icon: LucideIcon
  tone: "primary" | "amber" | "blue" | "violet"
  compact?: boolean
  unavailableText?: string
}) {
  const toneClass = {
    primary: "bg-primary/15 text-primary",
    amber: "bg-amber-500/15 text-amber-500",
    blue: "bg-blue-500/15 text-blue-500",
    violet: "bg-violet-500/15 text-violet-500",
  }[tone]

  const imageProps = {
    src: image,
    alt: "",
    width: 800,
    height: 500,
    sizes: "(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 30vw",
  }
  const mobileActionText = href ? "Buka →" : unavailableText ?? "Belum tersedia"
  const desktopActionText = href ? "Buka" : unavailableText ?? "Belum tersedia"
  const unavailableClass = href ? "" : "cursor-not-allowed opacity-65"

  const content = compact ? (
    <div data-bottom-accent="off" aria-disabled={!href || undefined} className={`group relative h-[124px] min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors lg:h-full ${unavailableClass} ${href ? "hover:border-primary/40" : ""}`}>
      <span className="absolute left-2.5 top-2.5 z-20 rounded-full border border-white/15 bg-slate-950/75 px-2.5 py-1 text-[10px] font-semibold leading-none text-white shadow-sm backdrop-blur-sm">
        {category}
      </span>
      <div className="absolute inset-0 lg:hidden">
        <Image {...imageProps} className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/50 to-slate-950/15" />
      </div>
      <div className="relative z-10 flex h-full flex-col justify-between p-3 lg:hidden">
        <div className="min-w-0 pt-5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-white">{title}</h3>
        </div>
        <span data-bottom-accent="off" className={`inline-flex w-fit text-xs font-semibold ${href ? "text-primary" : "text-muted-foreground"}`}>
          {mobileActionText}
        </span>
      </div>
      <div className="hidden h-full flex-col overflow-hidden lg:flex">
        <div className="relative overflow-hidden">
          <Image
            {...imageProps}
            className="aspect-[1.55/1] w-full shrink-0 object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3 lg:min-h-44 lg:p-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
              <Icon className="h-4 w-4" />
            </div>
            <h3 className="line-clamp-2 min-h-[2.75rem] min-w-0 text-base font-bold leading-snug text-foreground">{title}</h3>
          </div>
          <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground">{description}</p>
          <span data-bottom-accent={href ? "on" : "off"} className={`mt-auto flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold ${href ? "bg-primary text-primary-foreground transition-colors group-hover:bg-primary/90" : "bg-muted text-muted-foreground"}`}>
            {desktopActionText}
          </span>
        </div>
      </div>
    </div>
  ) : (
    <div data-bottom-accent="off" aria-disabled={!href || undefined} className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all ${unavailableClass} ${href ? "hover:border-primary/40 hover:shadow-md" : ""}`}>
      <span className="absolute left-2.5 top-2.5 z-20 rounded-full border border-white/15 bg-slate-950/75 px-2.5 py-1 text-[10px] font-semibold leading-none text-white shadow-sm backdrop-blur-sm">
        {category}
      </span>
      <div className="relative overflow-hidden">
        <Image {...imageProps} className="aspect-[1.55/1] w-full shrink-0 object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      </div>
      <div className="flex min-h-44 flex-1 flex-col p-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="line-clamp-2 min-h-[2.75rem] min-w-0 text-sm font-bold leading-snug text-foreground sm:text-base">{title}</h3>
        </div>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground">{description}</p>
        <span data-bottom-accent={href ? "on" : "off"} className={`mt-auto flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold ${href ? "bg-primary text-primary-foreground transition-colors group-hover:bg-primary/90" : "bg-muted text-muted-foreground"}`}>
          {desktopActionText}
        </span>
      </div>
    </div>
  )

  return href ? <a href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">{content}</a> : content
}

export default function DashboardPage() {
  const supa = useSupabase()
  const router = useRouter()
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [learningPath, setLearningPath] = React.useState<PathStep[]>([])
  const [loading, setLoading] = React.useState(true)
  const [srsStats, setSrsStats] = React.useState<SrsStats | null>(null)
  const [nextDeck, setNextDeck] = React.useState<{ id: number; title: string; hsk_level: number } | null>(null)
  const [activeDeckHero, setActiveDeckHero] = React.useState<ActiveDeckHero | null>(null)
  const [nextContentLoading, setNextContentLoading] = React.useState(true)
  const [nextContentError, setNextContentError] = React.useState(false)
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
      const { data: { session } } = await supa.auth.getSession()
      const user = session?.user
      if (!user) return

      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

      // Fetch sets (for hsk_level and card counts)
      const [{ data: sets }, { data: progress }] = await Promise.all([
        supa
          .from("flashcard_sets")
          .select("id, hsk_level, flashcard_cards(count)")
          .eq("is_default", true),
        supa
          .from("user_card_progress")
          .select("card_id, srs_level, next_review, last_reviewed, last_quality")
          .eq("user_id", user.id),
      ])

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
        // Keep REST query URLs bounded when an account has reviewed many cards.
        const cardIdBatches = Array.from({ length: Math.ceil(reviewedCardIds.length / 250) }, (_, index) =>
          reviewedCardIds.slice(index * 250, (index + 1) * 250),
        )
        const studiedCardBatches = await Promise.all(cardIdBatches.map((cardIds) =>
          supa.from("flashcard_cards").select("id, set_id").in("id", cardIds),
        ))

        studiedCardBatches.forEach(({ data: studiedCards }) => {
          studiedCards?.forEach((c) => {
            const lvl = setLevelMap.get(c.set_id)
            if (lvl !== undefined) cardLevelMap.set(c.id, lvl)
          })
        })
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
      const { data: { session } } = await supa.auth.getSession()
      const user = session?.user
      if (!user) return

      // Fetch independent dashboard data together. Previously this waited on
      // several serial requests (decks -> today's quiz -> all quizzes -> cards
      // -> progress) before the practice cards could render.
      const estafetDataPromise = Promise.all([
        supa
          .from("hanzi_sets")
          .select("key, title, unlock_after, hanzi_items(count)")
          .order("hsk_level", { ascending: true })
          .order("sort_order", { ascending: true }),
        getHanziReadProgressBySet(),
      ])
      fetchModulOverview()
        .then((overview) => {
          setNextModule(overview.nextStep ? { slug: overview.nextStep.slug, title: overview.nextStep.title } : null)
        })
        .catch(() => setNextModule(null))

      const [decksResult, allQuizScoresResult] = await Promise.all([
        supa
          .from("flashcard_sets")
          .select("id, title, hsk_level")
          .eq("is_default", true)
          .order("hsk_level", { ascending: true })
          .order("id", { ascending: true }),
        supa
          .from("user_scores")
          .select("key, score, updated_at")
          .eq("user_id", user.id)
          .eq("type", "quiz"),
      ])
      const decks = decksResult.data
      const allQuizScores = allQuizScoresResult.data

      let hasCompletedDeckToday = false
      let todayCompletedDeckId: number | null = null
      const quizScoreByDeck = new Map<number, number>()

      // Start of today in user's local timezone (pukul 00:00:00 waktu lokal)
      const now = new Date()
      const localStartOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const localStartOfTodayISO = localStartOfToday.toISOString()

      // Derive today's passed deck from the already-fetched quiz scores.
      const quizToday = (allQuizScores ?? [])
        .filter((score) => (score.score ?? 0) >= 80 && score.updated_at && score.updated_at >= localStartOfTodayISO)
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0]
      if (quizToday) {
        hasCompletedDeckToday = true
        todayCompletedDeckId = Number(quizToday.key)
      }

      if (decks && decks.length > 0) {
        // Ambil semua skor quiz user untuk mengecek deck yang sudah tuntas (skor >= 80%)
        if (allQuizScores) {
          allQuizScores.forEach((qs) => {
            const deckId = Number(qs.key)
            const prev = quizScoreByDeck.get(deckId) ?? 0
            if ((qs.score ?? 0) > prev) {
              quizScoreByDeck.set(deckId, qs.score ?? 0)
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

        }

        // Only fetch cards for the deck shown on the dashboard. The old code
        // downloaded every card from every HSK deck just to calculate one
        // progress percentage and watermark list.
        const loadDeckCards = async (deckId: number) => {
          const { data, error } = await supa
            .from("flashcard_cards")
            .select("id, hanzi")
            .eq("set_id", deckId)
            .order("id", { ascending: true })
          if (error) throw error
          return data ?? []
        }
        const loadProgressForCards = async (cardIds: string[]) => {
          if (cardIds.length === 0) return new Map<string, number>()
          const { data, error } = await supa
            .from("user_card_progress")
            .select("card_id, srs_level")
            .eq("user_id", user.id)
            .in("card_id", cardIds)
          if (error) throw error
          return new Map((data ?? []).map((row) => [row.card_id, row.srs_level]))
        }

        let quotaCheckCards: { id: string; hanzi: string }[] = []
        let quotaCheckProgress = new Map<string, number>()

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
          quotaCheckCards = await loadDeckCards(firstIncompleteDeck.id)
          quotaCheckProgress = await loadProgressForCards(quotaCheckCards.map((card) => card.id))
          const hasCardProgress = quotaCheckCards.some((card) => (quotaCheckProgress.get(card.id) ?? 0) >= 1)
          const hasQuizAttempt = quizScoreByDeck.has(firstIncompleteDeck.id)

          if (hasCardProgress || hasQuizAttempt) {
            isWorkingOnNewerDeck = true
          }
        }

        // Terapkan aturan 1 hari 1 deck untuk "Sesi Hari Ini" (reset tiap jam 12 malam waktu lokal)
        if (hasCompletedDeckToday && !isWorkingOnNewerDeck) {
          setDeckQuotaMet(true)
          // Keep today's completed deck visible in "Sesi hari ini" so it
          // matches the deck shown in "Lanjutkan belajar".
          setNextDeck(decks.find((deck) => deck.id === todayCompletedDeckId) ?? null)
        } else if (firstIncompleteDeck) {
          setDeckQuotaMet(false)
          setNextDeck(firstIncompleteDeck)
        } else {
          setDeckQuotaMet(true)
          setNextDeck(null)
        }
        // The practice cards that depend on the deck list and quiz scores can
        // render now. Hero progress and Estafet progress continue separately.
        setNextContentLoading(false)

        // Determine target hero deck for "Lanjutkan belajar" (menyesuaikan ke deck baru jika dikerjakan)
        const targetHeroDeck = (hasCompletedDeckToday && !isWorkingOnNewerDeck && todayCompletedDeckId
          ? decks.find(d => d.id === todayCompletedDeckId)
          : null) || firstIncompleteDeck || decks[0]

        if (targetHeroDeck) {
          const [heroScoresResult, targetCards] = await Promise.all([
            supa
              .from("user_scores")
              .select("type, score")
              .eq("user_id", user.id)
              .eq("key", String(targetHeroDeck.id))
              .in("type", ["fc_session", "quiz"]),
            targetHeroDeck.id === firstIncompleteDeck?.id && quotaCheckCards.length > 0
              ? Promise.resolve({ data: quotaCheckCards, error: null })
              : loadDeckCards(targetHeroDeck.id).then((data) => ({ data, error: null })),
          ])
          if (heroScoresResult.error) throw heroScoresResult.error
          const heroScores = heroScoresResult.data
          const cards = targetCards.data ?? []
          const progressByCard = targetHeroDeck.id === firstIncompleteDeck?.id
            ? quotaCheckProgress
            : await loadProgressForCards(cards.map((card) => card.id))

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
            // Arahkan ke deck page (daftar kata), bukan langsung ke practice —
            // biarkan user yang memutuskan dengan klik tombol latihan yang tersedia.
            actionUrl = `/dashboard/flashcard/${targetHeroDeck.id}`
          } else {
            currentStep = 2
            stepName = "Selesai"
            actionUrl = `/dashboard/flashcard/${targetHeroDeck.id}`
          }

          const watermarkList: string[] = []

          // Sertakan semua kosakata unik dari deck, termasuk kata satu karakter.
          cards.forEach((c) => {
            const h = c.hanzi?.trim()
            if (h && !watermarkList.includes(h)) {
              watermarkList.push(h)
            }
          })

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
            const cardDoneCount = cards.filter(c => {
              return (progressByCard.get(c.id) ?? 0) >= 1
            }).length
            const cardRatio = cards.length > 0 ? cardDoneCount / cards.length : 0
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
      if (!decks?.length) setNextContentLoading(false)

      // Load next estafet (cumulative flashcard)
      setNextEstafet(null)
      const [estafetSetsResult, readProgress] = await estafetDataPromise
      const estafetSets = estafetSetsResult.data
      if (estafetSets && estafetSets.length > 0) {
        const itemCounts: Record<string, number> = {}
        estafetSets.forEach(set => {
          itemCounts[set.key] = set.hanzi_items?.[0]?.count ?? 0
        })

        // Database is authoritative when available; localStorage is only an
        // offline fallback. Otherwise deleted/old local progress can hide the
        // Estafet item from today's session.
        const readCounts: Record<string, number> = {}
        for (const set of estafetSets) {
          const record = readProgress.bySet[set.key]
          if (readProgress.synced) {
            const completedIds = record?.readIds ?? []
            readCounts[set.key] = record?.score === 100
              ? itemCounts[set.key] ?? 0
              : completedIds.length

            if (record?.score !== 100 && completedIds.length > 0) {
              window.localStorage.setItem(`hanzi_read_progress:${set.key}`, JSON.stringify(completedIds))
            } else {
              window.localStorage.removeItem(`hanzi_read_progress:${set.key}`)
            }
          } else {
            const saved = window.localStorage.getItem(`hanzi_read_progress:${set.key}`)
            const completedIds = saved ? (JSON.parse(saved) as number[]) : []
            readCounts[set.key] = Array.isArray(completedIds) ? completedIds.length : 0
          }
        }

        // Show the first Estafet set that the Estafet page itself considers
        // unlocked and that still has unread items.
        for (let i = 0; i < estafetSets.length; i++) {
          const set = estafetSets[i]

          // `unlock_after` stores the required flashcard deck ID, not a count.
          // Keep this consistent with the Estafet list: that deck's quiz must
          // have a passing score before the set is available.
          const isUnlockedByQuiz = set.unlock_after === 0
            || (quizScoreByDeck.get(set.unlock_after) ?? 0) >= 80
          if (!isUnlockedByQuiz) {
            continue
          }

          // Estafet tetap berurutan: level berikutnya baru masuk sesi setelah
          // semua kalimat di level sebelumnya selesai dibaca.
          const prevSet = i > 0 ? estafetSets[i - 1] : null
          const prevDone = prevSet
            ? readCounts[prevSet.key] >= itemCounts[prevSet.key] && itemCounts[prevSet.key] > 0
            : true

          if (prevDone && readCounts[set.key] < itemCounts[set.key] && itemCounts[set.key] > 0) {
            setNextEstafet(set)
            break
          }
        }
      }
    } catch (e) {
      console.error(e)
      setNextContentError(true)
    } finally {
      setNextContentLoading(false)
    }
  }, [supa])

  React.useEffect(() => {
    let active = true
    fetchDashboardStats()
      .then((s) => {
        if (active) setStats(s)
      })
      .catch((error) => {
        console.error("Gagal memuat statistik dashboard:", error)
        if (active) setStats(null)
      })
      .finally(() => {
        // Jangan biarkan route terjebak di PageLoader saat salah satu request
        // gagal atau koneksi Supabase bermasalah.
        if (active) setLoading(false)
      })
    fetchLearningPath()
      .then((steps) => {
        if (active) setLearningPath(steps)
      })
      .catch((error) => console.error("Gagal memuat ringkasan peta belajar:", error))
    loadSrsStats()
    loadNextContent()
    return () => {
      active = false
    }
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
    return <PageLoader />
  }

  if (!stats) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <p className="text-sm text-muted-foreground">Data dashboard belum dapat dimuat. Periksa koneksi lalu segarkan halaman.</p>
      </div>
    )
  }

  const activeSrsLevel = hskFilterLevel ?? runningDeckHsk ?? activeDeckHero?.hsk_level ?? srsStats?.hskLevels?.[0] ?? 1
  const activeSrsData = activeSrsLevel && srsStats?.byLevel?.[activeSrsLevel]
    ? srsStats.byLevel[activeSrsLevel]
    : srsStats
  const activeSrsDue = activeSrsData?.due ?? 0
  const sessionDeck = nextDeck ?? (activeDeckHero
    ? { id: activeDeckHero.id, title: activeDeckHero.title, hsk_level: activeDeckHero.hsk_level }
    : null)

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-6 flex flex-col gap-6">
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

      {(() => {
        const activeStep = learningPath.find((step) => step.status === "active")
        const currentStep = activeStep ?? learningPath.find((step) => step.status === "completed") ?? learningPath[0]
        if (!currentStep) return null

        return (
          <Card className="overflow-hidden border-border/60 bg-card/60">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Peta belajar · {currentStep.status === "active" ? "Tahap aktif" : "Progres terakhir"}</p>
                  <h2 className="mt-1 truncate text-lg font-bold">{currentStep.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{currentStep.progressCompleted}/{currentStep.progressTotal} aktivitas selesai · {currentStep.progress}%</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:w-56">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/15" aria-label={`Progres ${currentStep.progress}%`}>
                  <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${currentStep.progress}%` }} />
                </div>
                <Link href="/dashboard/path" className="text-sm font-semibold text-primary hover:underline">Lihat roadmap</Link>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      <div className="grid gap-4 lg:gap-y-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.9fr)] lg:items-stretch">
      {/* Konten utama + kolom samping. `lg:contents` menempatkan hero dan streak
          langsung di grid besar tanpa mengubah urutan satu kolom di mobile. */}
      <div className="grid gap-4 lg:contents relative">
        <section className="order-2 flex flex-col gap-2 lg:order-none lg:col-start-1 lg:row-start-1">
        {/* Lanjutkan Belajar (Deck Hero) */}
        <Card className="lg:flex-1 border-emerald-500/20 dark:border-emerald-500/30 bg-card shadow-sm overflow-hidden relative group flex flex-col justify-center isolate">
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
                data-bottom-accent="off"
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

          <CardContent className="p-4 sm:p-5 relative z-10 flex flex-col justify-center pointer-events-none">
            <div className="space-y-2 max-w-[260px] sm:max-w-md pointer-events-auto">
              <div>
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
                <div className="h-1.5 sm:h-2 w-[52%] max-w-[140px] sm:w-full sm:max-w-xs rounded-full bg-emerald-500/10 dark:bg-muted/60 overflow-hidden border border-emerald-500/20 dark:border-border/40 shadow-inner">
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
                  <span>{activeDeckHero?.isCompletedToday ? "Ulangi Flashcard" : "Lanjutkan Flashcard"}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        </section>

        <section className="order-1 flex flex-col gap-2 lg:order-none lg:col-start-2 lg:row-start-1">
        {/* Streak Widget */}
        <Card className="w-full pb-0 border-border/30 bg-card/40 backdrop-blur-md shadow-sm overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity duration-500">
            <Flame className="w-24 h-24 text-primary" />
          </div>

          <CardContent className="px-4 pt-4 pb-4 sm:px-5 sm:pt-5 sm:pb-4 relative z-10 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2.5 w-full">
                <div>
                  <h2 className="text-base font-semibold tracking-tight mb-0.5">Streak belajar</h2>
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
        </section>
      </div>

      {/* Sesi hari ini */}
      <section className="lg:col-start-1 lg:row-start-2 lg:self-start">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Sesi hari ini</h2>
        {nextContentLoading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3" aria-label="Memuat latihan" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-[124px] animate-pulse rounded-2xl border border-border/60 bg-card/60 lg:h-72" />
            ))}
          </div>
        ) : (
        <>
        {nextContentError && <p className="mb-3 text-xs text-muted-foreground">Sebagian latihan gagal dimuat. Coba segarkan halaman.</p>}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:flex lg:snap-x lg:snap-mandatory lg:overflow-x-auto lg:pb-3">
          <div className="min-w-0 lg:w-[calc(33.333%_-_0.667rem)] lg:flex-none lg:snap-start">
            <DashboardImageCard
              href={nextModule ? "/dashboard/modul" : undefined}
              image="/image-c.jpg"
              category="Modul"
              title={nextModule?.title ?? "Tidak ada modul aktif"}
              description={nextModule ? "Lanjutan jalur kamu · bagian pertama dari modul" : "Belum ada modul yang perlu dilanjutkan saat ini."}
              icon={FolderOpen}
              tone="primary"
              unavailableText="Tidak ada modul"
              compact
            />
          </div>
          <div className="min-w-0 lg:w-[calc(33.333%_-_0.667rem)] lg:flex-none lg:snap-start">
            <DashboardImageCard
              href={sessionDeck ? `/dashboard/flashcard/${sessionDeck.id}` : undefined}
              image="/image-e.jpg"
              category="Flashcard"
              title={sessionDeck?.title ?? (deckQuotaMet ? "Target flashcard selesai" : "Flashcard belum tersedia")}
              description={sessionDeck
                ? `Flashcard & quiz · HSK ${sessionDeck.hsk_level}`
                : deckQuotaMet
                  ? "Target flashcard hari ini sudah terpenuhi."
                  : "Belum ada deck flashcard yang bisa dikerjakan saat ini."}
              icon={Languages}
              tone="amber"
              unavailableText={deckQuotaMet ? "Selesai hari ini" : "Belum tersedia"}
              compact
            />
          </div>
          <div className="min-w-0 lg:w-[calc(33.333%_-_0.667rem)] lg:flex-none lg:snap-start">
            <DashboardImageCard
              href={activeSrsDue > 0 ? `/dashboard/review?hsk=${activeSrsLevel}` : undefined}
              image="/image-d.jpg"
              category="Review"
              title={activeSrsDue > 0 ? `Review ${activeSrsDue} Kosakata` : "Belum ada review"}
              description={activeSrsDue > 0
                ? "Kosakata siap direview · Perkuat memori jangka panjang"
                : "Belum ada kosakata yang perlu ditinjau hari ini."}
              icon={SquareStack}
              tone="blue"
              unavailableText="Tidak ada review"
              compact
            />
          </div>
          <div className="min-w-0 lg:w-[calc(33.333%_-_0.667rem)] lg:flex-none lg:snap-start">
            <DashboardImageCard
              href={nextEstafet ? `/dashboard/flashcard/cumulative/${nextEstafet.key}` : undefined}
              image="/image-a.jpg"
              category="Estafet"
              title={nextEstafet?.title ?? "Belum ada bacaan berikutnya"}
              description={nextEstafet
                ? "Baca kalimat berurutan untuk melatih pemahaman"
                : "Selesaikan syarat belajar sebelumnya untuk membuka bacaan berikutnya."}
              icon={BookText}
              tone="violet"
              unavailableText="Belum tersedia"
              compact
            />
          </div>
        </div>
        <section aria-labelledby="learning-tools-title" className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="learning-tools-title" className="text-lg font-semibold tracking-tight">
              Alat belajar
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              { title: "Cari Kosakata", href: "/dashboard/flashcard?tab=search", icon: Search },
              { title: "Baca Hanzi", href: "/dashboard/cerita", icon: BookMarked },
              { title: "Tulis Hanzi", href: "/dashboard/tulis-hanzi", icon: PenLine },
              { title: "Peta Hanzi", href: "/dashboard/peta-hanzi", icon: Network },
              { title: "Dialog Percakapan", upcoming: true, icon: MessageCircle },
              { title: "Mini Games", href: "/dashboard/games", icon: Gamepad2 },
            ].map(({ title, href, icon: Icon, upcoming }) => {
              const content = (
                <>
                  {upcoming && (
                    <span className="absolute right-2 top-2 rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Segera hadir
                    </span>
                  )}
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted/70 text-primary">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="line-clamp-2 text-sm font-medium leading-tight text-foreground">{title}</span>
                </>
              )

              const className = `relative flex min-h-[132px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-border/60 bg-card/50 px-2 py-4 text-center transition-colors ${upcoming ? "cursor-not-allowed opacity-65" : "hover:border-primary/50 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"}`

              return href ? (
                <Link key={title} href={href} data-bottom-accent="off" className={className}>
                  {content}
                </Link>
              ) : (
                <div key={title} aria-disabled="true" className={className}>
                  {content}
                </div>
              )
            })}
          </div>
        </section>
        </>
        )}
      </section>

      {/* Grid Bawah: Review Kosakata (SRS Stats) & Aktivitas Terbaru */}
      <div className="grid gap-6 lg:col-start-2 lg:row-start-2 lg:grid-cols-1 lg:self-start">
        {/* Review Kosakata (SRS) — new design */}
        <Card className="border-border/30 bg-card/40 backdrop-blur-md shadow-sm gap-0">
          {(() => {
            const activeLevel = activeSrsLevel

            return (
              <>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-500">
                        <SquareStack className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold tracking-tight">Kosakata HSK</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Kondisi hafalanmu<span className="hidden sm:inline"> di level yang sedang dipelajari</span>
                        </p>
                      </div>
                    </div>

                    {/* HSK Filter Pill Dropdown */}
                    {srsStats?.hskLevels && srsStats.hskLevels.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border/60 bg-muted/40 hover:bg-muted/70 text-xs font-semibold text-foreground transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0">
                          <span>HSK {activeLevel}</span>
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <div className="mx-6 h-px bg-border/50" />
                <CardContent className="pt-3">
                  {srsStats ? (() => {
                    const activeData = activeSrsData ?? srsStats

                    const { mudah, ingat, sulit, lupa, notStarted, totalCards, due } = activeData
                    const reviewed = mudah + ingat + sulit + lupa
                    const pctDikuasai = totalCards > 0 ? Math.round(((mudah + ingat) / totalCards) * 100) : 0
                    const countToReview = due ?? 0

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
                      <div className={countToReview === 0 && reviewed > 0
                        ? "flex min-h-56 flex-col justify-center gap-4"
                        : "space-y-4"}>
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
                            <p className="text-xs text-muted-foreground text-center pt-1">
                              {mudah + ingat} dari {totalCards} kosakata dikuasai
                            </p>
                          </div>
                        </div>

                        {/* CTA */}
                        {countToReview > 0 ? (
                          <Button
                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-full h-11 text-sm transition-all cursor-pointer"
                            onClick={() => router.push(`/dashboard/review?hsk=${activeSrsLevel}`)}
                          >
                            Review Kosakata · {countToReview} kata
                          </Button>
                        ) : reviewed === 0 && lupa === 0 ? (
                          <Button
                            variant="outline"
                            className="w-full rounded-full h-11 text-sm"
                            onClick={() => router.push('/dashboard/flashcard')}
                          >
                            Mulai belajar kosakata
                          </Button>
                        ) : null}
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
                <h2 className="text-base font-semibold tracking-tight">Aktivitas Terbaru</h2>
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
    </div>
  )
}
