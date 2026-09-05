"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BarChart3, Users, Activity, TrendingUp } from "lucide-react"

export default function AdminAnalyticsPage() {
  const router = useRouter()

  const analyticsStats = [
    { label: "Total Users", value: "0", icon: Users, color: "text-blue-500", change: "+0%" },
    { label: "Active Today", value: "0", icon: Activity, color: "text-emerald-500", change: "+0%" },
    { label: "Total Sessions", value: "0", icon: BarChart3, color: "text-violet-500", change: "+0%" },
    { label: "Growth Rate", value: "0%", icon: TrendingUp, color: "text-orange-500", change: "+0%" },
  ]

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">Statistik dan analitik sistem</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {analyticsStats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border-muted/50">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-muted">
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                  <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{stat.change}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">User Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              Chart akan ditampilkan di sini
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activity Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              Chart akan ditampilkan di sini
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Informasi</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Fitur analytics akan dikembangkan lebih lanjut dengan integrasi 
            chart library untuk visualisasi data yang lebih detail.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
