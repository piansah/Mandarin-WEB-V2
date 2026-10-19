"use client"

/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/* 
   page.tsx -- Flashcard Kumulatif - Swipe Session */

import * as React from "react"
import { PageLoader } from "@/components/page-loader"
import { useParams, useRouter } from "next/navigation"
import { RotateCcw, Mic, CheckCircle2, Star, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TonePinyin } from "@/components/tone-pinyin"
import { ReportModal } from "@/components/report-modal"
import { SwipeToReport } from "@/components/swipe-to-report"
import { PracticeHeader } from "@/components/practice-header"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { useSidebar } from "@/components/ui/sidebar"
import { useSupabase } from "@/hooks/use-supabase"
import { speakParagraph } from "@/lib/tts"
import { segmentSentenceByPinyin } from "@/lib/hanzi-segmentation"
import { saveUserScore, getEstafetPracticeScores, getHanziReadProgress, saveHanziReadProgress } from "@/lib/user-scores"
import { checkUserContentReports } from "@/lib/bug-reports"
import styles from "./page.module.css"

type HanziSet = {
  key: string
  title: string
  sub: string
  hsk_level: number
  sort_order: number
}

type HanziItem = {
  id: number
  section_label: string
  section_tag: string
  sort_order: number
  hanzi: string
  pinyin: string
  arti: string
  user_contribution: boolean | null
}

