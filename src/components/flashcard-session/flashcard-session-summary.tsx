import * as React from "react"
import { useRouter } from "next/navigation"
import { Zap, Brain, HelpCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStudyTip } from "./utils"

type Props = {
  isEmpty: boolean
  emptyEmoji?: string
  emptyTitle?: string
  hafal: number
  sulit: number
  ragu: number
  lupa: number
  resultRingValue: number
  onRetry: () => void
}

export function FlashcardSessionSummary({
  isEmpty,
  emptyEmoji = "📭",
  emptyTitle = "Belum Ada Kartu",
  hafal,
  sulit,
  ragu,
  lupa,
  resultRingValue,
  onRetry
}: Props) {
  const router = useRouter()
  const totalRated = hafal + sulit + ragu + lupa
  const finalAccuracy = totalRated > 0 ? Math.round(((hafal + sulit) / totalRated) * 100) : 0
  const ringColor = finalAccuracy >= 80 ? "#34d399" : finalAccuracy >= 50 ? "#f59e0b" : "#f87171"
  const circumference = 2 * Math.PI * 54
  const ringOffset = circumference - (resultRingValue / 100) * circumference

  if (isEmpty) {
    return (
      <div className="flashcard-result relative flex flex-col flex-1 items-center justify-center gap-7 p-8 bg-background overflow-hidden min-h-0">
        <div className="flashcard-result-emoji text-6xl">{emptyEmoji}</div>
        <h2 className="flashcard-result-title text-3xl font-bold text-center">{emptyTitle}</h2>
        <Button variant="outline" className="rounded-2xl px-8" onClick={() => router.back()}>Kembali</Button>
      </div>
    )
  }

  return (
    <div className="flashcard-result relative flex flex-col flex-1 items-center justify-center gap-7 p-8 bg-background overflow-hidden min-h-0">
      <div
        aria-hidden="true"
        className="flashcard-result-watermark absolute select-none pointer-events-none font-hanzi text-foreground/[0.05] dark:text-foreground/[0.07]"
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

      <div className="flashcard-result-title flex flex-col items-center gap-1 relative z-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Sesi Selesai!</h2>
        <p className="text-sm text-muted-foreground">{totalRated} kata dinilai</p>
      </div>

      <div className="flashcard-result-ring relative z-10 flex items-center justify-center">
        <svg width="152" height="152" viewBox="0 0 120 120" className="-rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/60" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={ringColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={ringOffset}
            style={{ transition: "stroke 400ms ease" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-4xl font-bold text-foreground tabular-nums">{resultRingValue}%</span>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Akurasi</span>
        </div>
      </div>

      <div className="flashcard-result-stats flex flex-wrap justify-center gap-2 relative z-10">
        <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-500"><Zap className="h-3.5 w-3.5" /></span>
          <span className="text-sm font-semibold text-emerald-500 tabular-nums">{hafal}</span>
          <span className="text-xs text-muted-foreground">Mudah</span>
        </div>
        <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500/15 text-blue-500"><Brain className="h-3.5 w-3.5" /></span>
          <span className="text-sm font-semibold text-blue-500 tabular-nums">{sulit}</span>
          <span className="text-xs text-muted-foreground">Ingat</span>
        </div>
        <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/15 text-amber-500"><HelpCircle className="h-3.5 w-3.5" /></span>
          <span className="text-sm font-semibold text-amber-500 tabular-nums">{ragu}</span>
          <span className="text-xs text-muted-foreground">Sulit</span>
        </div>
        <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/25">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-red-500/15 text-red-500"><RotateCcw className="h-3.5 w-3.5" /></span>
          <span className="text-sm font-semibold text-red-500 tabular-nums">{lupa}</span>
          <span className="text-xs text-muted-foreground">Lupa</span>
        </div>
      </div>

      <div className="flashcard-result-actions relative z-10 w-full max-w-xs">
        <div className="mb-4 px-4 py-3 rounded-xl bg-muted/40 border border-border/40 text-xs text-muted-foreground text-center leading-relaxed">
          💡 {getStudyTip(finalAccuracy, lupa)}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-2xl h-11" onClick={() => router.back()}>Kembali</Button>
          <Button className="flex-1 rounded-2xl h-11 shadow-sm" onClick={onRetry}>Ulangi</Button>
        </div>
      </div>
    </div>
  )
}