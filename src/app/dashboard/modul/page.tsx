"use client"

import * as React from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { BookOpen, Video, Search, PlayCircle, ArrowRight, ChevronDown } from "lucide-react"

// Dummy Data
const ROADMAP_LEVELS = [
  { id: "hsk1", label: "HSK 1 - Pemula", desc: "Kenalan, pesan makanan, tanya arah", count: 16, active: true },
  { id: "hsk2", label: "HSK 2 - Dasar", desc: "Ngobrol sehari-hari, cerita rutinitas", count: 17, active: false },
  { id: "hsk3", label: "HSK 3 - Menengah", desc: "Diskusi topik umum, opini singkat", count: 20, active: false },
]

const MODULES = [
  {
    id: "m1",
    title: "Greetings & Self-introduction (HSK 1)",
    desc: "Nyapa, kenalan, dan pamit — biar nggak kedengeran kaku kayak buku pelajaran.",
    level: "HSK 1",
    order: "1/16",
    time: "12 mnt",
    tags: ["Direkomendasikan", "Berbicara"],
    status: "active"
  },
  {
    id: "m2",
    title: "Numbers & Counting (HSK 1)",
    desc: "Angka 1-100, menyebutkan umur, dan harga barang saat belanja.",
    level: "HSK 1",
    order: "2/16",
    time: "15 mnt",
    tags: ["Kosakata", "Mendengar"],
    status: "locked"
  },
  {
    id: "m3",
    title: "Family & Hobbies (HSK 1)",
    desc: "Ngomongin keluarga, hewan peliharaan, dan hobi kesukaan di akhir pekan.",
    level: "HSK 1",
    order: "3/16",
    time: "20 mnt",
    tags: ["Tata Bahasa", "Membaca"],
    status: "locked"
  }
]

export default function ModulPage() {
  return (
    <div className="flex flex-col max-w-6xl mx-auto p-4 md:p-6 gap-8 text-foreground">
      
      {/* Banner Langkah Berikutnya */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm font-medium">Langkah berikutnya:</span>
          <span className="font-bold">Greetings & Self-introduction (HSK 1)</span>
        </div>
        <Link href="/dashboard/modul/m1">
          <Button variant="outline" className="bg-background rounded-full group">
            Ke sesi <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>

      {/* Tabs Modul / Video */}
      <div className="flex items-center gap-2">
        <Button variant="default" className="rounded-full">
          <BookOpen className="w-4 h-4 mr-2" /> Modul
        </Button>
        <Button variant="ghost" className="rounded-full bg-muted/50 text-muted-foreground hover:bg-muted">
          <Video className="w-4 h-4 mr-2" /> Video · 14
        </Button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Sidebar Roadmap */}
        <div className="md:col-span-4 lg:col-span-3 border rounded-xl p-4 sticky top-4 bg-card">
          <div className="text-xs font-bold tracking-widest text-muted-foreground mb-4">ROADMAP</div>
          <div className="mb-6">
            <h3 className="font-bold text-sm">Kamu di HSK 1 · modul 1 dari 16</h3>
            <p className="text-xs text-muted-foreground mt-1">Sisa HSK 1 ±3 minggu kalau 15 menit sehari</p>
          </div>
          
          <div className="relative border-l-2 border-muted ml-4 space-y-8 pb-8">
            {ROADMAP_LEVELS.map((lvl) => (
              <div key={lvl.id} className="relative pl-6">
                {/* Node Dot */}
                <div className={`absolute -left-[17px] top-0 h-8 w-8 rounded-full border-4 flex items-center justify-center text-[10px] font-bold ${
                  lvl.active 
                    ? "bg-primary text-primary-foreground border-background shadow-[0_0_0_2px_hsl(var(--primary))]" 
                    : "bg-muted text-muted-foreground border-background"
                }`}>
                  {lvl.id.replace("hsk", "").toUpperCase()}
                </div>
                
                <div>
                  <h4 className={`font-bold text-sm ${lvl.active ? "text-foreground" : "text-muted-foreground"}`}>
                    {lvl.label}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{lvl.desc}</p>
                  <p className="text-xs text-muted-foreground mt-2">0/{lvl.count} modul · Bahasa Mandarin dasar</p>
                </div>
              </div>
            ))}
            
            {/* Fade out next levels */}
            <div className="absolute bottom-0 left-[-2px] bg-gradient-to-t from-card to-transparent h-12 w-8"></div>
          </div>
          <Button variant="ghost" className="w-full text-xs text-muted-foreground mt-2 hover:bg-transparent hover:text-foreground">
            Lihat level berikutnya (HSK 4-6) <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Konten Utama Kanan */}
        <div className="md:col-span-8 lg:col-span-9 flex flex-col gap-6">
          
          {/* Search & Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Cari modul berdasarkan nama atau deskripsi..." 
              className="pl-10 rounded-full bg-background border-muted"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="default" className="rounded-full px-4 py-1.5 cursor-pointer font-normal">Langkah berikutnya / aktif · 1</Badge>
            <Badge variant="outline" className="rounded-full px-4 py-1.5 cursor-pointer hover:bg-muted font-normal text-muted-foreground">Semua modul · 148</Badge>
            <Badge variant="outline" className="rounded-full px-4 py-1.5 cursor-pointer hover:bg-muted font-normal text-muted-foreground">Selesai · 0</Badge>
            <Badge variant="outline" className="rounded-full px-4 py-1.5 cursor-pointer hover:bg-muted font-normal text-muted-foreground">Belum mulai · 147</Badge>
          </div>

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-4 mt-2">
            <div className="flex items-center gap-3">
              <span className="bg-foreground text-background text-xs font-bold px-2 py-1 rounded">HSK 1</span>
              <h2 className="text-xl font-bold">Pemula</h2>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">Levelmu</Badge>
              <span className="text-muted-foreground text-xs">0/1 modul · Bahasa Mandarin dasar</span>
            </div>
          </div>

          {/* Grid Modul */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {MODULES.map((mod) => (
              <Card key={mod.id} className="relative overflow-hidden group hover:border-primary/50 transition-colors shadow-sm">
                <Link href={`/dashboard/modul/${mod.id}`} className="block h-full">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <Badge variant="secondary" className="bg-foreground text-background rounded-full hover:bg-foreground hover:text-background">
                        {mod.level.replace("HSK ", "")}{mod.order.slice(mod.order.indexOf("/"))}
                      </Badge>
                      <PlayCircle className={`w-6 h-6 ${mod.status === 'active' ? 'text-primary fill-primary/10' : 'text-muted-foreground'}`} />
                    </div>
                    
                    <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">{mod.title}</h3>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{mod.level}</Badge>
                      {mod.tags.map(t => (
                        <Badge key={t} variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted/80">{t}</Badge>
                      ))}
                    </div>

                    <p className="text-sm text-muted-foreground mb-6 flex-grow leading-relaxed">{mod.desc}</p>
                    
                    <div className="flex items-center text-xs text-muted-foreground mt-auto">
                      <span className="flex items-center gap-1">
                        ⏱ {mod.time}
                      </span>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>

        </div>

      </div>
    </div>
  )
}
