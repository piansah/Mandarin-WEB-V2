"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Users, Activity, TrendingUp, Award, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/browser"
import { isAdmin, getAllUsersWithRoles } from "@/lib/auth-roles"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts"

// ── Types ─────────────────────────────────────────────────────────────────────

type AnalyticsData = {
  totalUsers: number
  activeToday: number
  totalSessions: number
  growthRate: number
  userGrowthChart: { month: string; users: number }[]
  activityChart: { day: string; sessions: number }[]
  activityByType: { name: string; value: number }[]
  topUsers: { name: string; sessions: number }[]
}

// ── Helper ────────────────────────────────────────────────────────────────────

function dayLabel(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" })
}

function monthLabel(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" })
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  quiz: "Quiz",
  kal: "Kalimat",
  grammar: "Grammar",
  cerita: "Cerita",
  cerita_quiz: "Quiz Cerita",
  hanzi: "Hanzi",
  fc_session: "Flashcard",
  speaking_session: "Speaking",
  nada_session: "Nada",
  tulis_session: "Tulis",
}

const PIE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"]

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchAnalyticsData(): Promise<AnalyticsData> {
  const supa = createClient()

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]

  // 7 days back
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 6)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString()

  // 6 months back
  const sixMonthsAgo = new Date(today)
  sixMonthsAgo.setMonth(today.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  const sixMonthsAgoStr = sixMonthsAgo.toISOString()

  const [
    allUsers,
    activeTodayRes,
    totalSessionsRes,
    lastMonthSessionsRes,
    thisMonthSessionsRes,
    activityWeekRes,
    activityByTypeRes,
    userGrowthRes,
  ] = await Promise.all([
    // Total users — pakai logika yang sama dengan User Management
    getAllUsersWithRoles(),
    // Active today: daily_streaks entries for today
    supa.from("daily_streaks").select("user_id", { count: "exact", head: true }).eq("date", todayStr),
    // Total sessions ever
    supa.from("user_scores").select("id", { count: "exact", head: true }),
    // Last month sessions (for growth rate)
    supa
      .from("user_scores")
      .select("id", { count: "exact", head: true })
      .gte("updated_at", (() => { const d = new Date(); d.setMonth(d.getMonth() - 2); d.setDate(1); return d.toISOString() })())
      .lt("updated_at", (() => { const d = new Date(); d.setDate(1); return d.toISOString() })()),
    // This month sessions
    supa
      .from("user_scores")
      .select("id", { count: "exact", head: true })
      .gte("updated_at", (() => { const d = new Date(); d.setDate(1); return d.toISOString() })()),
    // Activity in last 7 days (for Bar chart)
    supa
      .from("user_scores")
      .select("updated_at")
      .gte("updated_at", sevenDaysAgoStr)
      .order("updated_at", { ascending: true }),
    // Activity breakdown by type (for Pie chart)
    supa
      .from("user_scores")
      .select("type"),
    // User growth: registrations per month (last 6 months)
    supa
      .from("user_profile")
      .select("created_at")
      .gte("created_at", sixMonthsAgoStr)
      .order("created_at", { ascending: true }),
  ])

  // ── Total Users ──────────────────────────────────────────────────────────
  const totalUsers = allUsers.length

  // ── Active Today ─────────────────────────────────────────────────────────
  const activeToday = activeTodayRes.count ?? 0

  // ── Total Sessions ────────────────────────────────────────────────────────
  const totalSessions = totalSessionsRes.count ?? 0

  // ── Growth Rate ───────────────────────────────────────────────────────────
  const lastMonth = lastMonthSessionsRes.count ?? 0
  const thisMonth = thisMonthSessionsRes.count ?? 0
  const growthRate = lastMonth === 0
    ? (thisMonth > 0 ? 100 : 0)
    : Math.round(((thisMonth - lastMonth) / lastMonth) * 100)

  // ── Activity Chart (last 7 days) ─────────────────────────────────────────
  const dayMap: Record<string, number> = {}
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo)
    d.setDate(sevenDaysAgo.getDate() + i)
    dayMap[d.toISOString().split("T")[0]] = 0
  }
  for (const row of (activityWeekRes.data ?? [])) {
    const day = (row.updated_at as string).split("T")[0]
    if (dayMap[day] !== undefined) dayMap[day]++
  }
  const activityChart = Object.entries(dayMap).map(([date, sessions]) => ({
    day: dayLabel(date),
    sessions,
  }))

  // ── Activity By Type (Pie chart) ──────────────────────────────────────────
  const typeMap: Record<string, number> = {}
  for (const row of (activityByTypeRes.data ?? [])) {
    const t = row.type as string
    typeMap[t] = (typeMap[t] ?? 0) + 1
  }
  const activityByType = Object.entries(typeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([type, value]) => ({ name: ACTIVITY_TYPE_LABELS[type] ?? type, value }))

  // ── User Growth Chart (last 6 months) ────────────────────────────────────
  const monthMap: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    d.setDate(1)
    monthMap[d.toISOString().slice(0, 7)] = 0
  }
  for (const row of (userGrowthRes.data ?? [])) {
    const m = (row.created_at as string).slice(0, 7)
    if (monthMap[m] !== undefined) monthMap[m]++
  }
  const userGrowthChart = Object.entries(monthMap).map(([ym, users]) => ({
    month: monthLabel(ym + "-01"),
    users,
  }))

  return {
    totalUsers,
    activeToday,
    totalSessions,
    growthRate,
    userGrowthChart,
    activityChart,
    activityByType,
    topUsers: [], // reserved for future
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [data, setData] = React.useState<AnalyticsData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [authorized, setAuthorized] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      const ok = await isAdmin()
      if (!ok) { setAuthorized(false); setLoading(false); return }
      try {
        const result = await fetchAnalyticsData()
        setData(result)
      } catch (err) {
        console.error("Analytics fetch error:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground text-sm">Akses ditolak. Hanya Admin yang dapat melihat halaman ini.</p>
      </div>
    )
  }

  const stats = [
    {
      label: "Total Users",
      value: loading ? "—" : String(data?.totalUsers ?? 0),
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      change: "Semua pengguna terdaftar",
    },
    {
      label: "Aktif Hari Ini",
      value: loading ? "—" : String(data?.activeToday ?? 0),
      icon: Activity,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      change: "Berdasarkan daily streak",
    },
    {
      label: "Total Sesi",
      value: loading ? "—" : String(data?.totalSessions ?? 0),
      icon: BarChart3,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      change: "Semua sesi latihan",
    },
    {
      label: "Growth Rate",
      value: loading ? "—" : `${(data?.growthRate ?? 0) > 0 ? "+" : ""}${data?.growthRate ?? 0}%`,
      icon: TrendingUp,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      change: "Sesi bulan ini vs lalu",
    },
  ]

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">Statistik dan analitik sistem secara real-time</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border-muted/50">
              <CardContent className="p-5 flex items-start gap-4">
                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                  <span className="text-2xl font-bold tracking-tight">
                    {loading ? (
                      <span className="inline-block h-7 w-12 animate-pulse rounded bg-muted" />
                    ) : stat.value}
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5">{stat.change}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth */}
        <Card className="border-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Pertumbuhan Pengguna (6 Bulan)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-52 flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={data?.userGrowthChart ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#888" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#1a1b2a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#aaa" }}
                  />
                  <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Pengguna Baru" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Activity Overview (last 7 days) */}
        <Card className="border-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              Sesi Aktivitas (7 Hari Terakhir)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-52 flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={data?.activityChart ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#888" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#1a1b2a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#aaa" }}
                  />
                  <Bar dataKey="sessions" fill="#10b981" radius={[4, 4, 0, 0]} name="Sesi" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity By Type Pie */}
      <Card className="border-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-violet-500" />
            Distribusi Tipe Aktivitas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-52 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (data?.activityByType.length ?? 0) === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
              Belum ada data aktivitas.
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data?.activityByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                  >
                    {(data?.activityByType ?? []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1a1b2a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ fontSize: 12, color: "#aaa" }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
