"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TonePinyin } from "@/components/tone-pinyin"
import { createClient } from "@/lib/supabase/browser"
import { speakMandarin } from "@/lib/tts"

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
}

export default function CumulativeFlashcardSessionPage() {
  const params = useParams<{ key: string }>()
  const router = useRouter()
  const key = params.key
  const [set, setSet] = React.useState<HanziSet | null>(null)
  const [items, setItems] = React.useState<HanziItem[]>([])
  const [stateById, setStateById] = React.useState<Record<number, 0 | 1 | 2>>({})
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const supa = createClient()

    async function load() {
      const [setResult, itemsResult] = await Promise.all([
        supa.from("hanzi_sets").select("key, title, sub").eq("key", key).single(),
        supa
          .from("hanzi_items")
          .select("id, section_label, section_tag, sort_order, hanzi, pinyin, arti")
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
      return updated
    })
  }

  function resetProgress() {
    window.localStorage.removeItem(`hanzi_read_progress:${key}`)
    setStateById({})
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (loading) return <div className="flex flex-1 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  if (error || !set) return <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6"><p className="text-sm text-red-400">{error ?? "Set kalimat tidak ditemukan."}</p><Button variant="outline" onClick={() => router.push("/dashboard/flashcard/cumulative")}>Kembali</Button></div>

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1"><h1 className="truncate text-base font-bold">{set.title}</h1><p className="truncate text-xs text-muted-foreground">{set.sub}</p></div>
          <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">{completedCount}/{items.length}</span>
        </div>
        <div className="h-1 bg-muted"><div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} /></div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 pb-12 sm:px-6">
        <p className="rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground">Tap kalimat untuk membuka pinyin dan mendengar pelafalannya. Tap sekali lagi untuk melihat arti. Setelah terbuka penuh, tap lagi untuk mengulang audio.</p>
        {groups.map((group) => (
          <section key={`${group.tag}-${group.label}`}>
            <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{group.tag}</span>{group.label}</div>
            <div className="grid gap-3 md:grid-cols-2">
              {group.items.map((item, index) => {
                const state = stateById[item.id] ?? 0
                return <button key={item.id} type="button" onClick={() => advance(item)} className={`min-h-36 rounded-xl border p-4 text-left transition-colors ${state === 2 ? "border-emerald-500/40 bg-emerald-500/5" : state === 1 ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card hover:border-primary/40"}`}>
                  <div className="flex items-start justify-between gap-3"><div className="font-hanzi text-2xl leading-relaxed text-foreground">{item.hanzi}</div><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">{index + 1}</span></div>
                  {state >= 1 && <TonePinyin text={item.pinyin} className="mt-2 text-sm font-medium" />}
                  {state >= 2 && <div className="mt-3 border-t border-border/60 pt-3 text-sm leading-relaxed text-muted-foreground">{item.arti}</div>}
                  {state === 0 && <p className="mt-3 text-xs text-muted-foreground/70">Tap untuk buka</p>}
                </button>
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
      <style dangerouslySetInnerHTML={{__html: `
        .cumulative-finish { animation: cumulativeFinishEnter 520ms cubic-bezier(.22,1,.36,1) both; }
        .cumulative-finish-emoji { animation: cumulativeFinishPop 620ms cubic-bezier(.2,1.4,.4,1) 120ms both; }
        @keyframes cumulativeFinishEnter { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes cumulativeFinishPop { 0% { opacity: 0; transform: translateY(10px) scale(.6) rotate(-10deg); } 70% { opacity: 1; transform: translateY(0) scale(1.12) rotate(4deg); } 100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); } }
      `}} />
    </div>
  )
}
