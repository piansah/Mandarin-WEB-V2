"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Settings, Save, RefreshCw } from "lucide-react"

export default function AdminSettingsPage() {
  const router = useRouter()

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground">Pengaturan sistem aplikasi</p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        <Card className="border-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div>
                <p className="font-medium">Maintenance Mode</p>
                <p className="text-sm text-muted-foreground">Nonaktifkan aplikasi untuk maintenance</p>
              </div>
              <Button size="sm" variant="outline">
                Toggle
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div>
                <p className="font-medium">Registration</p>
                <p className="text-sm text-muted-foreground">Izinkan pendaftaran user baru</p>
              </div>
              <Button size="sm" variant="outline">
                Toggle
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Email Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Kirim notifikasi email ke user</p>
              </div>
              <Button size="sm" variant="outline">
                Toggle
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">System Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div>
                <p className="font-medium">Clear Cache</p>
                <p className="text-sm text-muted-foreground">Hapus cache aplikasi</p>
              </div>
              <Button size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div>
                <p className="font-medium">Backup Database</p>
                <p className="text-sm text-muted-foreground">Buat backup database</p>
              </div>
              <Button size="sm" variant="outline">
                <Save className="h-4 w-4 mr-2" />
                Backup
              </Button>
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
            Fitur system settings akan dikembangkan lebih lanjut. 
            Untuk saat ini, Anda dapat mengelola pengaturan langsung melalui Supabase Dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
