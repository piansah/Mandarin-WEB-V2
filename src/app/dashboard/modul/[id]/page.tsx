"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Mic, Bookmark, ChevronRight, CheckCircle2, BookOpen, ArrowLeft, ArrowRight } from "lucide-react"

// Dummy data for parts
const MODULE_PARTS = [
  { id: 1, title: 'Nyapa itu nggak cuma "How are you?"', active: true },
  { id: 2, title: "Nanya kabar (dan rahasia jawabnya)", active: false },
  { id: 3, title: "Ngenalin diri", active: false },
  { id: 4, title: "Bilang asal & pekerjaan", active: false },
  { id: 5, title: "Cara pamit yang nggak canggung", active: false },
  { id: 6, title: "Latihan dikit yuk", active: false },
  { id: 7, title: "Coba cek, udah nyantol belum?", active: false },
]

export default function ModulDetailPage() {
  const params = useParams()
  // const moduleId = params.id 

  return (
    <div className="flex flex-col max-w-6xl mx-auto p-4 md:p-6 gap-8 text-foreground">
      
      {/* Top Bar: Breadcrumbs & Progress */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur pb-4 pt-4 md:pt-6 -mt-4 md:-mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm text-muted-foreground border-b mb-4">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap w-full sm:w-auto pb-2 sm:pb-0 hide-scrollbar">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Beranda</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <Link href="/dashboard/modul" className="hover:text-foreground transition-colors">Modul</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <span className="text-foreground font-medium">HSK 1</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span>Bagian 1/7</span>
          <Progress value={14} className="h-2 w-24 sm:w-32" />
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        {/* Konten Kiri (Materi) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Header Modul */}
          <div>
            <div className="text-primary font-bold text-sm tracking-wider mb-2">HSK 1 · BERBICARA</div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">Greetings & Self-introduction (HSK 1)</h1>
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal">Mandarin</Badge>
              <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal">Berbicara</Badge>
              <Badge variant="secondary" className="bg-primary/10 text-primary font-normal">Level HSK 1</Badge>
              <span className="text-sm text-muted-foreground ml-2">12 mnt · 7 bagian · 1 kuis</span>
            </div>
          </div>

          {/* Kotak Ringkasan */}
          <Card className="bg-muted/30 border-muted">
            <CardContent className="p-5">
              <h3 className="text-xs font-bold tracking-widest text-muted-foreground mb-2">RINGKASAN</h3>
              <p className="text-foreground">
                Nyapa, kenalan, dan pamit — biar nggak kedengeran kaku kayak buku pelajaran jadul.
              </p>
            </CardContent>
          </Card>

          {/* Kotak Info Latihan */}
          <div className="bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400 p-4 rounded-xl flex gap-3 items-start">
            <Mic className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              Modul ini punya latihan speaking. Tekan <span className="font-bold">Dengar</span> untuk pelafalan native, <span className="font-bold">Rekam</span> untuk suara kamu, lalu <span className="font-bold">Play-mu</span> untuk bandingkan.
            </p>
          </div>

          {/* Konten Materi Text */}
          <div className="mt-4 prose prose-neutral dark:prose-invert max-w-none">
            <h3 className="text-sm font-bold tracking-widest text-muted-foreground mb-4 uppercase">
              Bagian 1 · Nyapa itu nggak cuma "Nǐ hǎo?"
            </h3>
            <h2 className="text-2xl font-bold mb-4">Nyapa itu nggak cuma "Nǐ hǎo?"</h2>
            
            <p className="text-lg leading-relaxed text-muted-foreground mb-6">
              Ngaku deh — kamu diajarin "Nǐ hǎo?" di sekolah terus pakai itu buat semua situasi kan? Sama, semua orang Indonesia gitu.
            </p>

            <p className="text-lg leading-relaxed text-muted-foreground mb-6">
              Masalahnya, orang yang bahasa ibunya Mandarin punya banyak banget variasi sapaan, dan mereka milih sesuai waktu sama seberapa akrab. Pakai satu sapaan buat semua situasi itu nggak salah sih, cuma kedengeran agak kaku dan formal terus.
            </p>

            <h4 className="text-xl font-bold mt-8 mb-4">1. Sapaan Super Formal & Sopan</h4>
            <div className="bg-card border rounded-xl p-4 mb-6">
              <div className="flex flex-col gap-2">
                <span className="text-3xl font-bold text-primary">您好</span>
                <span className="font-mono text-sm text-muted-foreground">nín hǎo</span>
                <span className="text-foreground">Halo (untuk orang yang lebih tua, bos, atau guru)</span>
              </div>
            </div>
            <p className="text-muted-foreground mb-6">
              Bedanya cuma di kata "Nín". Kata ini adalah bentuk sopan dari "Nǐ" (Kamu). Jadi kalau lagi presentasi atau sapa guru, pakai ini biar lebih berwibawa!
            </p>

            <h4 className="text-xl font-bold mt-8 mb-4">2. Sapaan Pagi & Malam (Kayak Bule)</h4>
            <p className="text-muted-foreground mb-4">
              Kalau bule suka bilang "Good morning", orang Tiongkok juga sering menyapa berdasarkan waktu lho:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-card border rounded-xl p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-bold">早上好</span>
                  <span className="font-mono text-sm text-muted-foreground">zǎo shàng hǎo</span>
                  <span className="text-sm">Selamat Pagi 🌅</span>
                </div>
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-bold">晚上好</span>
                  <span className="font-mono text-sm text-muted-foreground">wǎn shàng hǎo</span>
                  <span className="text-sm">Selamat Malam 🌙</span>
                </div>
              </div>
            </div>

            <h4 className="text-xl font-bold mt-8 mb-4">3. Sapaan Tongkrongan (Informal)</h4>
            <p className="text-muted-foreground mb-4">
              Kalau sama teman dekat atau sahabat, "Nǐ hǎo" itu terlalu kaku. Mereka biasanya cuma nyapa:
            </p>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-4 p-4 rounded-lg bg-muted/30">
                <span className="text-2xl font-bold w-12 shrink-0">早!</span>
                <div>
                  <p className="font-mono text-sm text-muted-foreground mb-1">zǎo!</p>
                  <p>Artinya "Pagi!". Singkat padat dan sangat natural untuk teman kantor atau kampus.</p>
                </div>
              </li>
              <li className="flex items-start gap-4 p-4 rounded-lg bg-muted/30">
                <span className="text-2xl font-bold w-12 shrink-0">哈罗</span>
                <div>
                  <p className="font-mono text-sm text-muted-foreground mb-1">hā luō</p>
                  <p>Ini versi bahasa Mandarin dari kata "Hello". Anak muda Tiongkok sering banget pakai ini di chat (WeChat).</p>
                </div>
              </li>
            </ul>
          </div>
          
          {/* Navigasi Bawah */}
          <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 mt-8 pt-8 border-t">
            <Button variant="outline" className="w-full sm:w-auto rounded-full px-6 gap-2 h-12 text-base">
              <ArrowLeft className="w-4 h-4" /> Bagian sebelumnya
            </Button>
            <Button className="w-full sm:w-auto rounded-full px-6 gap-2 h-12 text-base bg-foreground text-background hover:bg-foreground/90">
              Lanjut ke Ngenalin diri <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Sidebar Kanan (Navigasi) */}
        <div className="lg:col-span-4 flex flex-col gap-8 sticky top-6">
          
          {/* Daftar Isi Modul */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-muted-foreground mb-4">BAGIAN DALAM MODUL</h3>
            <div className="flex flex-col gap-2">
              {MODULE_PARTS.map((part) => (
                <button 
                  key={part.id} 
                  className={`flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                    part.active 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <span className={`shrink-0 w-5 text-sm ${part.active ? "text-primary font-bold" : ""}`}>
                    {part.id}
                  </span>
                  <span className="text-sm leading-tight line-clamp-2">{part.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tombol Simpan */}
          <Button variant="outline" className="w-full rounded-xl py-6 flex items-center justify-center gap-2 border-muted-foreground/20 hover:bg-muted">
            <Bookmark className="w-4 h-4" /> Simpan
          </Button>

          {/* Tautan Lanjut */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-muted-foreground mb-4">LANJUT</h3>
            <div className="flex flex-col gap-3">
              <Link href="#" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <BookOpen className="w-4 h-4" /> Semua kosakata Mandarin
              </Link>
              <Link href="#" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <CheckCircle2 className="w-4 h-4" /> Kumpulkan kalimat baru
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
