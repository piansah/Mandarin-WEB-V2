"use client"

import * as React from "react"
import { ClipboardList } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SimulasiHskPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Simulasi Ujian HSK</h1>
          <p className="text-sm text-muted-foreground">Segera hadir - Simulasi ujian HSK yang realistis</p>
        </div>
      </div>

      {/* Placeholder Content */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Fitur Segera Hadir</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Simulasi ujian HSK sedang dalam pengembangan. Fitur ini akan memungkinkan Anda:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Mengikuti simulasi ujian HSK yang realistis</li>
              <li>Mengukur kemampuan Anda dengan standar HSK resmi</li>
              <li>Mendapatkan rekomendasi belajar berdasarkan hasil simulasi</li>
              <li>Melacak progres kemampuan HSK Anda dari waktu ke waktu</li>
            </ul>
            <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border/40">
              <p className="text-sm font-medium text-muted-foreground">
                🔨 Sedang dalam pengembangan - Fitur ini akan segera tersedia!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
