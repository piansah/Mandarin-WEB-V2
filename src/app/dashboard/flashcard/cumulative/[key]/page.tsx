"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { RotateCcw, Mic, CheckCircle2, Star, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { speakMandarin } from "@/lib/tts"
import { saveUserScore } from "@/lib/user-scores"
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
  // Quiz Kalimat Kumulatif dulu punya menu & daftar sendiri (/dashboard/quiz/review),
  // sekarang dipindah jadi salah satu opsi latihan di sini — dipasangkan dengan
  // set kalimat (kalimat_sets) yang HSK level & urutannya sama dengan set hanzi ini.
  // null = belum dicek / tidak ada quiz kalimat yang sepadan untuk set ini.
  const [quizKey, setQuizKey] = React.useState<string | null>(null)

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

      const kalimatResult = await supa
        .from("kalimat_sets")
        .select("key")
        .eq("hsk_level", setResult.data.hsk_level)
        .eq("sort_order", setResult.data.sort_order)
        .maybeSingle()

      if (cancelled) return

      const saved = window.localStorage.getItem(`hanzi_read_progress:${key}`)
      const completedIds = saved ? (JSON.parse(saved) as number[]) : []
      const restored = Object.fromEntries(completedIds.map((id) => [id, 2])) as Record<number, 0 | 1 | 2>

      setSet(setResult.data)
      setItems(itemsResult.data ?? [])
      setQuizKey(kalimatResult.data?.key ?? null)
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
      speakMandarin(item.hanzi)
      return
    }

    const next = (current + 1) as 1 | 2
    if (next === 1) speakMandarin(item.hanzi)
    setStateById((previous) => {
      const updated = { ...previous, [item.id]: next }
      const completed = items.filter((entry) => updated[entry.id] === 2).map((entry) => entry.id)
      window.localStorage.setItem(`hanzi_read_progress:${key}`, JSON.stringify(completed))
      if (items.length > 0 && completed.length === items.length) {
        // type "hanzi" cuma dapat XP kalau score = 100 (bonus selesai penuh)
        saveUserScore("hanzi", key, 100).catch(() => {})
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

  if (loading) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
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

        <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 pb-32 sm:px-6 flex-1 overflow-x-hidden">
          <p className="rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground">Tap kalimat untuk membuka pinyin dan mendengar pelafalannya. Tap sekali lagi untuk melihat arti. Setelah terbuka penuh, tap lagi untuk mengulang audio.</p>
          {groups.map((group) => (
            <section key={`${group.tag}-${group.label}`}>
              <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{group.tag}</span>{group.label}</div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.items.map((item, index) => {
                  const state = stateById[item.id] ?? 0
                  return (
                    <SwipeToReport
                      key={item.id}
                      reported={reportedItems.has(item.id)}
                      onReport={() => openReportModal(item)}
                    >
                      <button
                        type="button"
                        onClick={() => advance(item)}
                        className={`min-h-36 w-full rounded-xl border p-4 text-left transition-colors ${state === 2 ? "border-emerald-500/40 bg-emerald-500/5" : state === 1 ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card hover:border-primary/40"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-hanzi text-2xl leading-relaxed text-foreground">{item.hanzi}</div>
                          <div className="flex items-center gap-2">
                            {item.user_contribution && (
                              <span className="rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[10px] font-medium">
                                User
                              </span>
                            )}
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">#{index + 1}</span>
                          </div>
                        </div>
                        {state >= 1 && <TonePinyin text={item.pinyin} className="mt-2 text-sm font-medium" />}
                        {state >= 2 && <div className="mt-3 border-t border-border/60 pt-3 text-sm leading-relaxed text-muted-foreground">{item.arti}</div>}
                        {state === 0 && <p className="mt-3 text-xs text-muted-foreground/70">Tap untuk buka</p>}
                      </button>
                    </SwipeToReport>
                  )
                })}
              </div>
            </section>
          ))}
          {completedCount === items.length && items.length > 0 && (
            <div className="flex flex-col flex-1 items-center justify-center gap-7 p-8 bg-background overflow-hidden min-h-0">
              {/*
                Signature: watermark emoji besar di belakang ring, gaya
                sama persis dengan watermark yang muncul di flashcard session.
              */}
              <div
                aria-hidden="true"
                className="absolute select-none pointer-events-none text-foreground/[0.05] dark:text-foreground/[0.07]"
                style={{
                  fontSize: "16rem",
                  lineHeight: 1,
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                完
              </div>

              <div className="flex flex-col items-center gap-1 relative z-10">
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
            </div>
          )}
        </main>

        {/* Fixed Footer with Practice Button */}
        <div
          className="fixed bottom-0 right-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur p-4 transition-[left] duration-200 ease-linear"
          style={{ left: sidebarOffset, paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto max-w-4xl">
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
                      className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-colors ${
                        quizKey
                          ? "border-border/50 bg-card hover:bg-muted/50 hover:border-primary/50 cursor-pointer"
                          : "border-border/30 bg-card/40 opacity-55 cursor-not-allowed"
                      }`}
                    >
                      <div className="h-11 w-11 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <ListChecks className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-semibold text-center leading-tight">Quiz Kalimat</span>
                      {!quizKey && (
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">Belum Tersedia</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={navigateToSpeakingPractice}
                      className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/50 hover:border-primary/50 cursor-pointer transition-colors"
                    >
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
