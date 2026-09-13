"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Mic, Bookmark, ChevronRight, CheckCircle2, BookOpen, ArrowLeft, ArrowRight, HelpCircle, MessageSquare, Volume2 } from "lucide-react"

import {
  fetchModuleDetail,
  ensureModuleStarted,
  saveModulePartProgress,
  setModuleBookmark,
  type ModulDetail,
  type ModulPart,
} from "@/lib/modul"
import { TonePinyin } from "@/components/tone-pinyin"

export default function ModulDetailPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()

  const [detail, setDetail] = React.useState<ModulDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [activePartIndex, setActivePartIndex] = React.useState(0)
  const [bookmarked, setBookmarked] = React.useState(false)
  const [savingBookmark, setSavingBookmark] = React.useState(false)

  React.useEffect(() => {
    let active = true
    setLoading(true)
    fetchModuleDetail(params.slug)
      .then((data) => {
        if (!active) return
        if (!data) {
          setError("Modul tidak ditemukan.")
          return
        }
        setDetail(data)
        setBookmarked(data.isBookmarked)

        // Mulai posisi baca dari bagian terakhir yang dibuka (kalau ada).
        const savedIndex = data.progress?.currentPartId
          ? data.parts.findIndex((p) => p.id === data.progress?.currentPartId)
          : -1
        setActivePartIndex(savedIndex >= 0 ? savedIndex : 0)

        // Pastikan progress "active" tercatat begitu modul dibuka.
        void ensureModuleStarted(data.id)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [params.slug])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm text-red-400">{error ?? "Modul tidak ditemukan."}</p>
        <Link href="/dashboard/modul" className="text-sm text-primary hover:underline">
          Kembali ke daftar modul
        </Link>
      </div>
    )
  }

  const parts = detail.parts
  const activePart = parts[activePartIndex]
  const isLastPart = activePartIndex === parts.length - 1
  const progressPercent = parts.length > 0 ? ((activePartIndex + 1) / parts.length) * 100 : 0

  async function goToPart(index: number) {
    if (index < 0 || index >= parts.length) return
    setActivePartIndex(index)
    const isLast = index === parts.length - 1
    // Kalau modul ini punya kuis, jangan tandai "completed" hanya karena
    // sampai di bagian terakhir — status "completed" baru diberikan
    // setelah kuis dilewati (lihat handleNext & halaman kuis).
    const shouldMarkCompleted = isLast && !detail!.hasQuiz
    await saveModulePartProgress(detail!.id, parts[index].id, ((index + 1) / parts.length) * 100, shouldMarkCompleted)
  }

  async function handleNext() {
    if (isLastPart) {
      if (detail!.hasQuiz) {
        // Simpan progres membaca (100% bagian, tapi belum "completed"),
        // lalu arahkan ke halaman kuis modul ini.
        await saveModulePartProgress(detail!.id, activePart.id, 100, false)
        router.push(`/dashboard/modul/${detail!.slug}/kuis`)
      } else {
        // Tidak ada kuis: bagian terakhir selesai = modul selesai.
        await saveModulePartProgress(detail!.id, activePart.id, 100, true)
        router.push("/dashboard/modul")
      }
      return
    }
    await goToPart(activePartIndex + 1)
  }

  async function handleToggleBookmark() {
    setSavingBookmark(true)
    const next = !bookmarked
    setBookmarked(next)
    await setModuleBookmark(detail!.id, next)
    setSavingBookmark(false)
  }

  return (
    <div className="flex flex-col max-w-6xl mx-auto p-4 md:p-6 gap-8 text-foreground">

      {/* Top Bar: Breadcrumbs & Progress */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur pb-4 pt-4 md:pt-6 -mt-4 md:-mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm text-muted-foreground border-b mb-4">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap w-full sm:w-auto pb-2 sm:pb-0 hide-scrollbar">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Beranda</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <Link href="/dashboard/modul" className="hover:text-foreground transition-colors">Modul</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <span className="text-foreground font-medium">{detail.level.label}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span>Bagian {activePartIndex + 1}/{parts.length}</span>
          <Progress value={progressPercent} className="h-2 w-24 sm:w-32" />
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

        {/* Konten Kiri (Materi) */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Header Modul */}
          <div>
            <div className="text-primary font-bold text-sm tracking-wider mb-2">
              {detail.level.label.split(" - ")[0]} · {detail.tags[0]?.toUpperCase() ?? "MODUL"}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">{detail.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal">Mandarin</Badge>
              {detail.tags.map((t) => (
                <Badge key={t} variant="secondary" className="bg-muted text-muted-foreground font-normal">{t}</Badge>
              ))}
              <Badge variant="secondary" className="bg-primary/10 text-primary font-normal">{detail.level.label.split(" - ")[0]}</Badge>
              <span className="text-sm text-muted-foreground ml-2">
                {detail.durationMinutes} mnt · {parts.length} bagian{detail.hasQuiz ? " · 1 kuis" : ""}
              </span>
            </div>
          </div>

          {/* Kotak Ringkasan */}
          {detail.summary && (
            <Card className="bg-muted/30 border-muted">
              <CardContent className="p-5">
                <h3 className="text-xs font-bold tracking-widest text-muted-foreground mb-2">RINGKASAN</h3>
                <p className="text-foreground">{detail.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Konten Bagian Aktif */}
          {activePart ? (
            <PartContent part={activePart} />
          ) : (
            <p className="text-muted-foreground">Modul ini belum punya isi bagian.</p>
          )}

          {/* Navigasi Bawah */}
          <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 mt-8 pt-8 border-t">
            <Button
              variant="outline"
              className="w-full sm:w-auto rounded-full px-6 gap-2 h-12 text-base"
              disabled={activePartIndex === 0}
              onClick={() => goToPart(activePartIndex - 1)}
            >
              <ArrowLeft className="w-4 h-4" /> Bagian sebelumnya
            </Button>
            <Button
              className="w-full sm:w-auto rounded-full px-6 gap-2 h-12 text-base bg-foreground text-background hover:bg-foreground/90"
              onClick={handleNext}
            >
              {isLastPart
                ? detail.hasQuiz
                  ? "Lanjut ke kuis"
                  : "Selesaikan modul"
                : `Lanjut ke ${parts[activePartIndex + 1]?.title ?? "bagian berikutnya"}`}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Sidebar Kanan (Navigasi) */}
        <div className="lg:col-span-4 flex flex-col gap-8 sticky top-6">

          {/* Daftar Isi Modul */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-muted-foreground mb-4">BAGIAN DALAM MODUL</h3>
            <div className="flex flex-col gap-2">
              {parts.map((part, i) => (
                <button
                  key={part.id}
                  onClick={() => goToPart(i)}
                  className={`flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                    i === activePartIndex
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <span className={`shrink-0 w-5 text-sm ${i === activePartIndex ? "text-primary font-bold" : ""}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm leading-tight line-clamp-2">{part.title}</span>
                </button>
              ))}
              {detail.hasQuiz && (
                <Link
                  href={`/dashboard/modul/${detail.slug}/kuis`}
                  className="flex items-start gap-3 p-3 rounded-lg text-left transition-colors hover:bg-muted text-muted-foreground"
                >
                  <span className="shrink-0 w-5 text-sm">
                    <HelpCircle className="w-4 h-4" />
                  </span>
                  <span className="text-sm leading-tight">Kuis modul</span>
                </Link>
              )}
            </div>
          </div>

          {/* Tombol Simpan */}
          <Button
            variant="outline"
            className="w-full rounded-xl py-6 flex items-center justify-center gap-2 border-muted-foreground/20 hover:bg-muted"
            onClick={handleToggleBookmark}
            disabled={savingBookmark}
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-primary text-primary" : ""}`} />
            {bookmarked ? "Tersimpan" : "Simpan"}
          </Button>

          {/* Tautan Lanjut */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-muted-foreground mb-4">LANJUT</h3>
            <div className="flex flex-col gap-3">
              <Link href="/dashboard/flashcard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <BookOpen className="w-4 h-4" /> Semua kosakata Mandarin
              </Link>
              <Link href="/dashboard/modul" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <CheckCircle2 className="w-4 h-4" /> Kembali ke daftar modul
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}

/**
 * Render isi satu bagian modul. `content` adalah JSONB bebas bentuk
 * (lihat seed data): `{ paragraphs: string[] }` untuk narasi, atau
 * `{ instructions: string }` untuk bagian practice/quiz. 
 * 
 * Vocab cards dan contoh kalimat datang dari vocab_parts dan kalimat_parts JSON:
 * - vocab_parts: { cards: [{ hanzi, pinyin, translation, order_index }] }
 * - kalimat_parts: { cards: [{ hanzi, pinyin, translation, order_index }] }
 */
function renderNarrativeText(text: string) {
  // Regex untuk menangkap pola dalam kurung e.g. (wǒ jiào)
  const parts = text.split(/(\([^)]+\))/g)
  return parts.map((part, index) => {
    if (part.startsWith("(") && part.endsWith(")")) {
      const inner = part.slice(1, -1)
      // Periksa apakah di dalam kurung terdapat pinyin bernada
      if (/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(inner)) {
        return (
          <span key={index}>
            (<TonePinyin text={inner} className="font-semibold" />)
          </span>
        )
      }
    }
    return <React.Fragment key={index}>{part}</React.Fragment>
  })
}

function PartContent({ part }: { part: ModulPart }) {
  const paragraphs = Array.isArray((part.content as { paragraphs?: unknown })?.paragraphs)
    ? ((part.content as { paragraphs: string[] }).paragraphs)
    : []
  const instructions =
    typeof (part.content as { instructions?: unknown })?.instructions === "string"
      ? (part.content as { instructions: string }).instructions
      : null

  return (
    <div className="flex flex-col gap-6">
      {instructions && (
        <div className="bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400 p-4 rounded-xl flex gap-3 items-start">
          <Mic className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">{renderNarrativeText(instructions)}</p>
        </div>
      )}

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <h3 className="text-sm font-bold tracking-widest text-muted-foreground mb-4 uppercase">
          Bagian {part.orderIndex} · {part.title}
        </h3>
        <h2 className="text-2xl font-bold mb-4">{part.title}</h2>

        {paragraphs.map((p, i) => (
          <p key={i} className="text-lg leading-relaxed text-muted-foreground mb-6">
            {renderNarrativeText(p)}
          </p>
        ))}

        {/* Vocab Cards - Display as Cards */}
        {part.vocabParts.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Kosakata
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {part.vocabParts.map((v, i) => (
                <div key={`vocab-${i}`} className="bg-card border rounded-xl p-4 hover:border-primary/50 transition-colors">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-primary">{v.hanzi}</span>
                      <button
                        title="Dengarkan (TTS)"
                        onClick={() => {
                          const utterance = new SpeechSynthesisUtterance(v.hanzi)
                          utterance.lang = "zh-CN"
                          window.speechSynthesis.speak(utterance)
                        }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>
                    <TonePinyin text={v.pinyin} className="text-sm font-semibold tracking-wide" />
                    {v.translation && <span className="text-sm">{v.translation}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kalimat/Contoh Kalimat - Display as Table */}
        {part.kalimatParts.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Contoh Kalimat
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Hanzi</th>
                    <th className="text-left p-3 text-sm font-medium">Pinyin</th>
                    <th className="text-left p-3 text-sm font-medium">Arti</th>
                  </tr>
                </thead>
                <tbody>
                  {part.kalimatParts.map((k, i) => (
                    <tr key={`kalimat-${i}`} className="border-t">
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-2">
                          {k.hanzi}
                          <button
                            title="Dengarkan (TTS)"
                            onClick={() => {
                              const utterance = new SpeechSynthesisUtterance(k.hanzi)
                              utterance.lang = "zh-CN"
                              window.speechSynthesis.speak(utterance)
                            }}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-sm font-medium">
                        <TonePinyin text={k.pinyin} />
                      </td>
                      <td className="p-3 text-sm">{k.translation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
