import * as React from "react"
import { TrendingUp, Star, CheckCircle2 } from "lucide-react"

type PracticeHeaderProps = {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  progress?: number
  rightContent?: React.ReactNode
  stats?: {
    dueToday?: number
    totalCards?: number
    accuracy?: number
    mastered?: number
    rated?: number
  }
  showStats?: boolean
}

export function PracticeHeader({
  title,
  subtitle,
  progress,
  rightContent,
  stats,
  showStats = false,
}: PracticeHeaderProps) {
  return (
    <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm px-4 py-3 shrink-0 sticky top-0 z-20">
      <div className="mb-2">
        {title && (
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {showStats && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 p-3 rounded-xl bg-muted/30 border border-border/40">
          {stats.dueToday !== undefined && stats.totalCards !== undefined && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                Jatuh Tempo Hari Ini
              </div>
              <div className="flex items-center h-1.5">
                <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                  {stats.dueToday} dari {stats.totalCards} tersimpan
                </span>
              </div>
            </div>
          )}
          {stats.accuracy !== undefined && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                Akurasi Sesi
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${stats.accuracy}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-foreground">{stats.accuracy}%</span>
              </div>
            </div>
          )}
          {stats.mastered !== undefined && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Star className="h-3 w-3" />
                Sudah Dikuasai
              </div>
              <div className="text-sm font-semibold text-foreground">{stats.mastered}</div>
            </div>
          )}
          {stats.rated !== undefined && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                Dinilai
              </div>
              <div className="text-sm font-semibold text-foreground">{stats.rated}</div>
            </div>
          )}
        </div>
      )}

      {progress !== undefined && !showStats && (
        <div className="w-full h-1.5 bg-border/40 mt-3">
          <div
            className="h-full bg-emerald-500 transition-all duration-400 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}

      {rightContent && !showStats && (
        <div className="absolute top-4 right-4 flex-shrink-0 min-w-[38px] text-right text-[13px] font-bold text-emerald-500">
          {rightContent}
        </div>
      )}
    </div>
  )
}
