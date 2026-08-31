import * as React from "react"

/**
 * Satu cell statistik di dalam header. Dulu bentuk statistik ini di-hardcode
 * (dueToday/totalCards/accuracy/mastered/rated) sehingga tiap halaman yang
 * butuh statistik lain (mis. "Beruntun", "Sisa Soal" di practice/nada &
 * practice/tulis) terpaksa nulis ulang seluruh markup header secara manual.
 * Sekarang stat cell dibuat generik supaya semua pemakai — quiz, grammar,
 * flashcard biasa, flashcard kumulatif, nada, tulis — bisa pakai komponen
 * yang sama persis.
 */
export type PracticeHeaderStat = {
  icon?: React.ComponentType<{ className?: string }>
  label: React.ReactNode
  value: React.ReactNode
  /** 0-100. Kalau diisi, value ditampilkan sebagai progress bar mini (mis. akurasi). */
  progressPercent?: number
}

type PracticeHeaderProps = {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  progress?: number
  rightContent?: React.ReactNode
  stats?: PracticeHeaderStat[]
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
  const gridColsClass =
    !stats || stats.length <= 1
      ? "grid-cols-1"
      : stats.length === 2
        ? "grid-cols-2"
        : stats.length === 3
          ? "grid-cols-3"
          : "grid-cols-2 md:grid-cols-4"

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

      {showStats && stats && stats.length > 0 && (
        <div className={`grid ${gridColsClass} gap-3 mt-3 p-3 rounded-xl bg-muted/30 border border-border/40`}>
          {stats.map((stat, i) => {
            const Icon = stat.icon
            return (
              <div
                key={i}
                className="flex flex-col gap-1 transition-all duration-300 hover:-translate-y-px hover:shadow-md"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {Icon && <Icon className="h-3 w-3" />}
                  {stat.label}
                </div>
                {stat.progressPercent !== undefined ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, stat.progressPercent))}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground">{stat.value}</span>
                  </div>
                ) : (
                  <div className="text-sm font-semibold text-foreground">{stat.value}</div>
                )}
              </div>
            )
          })}
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