export default function CumulativeFlashcardSessionPage() {
  const params = useParams<{ key: string }>()
  const router = useRouter()
  const key = params.key
  const supa = useSupabase()
  const { pinned, isMobile } = useSidebar()

  // Sidebar floating sebagai overlay, tapi kalau di-pin terbuka di desktop dia
  // makan ruang layout — offset footer fixed ini biar sama kayak pola yang
  // sudah dipakai di halaman Daftar Kata (flashcard/[id]/page.tsx). Di mobile
  // sidebar selalu overlay (Sheet), jadi cookie `pinned` yang tersimpan TIDAK
  // boleh ikut menggeser footer ini di sana.
  const sidebarOffset = pinned && !isMobile ? '280px' : '0px'

  const [set, setSet] = React.useState<HanziSet | null>(null)
  const [items, setItems] = React.useState<HanziItem[]>([])
  const [reportedItems, setReportedItems] = React.useState<Set<number>>(new Set())
  const [stateById, setStateById] = React.useState<Record<number, 0 | 1 | 2>>({})
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reportModal, setReportModal] = React.useState<{ isOpen: boolean; itemId: number | null; itemLabel: string }>({ isOpen: false, itemId: null, itemLabel: "" })
  const [quizKey, setQuizKey] = React.useState<string | null>(null)
  const [quizScore, setQuizScore] = React.useState<number | null>(null)
  const [speakingDone, setSpeakingDone] = React.useState(false)
  const [activePlayback, setActivePlayback] = React.useState<{ itemId: number; segmentIndex: number } | null>(null)
  const playbackId = React.useRef(0)
  const segmentedItems = React.useMemo(
    () => new Map(items.map(item => [item.id, segmentSentenceByPinyin(item.hanzi, item.pinyin)])),
    [items],
  )

  const playItem = React.useCallback((item: HanziItem) => {
    const currentPlaybackId = ++playbackId.current
    const segments = segmentedItems.get(item.id) ?? []
    const ranges: Array<{ index: number; start: number; end: number }> = []
    let offset = 0
    segments.forEach((segment, index) => {
      const start = offset
      offset += segment.hanzi.length
      ranges.push({ index, start, end: offset })
    })
    const first = ranges.find(range => !segments[range.index].isPunct)
    if (first) setActivePlayback({ itemId: item.id, segmentIndex: first.index })
    let playbackRate = 1
    const startedAt = performance.now()
    const findWordRange = (charIndex: number) => {
      const exact = ranges.find(entry => charIndex >= entry.start && charIndex < entry.end)
      if (exact && !segments[exact.index].isPunct) return exact
      if (exact) {
        return [...ranges].reverse().find(entry => !segments[entry.index].isPunct && entry.end <= exact.start)
      }
      return ranges
        .filter(entry => !segments[entry.index].isPunct)
        .filter(entry => entry.end <= charIndex)
        .at(-1)
    }
    const totalChars = Math.max(1, item.hanzi.length)
    let lastActiveCharIndex = 0
    let lastActiveSegment = first?.index ?? -1
    const applyCharacterIndex = (charIndex: number) => {
      const range = findWordRange(charIndex)
      if (range && range.index > lastActiveSegment) {
        lastActiveSegment = range.index
        setActivePlayback({ itemId: item.id, segmentIndex: range.index })
      }
    }
    const fallback = window.setInterval(() => {
      if (playbackId.current !== currentPlaybackId) return
      // Normal tetap 260 ms. Pelan/Lambat dipercepat agar highlight tidak
      // tertinggal dari audio pada voice browser yang lebih cepat.
      const msPerChar = playbackRate >= 0.95 ? 260 : playbackRate >= 0.5 ? 350 : 450
      const estimatedIndex = Math.min(totalChars - 1, Math.floor((performance.now() - startedAt) / msPerChar))
      if (estimatedIndex > lastActiveCharIndex) {
        // Batasi satu langkah karakter per tick agar keterlambatan frame tidak
        // membuat highlight meloncat melewati beberapa kosakata.
        lastActiveCharIndex = Math.min(estimatedIndex, lastActiveCharIndex + 1)
        applyCharacterIndex(lastActiveCharIndex)
      }
    }, 50)
    void speakParagraph(item.hanzi, undefined, undefined, rate => { playbackRate = rate }).finally(() => {
      window.clearInterval(fallback)
      if (playbackId.current === currentPlaybackId) setActivePlayback(null)
    })
  }, [segmentedItems])

  const refreshScores = React.useCallback(async () => {
    if (!key) return
    const res = await getEstafetPracticeScores(key)
    setQuizScore(res.quizScore)
    setSpeakingDone(res.speakingDone)
  }, [key])

  React.useEffect(() => {
    refreshScores()

    function handleVisibility() {
      if (document.visibilityState === "visible") refreshScores()
    }
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", refreshScores)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", refreshScores)
    }
  }, [refreshScores])

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      const [setResult, itemsResult] = await Promise.all([
        supa.from("hanzi_sets").select("key, title, sub, hsk_level, sort_order").eq("key", key).single(),
        supa
          .from("hanzi_items")
          .select("id, section_label, section_tag, sort_order, hanzi, pinyin, arti, user_contribution")
          .eq("hanzi_key", key)
          .order("sort_order", { ascending: true }),
      ])

      if (cancelled) return
      if (setResult.error || !setResult.data) {
        setError("Set kalimat tidak ditemukan.")
        setLoading(false)
        return
      }
      if (itemsResult.error) {
        setError(`Gagal memuat kalimat: ${itemsResult.error.message}`)
        setLoading(false)
        return
      }

      const quizKey = key // Hanzi set key yang sama digunakan untuk quiz

      if (cancelled) return

      // Gabungkan progres dari localStorage + Supabase (union) agar cross-device
      const localSaved = window.localStorage.getItem(`hanzi_read_progress:${key}`)
      const localIds: number[] = localSaved ? (JSON.parse(localSaved) as number[]) : []
      const dbIds = await getHanziReadProgress(key)
      const mergedIds = Array.from(new Set([...localIds, ...dbIds]))

      // Simpan merged ke localStorage supaya konsisten
      if (mergedIds.length > localIds.length) {
        window.localStorage.setItem(`hanzi_read_progress:${key}`, JSON.stringify(mergedIds))
      }

      // Backfill: jika localStorage punya data tapi DB kosong (data lama sebelum fitur sync),
      // upload sekarang agar device lain bisa mengambilnya.
      if (localIds.length > 0 && dbIds.length === 0) {
        const allItemIds = (itemsResult.data ?? []).map((i) => i.id)
        const isAllDone = allItemIds.length > 0 && localIds.length === allItemIds.length
        if (isAllDone) {
          // Sudah selesai semua — simpan score 100 + read_ids
          saveUserScore("hanzi", key, 100, { read_ids: localIds }).catch(() => { })
        } else {
          // Sebagian selesai — simpan read_ids tanpa mengubah score
          saveHanziReadProgress(key, localIds).catch(() => { })
        }
      }

      const restored = Object.fromEntries(mergedIds.map((id) => [id, 2])) as Record<number, 0 | 1 | 2>

      setSet(setResult.data)
      setItems(itemsResult.data ?? [])
      setQuizKey(quizKey)
      setStateById(restored)

      // Batch-check which items have been reported by user (single query)
      const allIds = (itemsResult.data ?? []).map((item) => item.id)
      const reportedSet = await checkUserContentReports(allIds)
      setReportedItems(reportedSet)

      setLoading(false)
    }

    load().catch(() => {
      if (!cancelled) {
        setError("Gagal memuat set kalimat.")
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [key])

  const completedCount = items.filter((item) => stateById[item.id] === 2).length
  const progress = items.length ? (completedCount / items.length) * 100 : 0
  const groups = items.reduce<Array<{ label: string; tag: string; items: HanziItem[] }>>((result, item) => {
    const current = result.at(-1)
    if (!current || current.label !== item.section_label) result.push({ label: item.section_label, tag: item.section_tag, items: [item] })
    else current.items.push(item)
    return result
  }, [])

  function advance(item: HanziItem) {
    const current = stateById[item.id] ?? 0
    if (current === 2) {
      playItem(item)
      return
    }

    const next = (current + 1) as 1 | 2
    playItem(item)
    setStateById((previous) => {
      const updated = { ...previous, [item.id]: next }
      const completed = items.filter((entry) => updated[entry.id] === 2).map((entry) => entry.id)
      window.localStorage.setItem(`hanzi_read_progress:${key}`, JSON.stringify(completed))
      if (items.length > 0 && completed.length === items.length) {
        // Selesai semua — simpan score 100 + read_ids sekaligus (satu upsert, tidak ada race condition)
        saveUserScore("hanzi", key, 100, { read_ids: completed }).catch(() => { })
      } else {
        // Progres parsial — simpan read_ids ke Supabase untuk sinkronisasi antar device
        saveHanziReadProgress(key, completed).catch(() => { })
      }
      return updated
    })
  }

  function resetProgress() {
    window.localStorage.removeItem(`hanzi_read_progress:${key}`)
    setStateById({})
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function navigateToSpeakingPractice() {
    router.push(`/dashboard/flashcard/cumulative/${key}/speaking`)
  }

  function navigateToQuiz() {
    if (!quizKey) return
    router.push(`/dashboard/practice/quiz/review/${quizKey}`)
  }

  function openReportModal(item: HanziItem) {
    if (!item) return
    setReportModal({
      isOpen: true,
      itemId: item.id,
      itemLabel: item.hanzi,
    })
  }

  function closeReportModal() {
    setReportModal({ isOpen: false, itemId: null, itemLabel: "" })
  }

  if (loading) return <PageLoader />
  if (error || !set) return <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background p-6 text-center"><p className="text-sm text-red-400">{error ?? "Set kalimat tidak ditemukan."}</p><Button variant="outline" onClick={() => router.push("/dashboard/flashcard/cumulative")}>Kembali</Button></div>

  return (
    <div className={styles.page}>
      <div className="flex flex-col flex-1 select-none relative z-10 min-h-0">
        <PracticeHeader
          title={set.title}
          subtitle={set.sub}
          progress={progress}
          rightContent={`${completedCount}/${items.length}`}
          showStats={false}
        />

        <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 pb-32 sm:px-6 flex-1 overflow-x-hidden">
          <p className="rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            <span className="md:hidden">Tap kalimat untuk membuka pinyin dan audio. Tap lagi untuk melihat arti; tap berikutnya memutar ulang audio dan mengganti kecepatannya.</span>
            <span className="hidden md:inline">Tap kalimat untuk membuka pinyin dan mendengar pelafalannya. Tap sekali lagi untuk melihat arti. Setelah terbuka penuh, tap lagi untuk mengulang audio. Tap kalimat berulang kali untuk mengganti kecepatan: normal, pelan, lalu lambat.</span>
          </p>
          {groups.map((group) => (
            <section key={`${group.tag}-${group.label}`}>
              <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{group.tag}</span>{group.label}</div>
              <div className="grid gap-3 md:grid-cols-2 items-stretch">
                {group.items.map((item, index) => {
                  const state = stateById[item.id] ?? 0
                  const segments = segmentedItems.get(item.id) ?? []
                  return (
                    <div key={item.id} className="h-full">
                      <SwipeToReport
                        reported={reportedItems.has(item.id)}
                        onReport={() => openReportModal(item)}
                      >
                        <button
                          type="button"
                          onClick={() => advance(item)}
                          className={`min-h-36 h-full w-full rounded-xl border p-4 text-left transition-colors ${state === 2 ? "border-emerald-500/40 bg-emerald-500/5" : state === 1 ? "border-orange-500/50 bg-orange-500/5" : "border-border/60 bg-card hover:border-primary/40"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="font-hanzi text-2xl leading-relaxed text-foreground">
                              {segments.map((segment, segmentIndex) => {
                                const active = !segment.isPunct && activePlayback?.itemId === item.id && activePlayback.segmentIndex === segmentIndex
                                return <span key={`${segment.hanzi}-${segmentIndex}`} className={`rounded-sm transition-colors duration-150 ${active ? "bg-primary/25 text-primary font-semibold shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]" : ""}`}>{segment.hanzi}</span>
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              {item.user_contribution && (
                                <span className="rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[10px] font-medium">
                                  User
                                </span>
                              )}
                            </div>
                          </div>
                          {state >= 1 && <TonePinyin text={item.pinyin} className="mt-2 text-sm font-medium" />}
                          {state >= 2 && <div className="mt-3 border-t border-border/60 pt-3 text-sm leading-relaxed text-muted-foreground">{item.arti}</div>}
                          {state === 0 && <p className="mt-3 text-xs text-muted-foreground/70">Tap untuk buka</p>}
                        </button>
                      </SwipeToReport>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
          {completedCount === items.length && items.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="w-full border-border/50 bg-card/50 backdrop-blur-sm shadow-lg md:col-span-2">
                <CardContent className="flex flex-col items-center gap-6 p-8 relative overflow-hidden">
                  {/*
                    Signature: watermark emoji besar di belakang ring, gaya
                    sama persis dengan watermark yang muncul di flashcard session.
                  */}
                  <div
                    aria-hidden="true"
                    className="absolute select-none pointer-events-none text-foreground/[0.05] dark:text-foreground/[0.07]"
                    style={{
                      fontSize: "12rem",
                      lineHeight: 1,
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    完
                  </div>

                  <div className="flex flex-col items-center gap-1 relative z-10 text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Semua kalimat telah dibaca!</h2>
                    <p className="text-sm text-muted-foreground">{completedCount} dari {items.length} kalimat selesai</p>
                  </div>

                  {/* Ring akurasi */}
                  <div className="relative z-10 flex items-center justify-center">
                    {(() => {
                      const circumference = 2 * Math.PI * 54
                      return (
                        <svg width="152" height="152" viewBox="0 0 120 120" className="-rotate-90">
                          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/60" />
                          <circle
                            cx="60" cy="60" r="54" fill="none"
                            stroke="#34d399"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={0}
                            style={{ transition: "stroke 400ms ease" }}
                          />
                        </svg>
                      )
                    })()}
                    <div className="absolute flex flex-col items-center">
                      <span className="text-4xl font-bold text-foreground tabular-nums">100%</span>
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Akurasi</span>
                    </div>
                  </div>

                  {/* Rincian penilaian */}
                  <div className="flex flex-wrap justify-center gap-2 relative z-10">
                    <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /></span>
                      <span className="text-sm font-semibold text-emerald-500 tabular-nums">{completedCount}</span>
                      <span className="text-xs text-muted-foreground">Selesai</span>
                    </div>
                    <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500/15 text-blue-500"><Star className="h-3.5 w-3.5" /></span>
                      <span className="text-sm font-semibold text-blue-500 tabular-nums">{items.length}</span>
                      <span className="text-xs text-muted-foreground">Total</span>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full max-w-xs relative z-10">
                    <Button variant="outline" className="flex-1 rounded-2xl h-11" onClick={resetProgress}><RotateCcw className="h-4 w-4 mr-2" />Ulangi dari awal</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>

        {/* Fixed Footer with Practice Button */}
        <div
          className="fixed bottom-0 right-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur transition-[left] duration-200 ease-linear"
          style={{ left: sidebarOffset, paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto w-full max-w-6xl px-6 py-4">
            <Drawer>
              <DrawerTrigger render={<Button className="w-full" size="lg" />}>
                Mulai Latihan
              </DrawerTrigger>
              <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                  <DrawerHeader className="text-center pb-2">
                    <DrawerTitle className="text-xs tracking-widest text-muted-foreground uppercase">
                      Pilih Latihan
                    </DrawerTitle>
                  </DrawerHeader>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { if (quizKey) navigateToQuiz() }}
                      aria-disabled={!quizKey}
                      className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-colors relative ${!quizKey
                          ? "border-border/30 bg-card/40 opacity-55 cursor-not-allowed"
                          : quizScore !== null
                            ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-sm cursor-pointer"
                            : "border-border/50 bg-card hover:bg-muted/50 hover:border-primary/50 cursor-pointer"
                        }`}
                    >
                      {quizScore !== null && typeof quizScore === "number" && (
                        <div className="absolute top-2 right-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            {quizScore}%
                          </span>
                        </div>
                      )}
                      <div className="h-11 w-11 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <ListChecks className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-semibold text-center leading-tight">Quiz Estafet</span>
                      {!quizKey && (
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">Belum Tersedia</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={navigateToSpeakingPractice}
                      className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-colors relative cursor-pointer ${speakingDone
                          ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-sm"
                          : "border-border/50 bg-card hover:bg-muted/50 hover:border-primary/50"
                        }`}
                    >
                      {speakingDone && (
                        <div className="absolute top-2 right-2 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </div>
                      )}
                      <div className="h-11 w-11 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-500">
                        <Mic className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-semibold text-center leading-tight">Latihan Speaking</span>
                    </button>
                  </div>
                  <DrawerFooter>
                    <DrawerClose render={<Button variant="outline" className="rounded-xl" />}>
                      Batal
                    </DrawerClose>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>

        {/* Report Modal */}
        <ReportModal
          isOpen={reportModal.isOpen}
          onClose={closeReportModal}
          contentType="kalimat"
          contentId={reportModal.itemId || 0}
          contentLabel={reportModal.itemLabel}
        />
      </div>
    </div>
  )
}
