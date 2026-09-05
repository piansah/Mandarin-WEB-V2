"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Flame, BookOpen, Target, Clock, TrendingUp, Star,
  CheckCircle2, Brain, Award, BarChart3, Calendar,
  Trophy, Zap, AlertCircle
} from "lucide-react"
import { fetchStatsData, type StatsData } from "@/lib/stats-library"

// ─── Komponen ─────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <Card className="border-muted/50">
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {sub && <span className="text-xs text-muted-foreground mt-0.5">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function StatistikPage() {
  const [data, setData] = React.useState<StatsData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadData() {
      try {
        const statsData = await fetchStatsData()
        setData(statsData)
      } catch (error) {
        console.error("Failed to load stats:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col p-6 gap-8 text-foreground">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col p-6 gap-8 text-foreground">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Gagal memuat data statistik</p>
        </div>
      </div>
    )
  }

  const maxMinutes = Math.max(...data.weeklyActivity.map((d) => d.minutes), 1)
  const totalWeeklyMinutes = data.weeklyActivity.reduce((sum, d) => sum + d.minutes, 0)
  const totalWeeklyWords = data.weeklyActivity.reduce((sum, d) => sum + d.words, 0)
  const avgAccuracy = data.accuracyData.length > 0
    ? Math.round(data.accuracyData.reduce((sum, item) => sum + item.value, 0) / data.accuracyData.length)
    : 0

  const totalHours = Math.floor(data.totalStudyMinutes / 60)
  const totalMins = data.totalStudyMinutes % 60
  const monthlyHours = Math.floor(data.monthlyStudyMinutes / 60)
  const monthlyMins = data.monthlyStudyMinutes % 60

  return (
    <div className="flex flex-col p-6 gap-8 text-foreground">

      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Statistik</h1>
        </div>
        <p className="text-sm text-muted-foreground">Pantau perkembangan belajar Mandarin kamu</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Flame} label="Streak Saat Ini" value={`${data.streak} hari`} sub={`Rekor: ${data.bestStreak} hari`} color="bg-orange-500" />
        <StatCard icon={Brain} label="Kata Dipelajari" value={data.totalWordsLearned.toString()} sub="Kata unik" color="bg-violet-500" />
        <StatCard icon={Target} label="Akurasi Rata-rata" value={`${avgAccuracy}%`} sub="Dari semua sesi" color="bg-emerald-500" />
        <StatCard icon={Clock} label="Total Belajar" value={`${totalHours}j ${totalMins}m`} sub={`Bulan ini: ${monthlyHours}j ${monthlyMins}m`} color="bg-blue-500" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Aktivitas Mingguan (Bar Chart) */}
        <Card className="lg:col-span-2 border-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Aktivitas 7 Hari Terakhir
            </CardTitle>
            <p className="text-xs text-muted-foreground">Menit belajar per hari</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-40 mt-2">
              {data.weeklyActivity.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[10px] text-muted-foreground">{d.minutes}m</span>
                  <div className="w-full rounded-t-md bg-primary/15 relative overflow-hidden" style={{ height: `${(d.minutes / maxMinutes) * 100}%`, minHeight: 4 }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-md transition-all"
                      style={{ height: "100%" }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{d.day}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-6 mt-4 pt-4 border-t text-sm text-muted-foreground">
              <span>Total minggu ini: <strong className="text-foreground">{totalWeeklyMinutes} mnt</strong></span>
              <span>Kata baru: <strong className="text-foreground">{totalWeeklyWords}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Akurasi per Kategori */}
        <Card className="border-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Akurasi per Fitur
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-2">
            {data.accuracyData.length > 0 ? (
              data.accuracyData.map((item) => (
                <div key={item.label} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-bold">{item.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada data akurasi</p>
            )}
          </CardContent>
        </Card>

        {/* Progress per Level HSK */}
        <Card className="lg:col-span-2 border-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Progress Kosakata per Level
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-2">
            {data.hskProgress.map((lvl) => {
              const pct = lvl.total > 0 ? Math.round((lvl.learned / lvl.total) * 100) : 0
              return (
                <div key={lvl.level} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-12 shrink-0">{lvl.level}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${lvl.color} transition-all`}
                      style={{ width: `${pct}%`, minWidth: pct > 0 ? 6 : 0 }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
                    {lvl.learned} / {lvl.total} kata
                  </span>
                  <span className="text-xs font-bold w-10 text-right shrink-0">{pct}%</span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Pencapaian */}
        <Card className="border-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" /> Pencapaian
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-2">
            {data.achievements.map((a) => {
              const Icon = a.done ? CheckCircle2 : Zap
              return (
                <div key={a.label} className={`flex items-center gap-3 ${!a.done ? "opacity-40" : ""}`}>
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{a.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight truncate">{a.desc}</p>
                  </div>
                  {a.done && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Kosakata Perlu Perhatian */}
        <Card className="lg:col-span-3 border-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" /> Kosakata Perlu Perhatian
            </CardTitle>
            <p className="text-xs text-muted-foreground">Kata-kata yang sering salah saat sesi flashcard atau kuis</p>
          </CardHeader>
          <CardContent className="pt-2">
            {data.difficultWords.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.difficultWords.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-lg font-bold">{item.word}</span>
                      <span className="text-xs text-muted-foreground">{item.pinyin} • {item.meaning}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase font-bold text-destructive/80">Akurasi</span>
                      <span className="text-sm font-bold text-destructive">{item.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada kata yang perlu perhatian khusus</p>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Footer note */}
      <p className="text-xs text-center text-muted-foreground/50 -mt-4">
        Data statistik diperbarui secara otomatis setiap kamu menyelesaikan sesi belajar.
      </p>

    </div>
  )
}
