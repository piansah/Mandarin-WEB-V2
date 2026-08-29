"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { RotateCcw, Mic, Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TonePinyin } from "@/components/tone-pinyin"
import { ReportModal } from "@/components/report-modal"
import { PracticeHeader } from "@/components/practice-header"
import { useSupabase } from "@/hooks/use-supabase"
import { speakMandarin } from "@/lib/tts"
import { saveUserScore } from "@/lib/user-scores"
import { checkUserContentReports } from "@/lib/bug-reports"
import styles from "./page.module.css"

type HanziSet = {
  key: string
  title: string
  sub: string
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
  const [set, setSet] = React.useState<HanziSet | null>(null)
  const [items, setItems] = React.useState<HanziItem[]>([])
  const [reportedItems, setReportedItems] = React.useState<Set<number>>(new Set())
  const [stateById, setStateById] = React.useState<Record<number, 0 | 1 | 2>>({})
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reportModal, setReportModal] = React.useState<{ isOpen: boolean; itemId: number | null; itemLabel: string }>({ isOpen: false, itemId: null, itemLabel: "" })

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      const [setResult, itemsResult] = await Promise.all([
        supa.from("hanzi_sets").select("key, title, sub").eq("key", key).single(),
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

      const saved = window.localStorage.getItem(`hanzi_read_progress:${key}`)
      const completedIds = saved ? (JSON.parse(saved) as number[]) : []
      const restored = Object.fromEntries(completedIds.map((id) => [id, 2])) as Record<number, 0 | 1 | 2>

      setSet(setResult.data)
      setItems(itemsResult.data ?? [])
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
    <div className={styles.fullscreenContainer}>
      <PracticeHeader
        title={set.title}
        subtitle={set.sub}
        progress={progress}
        rightContent={`${completedCount}/${items.length}`}
        stats={{
          mastered: completedCount,
          rated: completedCount,
        }}
        showStats={true}
      />

      <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 pb-32 sm:px-6">
        <p className="rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground">Tap kalimat untuk membuka pinyin dan mendengar pelafalannya. Tap sekali lagi untuk melihat arti. Setelah terbuka penuh, tap lagi untuk mengulang audio.</p>
        {groups.map((group) => (
          <section key={`${group.tag}-${group.label}`}>
            <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{group.tag}</span>{group.label}</div>
            <div className="grid gap-3 md:grid-cols-2">
              {group.items.map((item, index) => {
                const state = stateById[item.id] ?? 0
                return (
                  <div key={item.id} className="relative group">
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
                    {!reportedItems.has(item.id) && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openReportModal(item) }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background border border-border/60 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Report kalimat"
                      >
                        <Flag className="h-3 w-3 text-orange-500" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
        {completedCount === items.length && items.length > 0 && (
          <div className="cumulative-finish flex flex-col items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
            <div className="cumulative-finish-emoji text-4xl">🎉</div>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">Semua kalimat telah dibaca.</p>
            <Button variant="outline" className="gap-2" onClick={resetProgress}><RotateCcw className="h-4 w-4" />Ulangi dari awal</Button>
          </div>
        )}
      </main>

      {/* Fixed Footer with Practice Button */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur p-4">
        <div className="mx-auto max-w-4xl">
          <Button onClick={navigateToSpeakingPractice} className="w-full" size="lg">
            <Mic className="h-5 w-5 mr-2" />
            Latihan Speaking
          </Button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .cumulative-finish { animation: cumulativeFinishEnter 520ms cubic-bezier(.22,1,.36,1) both; }
        .cumulative-finish-emoji { animation: cumulativeFinishPop 620ms cubic-bezier(.2,1.4,.4,1) 120ms both; }
        @keyframes cumulativeFinishEnter { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes cumulativeFinishPop { 0% { opacity: 0; transform: translateY(10px) scale(.6) rotate(-10deg); } 70% { opacity: 1; transform: translateY(0) scale(1.12) rotate(4deg); } 100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); } }
      `}} />

      {/* Report Modal */}
      <ReportModal
        isOpen={reportModal.isOpen}
        onClose={closeReportModal}
        contentType="kalimat"
        contentId={reportModal.itemId || 0}
        contentLabel={reportModal.itemLabel}
      />
    </div>
  )
}
