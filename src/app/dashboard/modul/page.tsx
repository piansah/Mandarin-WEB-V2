"use client"

import * as React from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { BookOpen, Video, Search, PlayCircle, ArrowRight, Lock, CheckCircle2 } from "lucide-react"

import { fetchModulOverview, type ModulOverview, type ModulModuleSummary } from "@/lib/modul"

type FilterKey = "active" | "all" | "completed" | "not_started"

export default function ModulPage() {
  const [overview, setOverview] = React.useState<ModulOverview | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<FilterKey>("active")

  React.useEffect(() => {
    fetchModulOverview()
      .then((data) => setOverview(data))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm text-red-400">Gagal memuat modul: {error}</p>
      </div>
    )
  }

  if (!overview || overview.modules.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Belum ada modul yang tersedia.</p>
      </div>
    )
  }

  const { levels, modules, nextStep } = overview

  const activeLevelCode = nextStep?.level.code ?? levels[0]?.code ?? ""
  const activeLevelIndex = modules.filter((m) => m.level.code === activeLevelCode && m.status === "completed").length

  const searchLower = search.trim().toLowerCase()
  const bySearch = (m: ModulModuleSummary) =>
    searchLower.length === 0 ||
    m.title.toLowerCase().includes(searchLower) ||
    (m.description ?? "").toLowerCase().includes(searchLower)

  const byFilter = (m: ModulModuleSummary) => {
    if (filter === "active") return m.status === "active"
    if (filter === "completed") return m.status === "completed"
    if (filter === "not_started") return m.status === "locked"
    return true
  }

  const filteredModules = modules.filter((m) => bySearch(m) && byFilter(m))

  const countActive = modules.filter((m) => m.status === "active").length
  const countCompleted = modules.filter((m) => m.status === "completed").length
  const countNotStarted = modules.filter((m) => m.status === "locked").length

  // Kelompokkan modul yang lolos filter per level, urut sesuai urutan level.
  const groupedByLevel = levels
    .map((lvl) => ({
      level: lvl,
      modules: filteredModules.filter((m) => m.level.code === lvl.code),
    }))
    .filter((g) => g.modules.length > 0)

  return (
    <div className="flex flex-col p-6 gap-8 text-foreground">

      {/* Banner Langkah Berikutnya */}
      {nextStep ? (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-muted-foreground text-sm font-medium hidden sm:inline shrink-0">Langkah berikutnya:</span>
            <span className="font-bold truncate">{nextStep.title}</span>
          </div>
          <Link href={`/dashboard/modul/${nextStep.slug}`} className="shrink-0">
            <Button variant="outline" className="bg-background rounded-full group h-9 sm:h-10 px-4 sm:px-6">
              <span className="hidden sm:inline">Ke sesi</span>
              <span className="sm:hidden">Mulai</span>
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span className="font-medium">Semua modul yang tersedia sudah kamu selesaikan. Mantap!</span>
        </div>
      )}

      {/* Tabs Modul / Video */}
      <div className="flex items-center gap-2">
        <Button variant="default" className="rounded-full">
          <BookOpen className="w-4 h-4 mr-2" /> Modul
        </Button>
        <Button variant="ghost" className="rounded-full bg-muted/50 text-muted-foreground hover:bg-muted" disabled>
          <Video className="w-4 h-4 mr-2" /> Video
        </Button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">

        {/* Sidebar Roadmap */}
        <div className="md:col-span-4 lg:col-span-3 border rounded-xl p-4 md:sticky md:top-4 bg-card">
          <div className="text-xs font-bold tracking-widest text-muted-foreground mb-4">ROADMAP</div>
          <div className="mb-6">
            <h3 className="font-bold text-sm">
              {activeLevelCode
                ? `Kamu di ${levels.find((l) => l.code === activeLevelCode)?.label.split(" - ")[0]} · modul ${activeLevelIndex + 1} dari ${levels.find((l) => l.code === activeLevelCode)?.totalModules ?? 0
                }`
                : "Belum ada progres"}
            </h3>
          </div>

          <div className="relative border-l-2 border-muted ml-4 space-y-8 pb-8">
            {levels.map((lvl) => {
              const isActiveLevel = lvl.code === activeLevelCode
              return (
                <div key={lvl.id} className="relative pl-6">
                  <div
                    className={`absolute -left-[17px] top-0 h-8 w-8 rounded-full border-4 flex items-center justify-center text-[10px] font-bold ${isActiveLevel
                        ? "bg-primary text-primary-foreground border-background shadow-[0_0_0_2px_hsl(var(--primary))]"
                        : "bg-muted text-muted-foreground border-background"
                      }`}
                  >
                    {lvl.code.replace("hsk", "").toUpperCase()}
                  </div>

                  <div>
                    <h4 className={`font-bold text-sm ${isActiveLevel ? "text-foreground" : "text-muted-foreground"}`}>
                      {lvl.label}
                    </h4>
                    {lvl.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{lvl.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {lvl.completedModules}/{lvl.totalModules} modul · Bahasa Mandarin
                    </p>
                  </div>
                </div>
              )
            })}

            <div className="absolute bottom-0 left-[-2px] bg-gradient-to-t from-card to-transparent h-12 w-8"></div>
          </div>
        </div>

        {/* Konten Utama Kanan */}
        <div className="md:col-span-8 lg:col-span-9 flex flex-col gap-6">

          {/* Search & Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari modul berdasarkan nama atau deskripsi..."
              className="pl-10 rounded-full bg-background border-muted"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge
              variant={filter === "active" ? "default" : "outline"}
              onClick={() => setFilter("active")}
              className="rounded-full px-4 py-1.5 cursor-pointer font-normal"
            >
              Langkah berikutnya / aktif · {countActive}
            </Badge>
            <Badge
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
              className="rounded-full px-4 py-1.5 cursor-pointer hover:bg-muted font-normal"
            >
              Semua modul · {modules.length}
            </Badge>
            <Badge
              variant={filter === "completed" ? "default" : "outline"}
              onClick={() => setFilter("completed")}
              className="rounded-full px-4 py-1.5 cursor-pointer hover:bg-muted font-normal"
            >
              Selesai · {countCompleted}
            </Badge>
            <Badge
              variant={filter === "not_started" ? "default" : "outline"}
              onClick={() => setFilter("not_started")}
              className="rounded-full px-4 py-1.5 cursor-pointer hover:bg-muted font-normal"
            >
              Belum mulai · {countNotStarted}
            </Badge>
          </div>

          {groupedByLevel.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              Tidak ada modul yang cocok dengan pencarian/filter ini.
            </p>
          )}

          {groupedByLevel.map(({ level, modules: levelModules }) => (
            <div key={level.id} className="flex flex-col gap-4">
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-4 mt-2">
                <div className="flex items-center gap-3">
                  <span className="bg-foreground text-background text-xs font-bold px-2 py-1 rounded">
                    {level.code.replace("hsk", "HSK ").toUpperCase()}
                  </span>
                  <h2 className="text-xl font-bold">{level.label.split(" - ")[1] ?? level.label}</h2>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {level.code === activeLevelCode && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                      Levelmu
                    </Badge>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {level.completedModules}/{level.totalModules} modul · Bahasa Mandarin dasar
                  </span>
                </div>
              </div>

              {/* Grid Modul */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {levelModules.map((mod) => (
                  <ModuleCard key={mod.id} module={mod} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ModuleCard({ module: mod }: { module: ModulModuleSummary }) {
  const statusIcon =
    mod.status === "completed" ? (
      <CheckCircle2 className="w-6 h-6 text-primary" />
    ) : mod.status === "active" ? (
      <PlayCircle className="w-6 h-6 text-primary fill-primary/10" />
    ) : (
      <Lock className="w-6 h-6 text-muted-foreground" />
    )

  const cardBody = (
    <CardContent className="p-5 flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <Badge variant="secondary" className="bg-foreground text-background rounded-full hover:bg-foreground hover:text-background">
          {mod.level.code.replace("hsk", "").toUpperCase()}/{mod.orderIndex}
        </Badge>
        {statusIcon}
      </div>

      <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">{mod.title}</h3>

      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
          {mod.level.label.split(" - ")[0]}
        </Badge>
        {mod.tags.map((t) => (
          <Badge key={t} variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted/80">
            {t}
          </Badge>
        ))}
      </div>

      <p className="text-sm text-muted-foreground mb-6 flex-grow leading-relaxed">{mod.description}</p>

      <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
        <span className="flex items-center gap-1">⏱ {mod.durationMinutes} mnt</span>
        {mod.status === "active" && mod.progressPercent > 0 && (
          <span className="text-primary font-medium">{Math.round(mod.progressPercent)}%</span>
        )}
      </div>
    </CardContent>
  )

  if (mod.status === "locked") {
    return (
      <Card className="relative overflow-hidden opacity-60 cursor-not-allowed shadow-sm">
        {cardBody}
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden group hover:border-primary/50 transition-colors shadow-sm">
      <Link href={`/dashboard/modul/${mod.slug}`} className="block h-full">
        {cardBody}
      </Link>
    </Card>
  )
}
