"use client"

import * as React from "react"
import {
  Layers,
  RotateCcw,
  CheckCircle2,
  BookOpen,
  Languages,
  Flame,
  ClipboardList,
  FolderOpen,
  BookText,
  Brain,
  Zap,
  Clock,
  Play,
  RefreshCw,
  Sun,
  Moon,
  Sunrise,
  Sunset,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { fetchDashboardStats, type DashboardStats } from "@/lib/dashboard-stats"
import { fetchModulOverview } from "@/lib/modul"
import { useSupabase } from "@/hooks/use-supabase"
import { useRouter } from "next/navigation"

type SrsStats = {
  total: number
  mature: number
  due: number
  hafalToday: number
  lupaToday: number
  pctToday: number
  totalToday: number
}

export default function DashboardPage() {
  const supa = useSupabase()
  const router = useRouter()
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [srsStats, setSrsStats] = React.useState<SrsStats | null>(null)
  const [nextDeck, setNextDeck] = React.useState<{ id: number; title: string; hsk_level: number } | null>(null)
  const [nextModule, setNextModule] = React.useState<{ slug: string; title: string } | null>(null)
  const [nextEstafet, setNextEstafet] = React.useState<{ key: string; title: string } | null>(null)
  const [completedDeckCount, setCompletedDeckCount] = React.useState(0)
  const [deckQuotaMet, setDeckQuotaMet] = React.useState(false)
  const [showStreakAnim, setShowStreakAnim] = React.useState(false)

  React.useEffect(() => {
    fetchDashboardStats().then((s) => {
      setStats(s)
      setLoading(false)
    })
    loadSrsStats()
    loadNextContent()

    if (typeof window !== "undefined") {
      if (sessionStorage.getItem("playStreakAnim") === "true") {
        setShowStreakAnim(true)
        sessionStorage.removeItem("playStreakAnim")
        setTimeout(() => setShowStreakAnim(false), 3500)
      }
    }
  }, [supa])

  async function loadNextContent() {
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

      // Cek apakah user sudah menyelesaikan setidaknya 1 deck HARI INI (dinilai dari Quiz, bukan sekadar Flashcard)
      const todayStr = new Date().toISOString().slice(0, 10)
      const { data: quizToday } = await supa
        .from("user_scores")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "quiz")
        .gte("updated_at", todayStr)
        .limit(1)

      if (quizToday && quizToday.length > 0) {
        hasCompletedDeckToday = true
      }

      if (decks && decks.length > 0) {
        let firstIncompleteDeck = null
        
        // Find first incomplete deck
        for (const deck of decks) {
          // Get all card IDs for this deck
          const { data: deckCards } = await supa
            .from("flashcard_cards")
            .select("id")
            .eq("set_id", deck.id)

          if (!deckCards || deckCards.length === 0) {
            firstIncompleteDeck = deck
            break
          }

          const cardIds = deckCards.map(c => c.id)

          // Get progress for these cards
          const { data: progress } = await supa
            .from("user_card_progress")
            .select("card_id, srs_level")
            .eq("user_id", user.id)
            .in("card_id", cardIds)

          if (!progress || progress.length === 0) {
            firstIncompleteDeck = deck
            break
          }

          // Check if deck is complete (all cards have srs_level >= 1)
          const completedCards = progress.filter(p => p.srs_level >= 1).length
          if (completedCards < deckCards.length) {
            firstIncompleteDeck = deck
            break
          }

          // Count completed decks
          completedDeckCount++
        }

        // Terapkan aturan 1 hari 1 deck
        if (hasCompletedDeckToday) {
          setDeckQuotaMet(true)
          setNextDeck(null)
        } else if (firstIncompleteDeck) {
          setNextDeck(firstIncompleteDeck)
        } else {
          setNextDeck(null)
        }
      }

      setCompletedDeckCount(completedDeckCount)

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
        // Get read counts for all estafet sets
        const readCounts: Record<string, number> = {}
        const itemCounts: Record<string, number> = {}

        for (const set of estafetSets) {
          const saved = window.localStorage.getItem(`hanzi_read_progress:${set.key}`)
          const completedIds = saved ? (JSON.parse(saved) as number[]) : []
          readCounts[set.key] = Array.isArray(completedIds) ? completedIds.length : 0

          const { data: items } = await supa
            .from("hanzi_items")
            .select("id")
            .eq("hanzi_key", set.key)

          itemCounts[set.key] = items?.length || 0
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
  }

  async function loadSrsStats() {
    try {
      const { data: { user } } = await supa.auth.getUser()
      if (!user) return

      const today = new Date().toISOString().slice(0, 10)

      const { data: progress } = await supa
        .from("user_card_progress")
        .select("card_id, srs_level, next_review, last_reviewed")
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

      const todayCards = reviewed.filter((r) => r.last_reviewed === today)
      const hafalToday = todayCards.filter((r) => r.srs_level >= 1).length
      const lupaToday = todayCards.filter((r) => r.srs_level === 0).length
      const totalToday = hafalToday + lupaToday
      const totalHafal = reviewed.filter((r) => r.srs_level >= 1).length
      const dueRows = reviewed.filter((r) => r.next_review <= today && r.card_id)

      let dueCount = dueRows.length
      if (dueRows.length > 0) {
        const validDueIds = new Set()
        const dueIds = dueRows.map((r) => r.card_id)
        for (let i = 0; i < dueIds.length; i += 100) {
          const chunk = dueIds.slice(i, i + 100)
          const result = await supa
            .from("flashcard_cards")
            .select("id")
            .in("id", chunk)
          if (result.data) {
            result.data.forEach((card: { id: string }) => validDueIds.add(card.id))
          }
        }
        dueCount = dueRows.filter((r) => validDueIds.has(r.card_id)).length
      }

      const pct = totalToday > 0 ? Math.round((hafalToday / totalToday) * 100) : 0

      setSrsStats({
        total,
        mature: totalHafal,
        due: dueCount,
        hafalToday,
        lupaToday,
        pctToday: pct,
        totalToday,
      })
    } catch (e) {
      console.error(e)
    }
  }

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

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Memuat dashboard...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Kamu belum login.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {showStreakAnim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes streak-pop {
              0% { transform: scale(0.3); opacity: 0; }
              50% { transform: scale(1.1); opacity: 1; }
              70% { transform: scale(0.9); }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes streak-fade {
              0% { opacity: 0; transform: translateY(20px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            .anim-streak-icon { animation: streak-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
            .anim-streak-text { animation: streak-fade 0.5s ease-out 0.3s forwards; opacity: 0; }
          `}} />
          <div className="flex flex-col items-center justify-center text-center p-8 rounded-3xl bg-card border border-amber-500/30 shadow-2xl shadow-amber-500/20">
            <Flame className="w-32 h-32 text-amber-500 fill-amber-500 anim-streak-icon drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
            <h2 className="text-3xl font-extrabold text-foreground mt-6 anim-streak-text">Streak Harian Terjaga!</h2>
            <p className="text-muted-foreground mt-2 anim-streak-text">Pertahankan terus semangat belajarmu 🔥</p>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flame-pop {
          0% { transform: scale(0.3) translateY(5px); opacity: 0; }
          60% { transform: scale(1.25) translateY(-2px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-flame-pop {
          animation: flame-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }
      `}} />
      {/* Header Greeting */}
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex items-center gap-2 font-medium text-muted-foreground mb-1">
          <GreetingIcon className="h-5 w-5" />
          <span>{greetingText}</span>
        </div>
        <h1 className="text-[clamp(12px,4vw,2.5rem)] font-extrabold tracking-tight uppercase whitespace-nowrap">
          <span className="text-foreground">HALO {stats.displayName}.</span>{" "}
          <span className="text-foreground/70">LANJUT BELAJAR MANDARIN?</span>
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
            {stats.tierLabel}
          </Badge>
          <Badge variant="outline" className="border-muted-foreground/30">
            {stats.tierHsk}
          </Badge>
        </div>
      </div>

      {/* Grid Atas: Streak & Review SRS (30/70) */}
      <div className="grid gap-6 lg:grid-cols-[4fr_6fr]">
        {/* Streak Widget */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden relative lg:col-span-1">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Flame className="w-32 h-32 text-primary" />
          </div>

          <CardContent className="p-6 relative z-10">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-primary">{stats.streak}</span>
                <span className="text-sm font-medium text-muted-foreground">Hari Beruntun!</span>
              </div>
              <Flame className="h-6 w-6 text-primary drop-shadow-md" />
            </div>

            <div className="grid grid-cols-7 gap-2 mb-6">
              {stats.weekDots.map((dot, i) => (
                <div
                  key={i}
                  className={`flex flex-col items-center justify-center rounded-lg p-3 transition-colors ${dot.isToday
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : dot.active
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-muted/30 text-muted-foreground border border-border/30"
                    }`}
                >
                  <div className="text-sm font-bold mb-1.5 flex items-center justify-center min-h-[20px]">
                    {dot.active ? (
                      <Flame 
                        className="w-4 h-4 fill-current animate-flame-pop" 
                        style={{ animationDelay: `${i * 75}ms` }} 
                      />
                    ) : dot.isToday ? (
                      "•"
                    ) : (
                      "-"
                    )}
                  </div>
                  <div className="text-[10px] font-medium uppercase tracking-wider">{dot.day}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center justify-center rounded-lg bg-muted/20 border border-border/40 p-4">
                <span className="text-xl font-bold text-primary">{stats.bestStreak}</span>
                <span className="text-xs text-muted-foreground mt-1">Streak terbaik</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg bg-muted/20 border border-border/40 p-4">
                <span className="text-xl font-bold text-primary">{stats.consistency}%</span>
                <span className="text-xs text-muted-foreground mt-1">Konsistensi</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Review Kosakata (SRS) - 60% */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-500">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Review Kosakata</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Biar nggak lupa!</p>
                </div>
              </div>
              {srsStats && srsStats.due > 0 && (
                <Button
                  size="sm"
                  className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg px-4"
                  onClick={() => window.location.href = '/dashboard/review'}
                >
                  Review
                </Button>
              )}
            </div>
          </CardHeader>
          <div className="mx-6 h-px bg-border/50 mb-4" />
          <CardContent>
            {srsStats ? (
              <div className="space-y-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center py-5 px-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-foreground">{srsStats.total}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center py-5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-2xl font-bold text-emerald-500">{srsStats.mature}</div>
                    <div className="text-xs text-muted-foreground">Hafal</div>
                  </div>
                  <div className="text-center py-5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="text-2xl font-bold text-amber-500">{srsStats.due}</div>
                    <div className="text-xs text-muted-foreground">Due</div>
                  </div>
                </div>

                {/* Today's Progress */}
                {srsStats.totalToday > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress Hari Ini</span>
                      <span className="font-medium">{srsStats.pctToday}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${srsStats.pctToday}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{srsStats.hafalToday} hafal hari ini</span>
                      <span>{srsStats.lupaToday} lupa hari ini</span>
                    </div>
                  </div>
                )}

                {/* Due Cards Info */}
                {srsStats.due > 0 && (
                  <div className="flex items-center justify-center gap-3 p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-center">
                    <RotateCcw className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">
                      {srsStats.due} kartu siap direview<br/>
                      <span className="text-muted-foreground text-xs mt-0.5 font-normal inline-block">klik tombol di atas untuk mulai</span>
                    </p>
                  </div>
                )}

              </div>
            ) : (
              <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
                <span className="text-sm">Memuat statistik...</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sesi Hari Ini - Full Width */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
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
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:border-primary/50 hover:bg-muted/30 transition-all">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderOpen className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base whitespace-nowrap tracking-tight">{nextModule.title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap tracking-tighter sm:tracking-normal">Lanjutan jalur kamu · bagian pertama dari modul</p>
                  </div>
                </div>
              </a>
            ) : (
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-muted/30">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                  <FolderOpen className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-muted-foreground text-sm sm:text-base whitespace-nowrap tracking-tight">Modul Pembelajaran</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap tracking-tighter sm:tracking-normal">Tidak ada modul tersedia saat ini</p>
                </div>
              </div>
            )}

            {/* Daftar Kata Card */}
            {nextDeck ? (
              <a href={`/dashboard/flashcard/${nextDeck.id}`} className="block">
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:border-primary/50 hover:bg-muted/30 transition-all">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Languages className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base whitespace-nowrap tracking-tight">{nextDeck.title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap tracking-tighter sm:tracking-normal">Flashcard, quiz, nada & tulis · HSK {nextDeck.hsk_level}</p>
                  </div>
                </div>
              </a>
            ) : (
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-emerald-500/10">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-emerald-700 dark:text-emerald-500 text-sm sm:text-base whitespace-nowrap tracking-tight">Daftar Kata</h3>
                  <p className="text-[10px] sm:text-xs text-emerald-600/80 dark:text-emerald-400/80 whitespace-nowrap tracking-tighter sm:tracking-normal">
                    {deckQuotaMet ? "Target harian selesai. Lanjut besok!" : "Semua deck sudah selesai"}
                  </p>
                </div>
              </div>
            )}

            {/* Estafet Card */}
            {nextEstafet ? (
              <a href={`/dashboard/flashcard/cumulative/${nextEstafet.key}`} className="block">
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:border-primary/50 hover:bg-muted/30 transition-all">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <BookText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base whitespace-nowrap tracking-tight">{nextEstafet.title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap tracking-tighter sm:tracking-normal">Baca kalimat berurutan untuk melatih pemahaman</p>
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
                : nextEstafet
                  ? `/dashboard/flashcard/cumulative/${nextEstafet.key}`
                  : null

            return (
              <div className="mt-8 space-y-5">
                <Button
                  className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-full h-14 gap-2 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!firstSessionUrl}
                  onClick={() => firstSessionUrl && router.push(firstSessionUrl)}
                >
                  <Play className="h-5 w-5 fill-current" /> Mulai sesi
                </Button>
                <div className="flex flex-col items-center gap-1.5 text-[10px] sm:text-xs tracking-tight sm:tracking-normal text-foreground/80 text-center overflow-hidden w-full">
                  <p className="whitespace-nowrap">
                    Bisa dilanjut kapan aja lewat menu Sesi Hari Ini
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


      {/* Aktivitas Terbaru */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
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
        <div className="mx-6 h-px bg-border/50 mb-4" />
        <CardContent>
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
                  className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    +{act.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{act.key}</p>
                    <p className="text-xs text-muted-foreground">{act.typeLabel} · {act.timeAgo}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {act.score} XP
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
