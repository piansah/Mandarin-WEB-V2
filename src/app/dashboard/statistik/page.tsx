"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Flame, BookOpen, Target, Clock, TrendingUp, Star,
  CheckCircle2, Brain, Award, BarChart3, Calendar,
  Trophy, Zap, AlertCircle
} from "lucide-react"

// ─── Dummy Data ───────────────────────────────────────────────
const weeklyActivity = [
  { day: "Sen", minutes: 25, words: 12 },
  { day: "Sel", minutes: 40, words: 20 },
  { day: "Rab", minutes: 15, words: 8 },
  { day: "Kam", minutes: 55, words: 30 },
  { day: "Jum", minutes: 30, words: 15 },
  { day: "Sab", minutes: 60, words: 35 },
  { day: "Min", minutes: 10, words: 5 },
]

const hskProgress = [
  { level: "HSK 1", total: 150, learned: 132, color: "bg-emerald-500" },
  { level: "HSK 2", total: 150, learned: 64, color: "bg-blue-500" },
  { level: "HSK 3", total: 300, learned: 18, color: "bg-violet-500" },
  { level: "HSK 4", total: 600, learned: 0, color: "bg-orange-500" },
  { level: "HSK 5", total: 1300, learned: 0, color: "bg-rose-500" },
  { level: "HSK 6", total: 2500, learned: 0, color: "bg-yellow-500" },
]

const difficultWords = [
  { word: "知道", pinyin: "zhīdào", meaning: "tahu, mengetahui", accuracy: 45 },
  { word: "觉得", pinyin: "juéde", meaning: "merasa, berpikir", accuracy: 52 },
  { word: "告诉", pinyin: "gàosu", meaning: "memberitahu", accuracy: 58 },
  { word: "因为", pinyin: "yīnwèi", meaning: "karena", accuracy: 60 },
  { word: "所以", pinyin: "suǒyǐ", meaning: "jadi, oleh karena itu", accuracy: 65 },
]

const achievements = [
  { icon: Flame, label: "Streak 7 Hari", desc: "Belajar 7 hari berturut-turut", done: true },
  { icon: BookOpen, label: "100 Kata Pertama", desc: "Pelajari 100 kata unik", done: true },
  { icon: CheckCircle2, label: "Modul Pertama", desc: "Selesaikan 1 modul belajar", done: true },
  { icon: Zap, label: "Streak 30 Hari", desc: "Belajar 30 hari berturut-turut", done: false },
  { icon: Trophy, label: "HSK 1 Tuntas", desc: "Kuasai seluruh kosakata HSK 1", done: false },
]

const accuracyData = [
  { label: "Flashcard", value: 84, color: "bg-emerald-500" },
  { label: "Kuis Modul", value: 90, color: "bg-blue-500" },
  { label: "Grammar", value: 72, color: "bg-violet-500" },
  { label: "Estafet", value: 68, color: "bg-orange-500" },
]

const maxMinutes = Math.max(...weeklyActivity.map((d) => d.minutes))

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
        <StatCard icon={Flame} label="Streak Saat Ini" value="7 hari" sub="Rekor: 12 hari" color="bg-orange-500" />
        <StatCard icon={Brain} label="Kata Dipelajari" value="214" sub="Dari total 4.000 kata" color="bg-violet-500" />
        <StatCard icon={Target} label="Akurasi Rata-rata" value="82%" sub="Dari semua sesi" color="bg-emerald-500" />
        <StatCard icon={Clock} label="Total Belajar" value="14j 32m" sub="Bulan ini: 3j 10m" color="bg-blue-500" />
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
              {weeklyActivity.map((d) => (
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
              <span>Total minggu ini: <strong className="text-foreground">235 mnt</strong></span>
              <span>Kata baru: <strong className="text-foreground">125</strong></span>
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
            {accuracyData.map((item) => (
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
            ))}
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
            {hskProgress.map((lvl) => {
              const pct = Math.round((lvl.learned / lvl.total) * 100)
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
            {achievements.map((a) => {
              const Icon = a.icon
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {difficultWords.map((item, i) => (
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
