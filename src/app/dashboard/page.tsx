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
  Play,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { fetchDashboardStats, type DashboardStats } from "@/lib/dashboard-stats"
import { useSupabase } from "@/hooks/use-supabase"

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
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [srsStats, setSrsStats] = React.useState<SrsStats | null>(null)
  const [sessionActive, setSessionActive] = React.useState(false)

  React.useEffect(() => {
    fetchDashboardStats().then((s) => {
      setStats(s)
      setLoading(false)
    })
    loadSrsStats()
  }, [])

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
  const greeting = hour < 12 ? "Selamat Pagi" : hour < 17 ? "Selamat Siang" : "Selamat Malam"

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

  const quickAccess = [
    {
      label: "Daftar Kata",
      desc: "Flashcard, quiz, nada & tulis per deck",
      href: "/dashboard/flashcard",
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      icon: Languages,
    },
    {
      label: "Estafet",
      desc: "Baca kalimat berurutan untuk melatih pemahaman",
      href: "/dashboard/flashcard/cumulative",
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      icon: Layers,
    },
    {
      label: "Simulasi Ujian HSK",
      desc: "Segera hadir - placeholder",
      href: "/dashboard/simulasi-hsk",
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      icon: ClipboardList,
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Greeting */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{greeting} 👋</p>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{stats.displayName}</h1>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
            {stats.tierLabel}
          </Badge>
          <Badge variant="outline" className="border-muted-foreground/30">
            {stats.tierHsk}
          </Badge>
        </div>
      </div>

      {/* Streak Widget Mingguan & Quick Access */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Streak Widget */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden relative lg:col-span-2">
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
                  className={`flex flex-col items-center justify-center rounded-lg p-3 transition-colors ${
                    dot.isToday
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : dot.active
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-muted/30 text-muted-foreground border border-border/30"
                  }`}
                >
                  <div className="text-sm font-bold mb-1.5">
                    {dot.isToday ? "•" : dot.active ? "✓" : "-"}
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

        {/* Quick Access */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm h-full flex flex-col lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Akses Cepat</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 flex-1">
            {quickAccess.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-border/50 p-3 hover:bg-muted/50 transition-colors group flex-1"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <span className="text-muted-foreground text-xs group-hover:translate-x-1 transition-transform">→</span>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Review Section */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Review Kosakata (SRS)</CardTitle>
        </CardHeader>
        <CardContent>
          {srsStats ? (
            <div className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-foreground">{srsStats.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-2xl font-bold text-emerald-500">{srsStats.mature}</div>
                  <div className="text-xs text-muted-foreground">Hafal</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
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

              {/* Due Cards CTA */}
              {srsStats.due > 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-amber-500/20">
                      <RotateCcw className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">
                        {srsStats.due} kartu siap direview
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Review sekarang agar tidak lupa
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                    onClick={() => window.location.href = '/dashboard/review'}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Mulai Review ({srsStats.due} kartu)
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center py-4 gap-3 text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-sm">
                    {srsStats.totalToday > 0
                      ? "Sesi hari ini selesai!"
                      : "Tidak ada kartu yang harus direview"}
                  </span>
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

      {/* Sesi Hari Ini Section */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Sesi Hari Ini</CardTitle>
        </CardHeader>
        <CardContent>
          {!sessionActive ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Lanjutkan pembelajaran dengan modul yang tersedia hari ini.
              </p>
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                onClick={() => setSessionActive(true)}
              >
                <Play className="h-4 w-4 mr-2" />
                Mulai Sesi
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Modul Card */}
              <a
                href="/dashboard/modul"
                className="block"
              >
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:border-primary/50 hover:bg-muted/30 transition-all">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderOpen className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Modul Pembelajaran</h3>
                    <p className="text-sm text-muted-foreground">Pelajari materi baru dengan kurikulum terstruktur</p>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">~15 menit</span>
                  </div>
                </div>
              </a>

              {/* Daftar Kata Card */}
              <a
                href="/dashboard/flashcard"
                className="block"
              >
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:border-primary/50 hover:bg-muted/30 transition-all">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Languages className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Daftar Kata</h3>
                    <p className="text-sm text-muted-foreground">Flashcard, quiz, nada & tulis per deck</p>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">~20 menit</span>
                  </div>
                </div>
              </a>

              {/* Estafet Card */}
              <a
                href="/dashboard/flashcard/cumulative"
                className="block"
              >
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:border-primary/50 hover:bg-muted/30 transition-all">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <BookText className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Estafet</h3>
                    <p className="text-sm text-muted-foreground">Baca kalimat berurutan untuk melatih pemahaman</p>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">~10 menit</span>
                  </div>
                </div>
              </a>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSessionActive(false)}
              >
                Tutup
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aktivitas Terbaru */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Aktivitas Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Belum ada aktivitas.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.recentActivity.map((act, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {act.score}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{act.typeLabel}</p>
                    <p className="text-xs text-muted-foreground">{act.key} · {act.timeAgo}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {act.typeLabel}
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
