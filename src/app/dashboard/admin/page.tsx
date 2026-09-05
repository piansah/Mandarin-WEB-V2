"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Users, Database, Settings, BarChart3, Shield,
  TrendingUp, Activity, CheckCircle2, AlertCircle
} from "lucide-react"
import { isAdmin, getAdminStats } from "@/lib/auth-roles"

export default function AdminDashboardPage() {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = React.useState<boolean | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [stats, setStats] = React.useState({
    totalUsers: 0,
    activeToday: 0,
    adminUsers: 0
  })

  React.useEffect(() => {
    async function loadData() {
      try {
        const [adminStatus, adminStats] = await Promise.all([
          isAdmin(),
          getAdminStats()
        ])
        setIsAuthorized(adminStatus)
        setStats(adminStats)
      } catch (error) {
        console.error("Error loading data:", error)
        setIsAuthorized(false)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Akses Ditolak</h1>
        <p className="text-muted-foreground">Anda tidak memiliki izin untuk mengakses halaman admin</p>
        <Button onClick={() => router.push("/dashboard")}>Kembali ke Dashboard</Button>
      </div>
    )
  }

  const adminMenu = [
    {
      title: "User Management",
      description: "Kelola user dan role",
      icon: Users,
      href: "/dashboard/admin/users",
      color: "bg-blue-500",
    },
    {
      title: "Database Management",
      description: "Kelola data dan konten",
      icon: Database,
      href: "/dashboard/admin/database",
      color: "bg-emerald-500",
    },
    {
      title: "Settings",
      description: "Pengaturan sistem",
      icon: Settings,
      href: "/dashboard/admin/settings",
      color: "bg-violet-500",
    },
    {
      title: "Analytics",
      description: "Statistik dan analitik",
      icon: BarChart3,
      href: "/dashboard/admin/analytics",
      color: "bg-orange-500",
    },
  ]

  const quickStats = [
    { label: "Total Users", value: stats.totalUsers?.toString() || "0", icon: Users, color: "text-blue-500" },
    { label: "Active Today", value: stats.activeToday?.toString() || "0", icon: Activity, color: "text-emerald-500" },
    { label: "Admin Users", value: stats.adminUsers?.toString() || "0", icon: Shield, color: "text-violet-500" },
    { label: "System Status", value: "Online", icon: CheckCircle2, color: "text-green-500" },
  ]

  return (
    <div className="flex flex-col p-6 gap-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">Kelola sistem dan pengguna</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border-muted/50">
              <CardContent className="p-5 flex items-start gap-4">
                <div className={`p-2.5 rounded-xl bg-muted`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                  <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Admin Menu */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {adminMenu.map((item) => {
          const Icon = item.icon
          return (
            <Card
              key={item.title}
              className="border-muted/50 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => router.push(item.href)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${item.color}`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Activity */}
      <Card className="border-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Aktivitas Terbaru
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Belum ada aktivitas terbaru</p>
        </CardContent>
      </Card>
    </div>
  )
}
