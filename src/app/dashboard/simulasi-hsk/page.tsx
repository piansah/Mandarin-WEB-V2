"use client"

import * as React from "react"
import { ClipboardList, FlaskConical, CheckCircle, BookOpen, BarChart3, BrainCircuit } from "lucide-react"

export default function SimulasiHskPage() {
  const features = [
    {
      icon: BookOpen,
      title: "Soal Standar HSK",
      desc: "Mengikuti format ujian HSK resmi dengan soal mendengarkan, membaca, dan menulis.",
    },
    {
      icon: BarChart3,
      title: "Analisis Hasil",
      desc: "Mendapatkan laporan detail kemampuan per aspek setelah mengerjakan simulasi.",
    },
    {
      icon: BrainCircuit,
      title: "Rekomendasi Belajar",
      desc: "Sistem merekomendasikan materi berdasarkan hasil dan kelemahan kamu.",
    },
    {
      icon: CheckCircle,
      title: "Progres Terlacak",
      desc: "Pantau perkembangan kemampuan HSK kamu dari waktu ke waktu.",
    },
  ]

  return (
    <div className="flex flex-col gap-8 p-6">

      {/* Banner Konsep */}
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3.5">
        <FlaskConical className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-400 mb-0.5">Masih dalam konsep</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Fitur Simulasi Ujian HSK ini masih belum tersedia. Fitur ini memerlukan konten soal yang terstandar, yang saat ini belum bisa disiapkan oleh developer. Terima kasih atas pengertiannya!
          </p>
        </div>
      </div>

      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <ClipboardList className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Simulasi Ujian HSK</h1>
          <p className="text-sm text-muted-foreground">Uji kemampuan Mandarin kamu sesuai standar HSK resmi</p>
        </div>
      </div>

      {/* Coming Soon Visual */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-emerald-500/10 via-primary/5 to-transparent p-10 text-center">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="text-7xl mb-5">📋</div>
          <h2 className="text-2xl font-bold mb-2">Segera Hadir</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Fitur ini sedang dalam tahap konsep dan perencanaan. Nantikan hadirnya simulasi ujian HSK yang realistis di JOURNEY!
          </p>
        </div>
      </div>

      {/* Feature Cards */}
      <div>
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Yang Akan Hadir</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-3 p-4 rounded-2xl border border-border/50 bg-card/50">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <f.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-sm mb-0.5">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
