"use client"

import * as React from "react"
import {
  Flame,
  Trophy,
  BookOpen,
  Layers,
  Zap,
  Target,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DashboardThemeToggle } from "@/components/dashboard-theme-toggle"
import { fetchDashboardStats, type DashboardStats } from "@/lib/dashboard-stats"

export default function DashboardPage() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetchDashboardStats().then((s) => {
      setStats(s)
      setLoading(false)
    })
  }, [])

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
      label: "Lanjutkan Flashcard",
      desc: stats.flashcardDue > 0 ? `${stats.flashcardDue} kartu menunggu` : "Tidak ada kartu jatuh tempo",
      href: "/dashboard/flashcard",
      color: "bg-primary/10 text-primary",
      icon: Layers,
    },
    {
      label: "Latihan Kalimat",
      desc: "Quiz Kalimat Harian",
      href: "/dashboard/quiz",
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      icon: Zap,
    },
    {
      label: "Belajar Hanzi",
      desc: "Jelajahi karakter baru",
      href: "/dashboard/hanzi",
      color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      icon: BookOpen,
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Greeting */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{greeting} 👋</p>
          <DashboardThemeToggle />
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

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.streak}</div>
            <p className="text-xs text-muted-foreground mt-1">hari berturut-turut 🔥</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Skor</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalScore.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">poin terkumpul</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kosakata</CardTitle>
            <BookOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.wordsMastered}</div>
            <p className="text-xs text-muted-foreground mt-1">kata dihafal</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quiz</CardTitle>
            <Target className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.quizCompleted}</div>
            <p className="text-xs text-muted-foreground mt-1">quiz diselesaikan</p>
          </CardContent>
        </Card>
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
