import * as React from "react"
import { ChevronDown } from "lucide-react"

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
  /**
   * Jika true dan stats > 2:
   * Menampilkan tampilan ringkas (hanya 2 statistik teratas).
   * Pengguna dapat mengklik kartu statistik untuk memperpanjang/menampilkan seluruh statistik.
   */
  collapsibleStats?: boolean
  defaultExpanded?: boolean
  /**
   * Opsional: kontrol ringkas (tombol/ikon) yang muncul di pojok kanan,
   * sejajar dengan title/subtitle — bukan di bawah progress bar. Beda dari
   * `rightContent` yang khusus teks skor kecil ("8/10"); ini buat konten
   * bebas seperti grup tombol (mis. play/speed di mode baca).
   */
  headerActions?: React.ReactNode
  /**
   * Opsional: baris kontrol tambahan spesifik halaman, dirender di bawah
   * progress bar, selebar header. Dipakai kalau kontrolnya tidak muat/tidak
   * cocok ditaruh di pojok bareng title (lihat `headerActions`).
   */
  children?: React.ReactNode
}

export function PracticeHeader({
  title,
  subtitle,
  progress,
  rightContent,
  stats,
  showStats = false,
  collapsibleStats = false,
  defaultExpanded = false,
  headerActions,
  children,
}: PracticeHeaderProps) {
  const isCollapsible = Boolean(collapsibleStats && stats && stats.length > 2)
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded)

  const desktopGridColsClass =
    !stats || stats.length <= 1
      ? "md:grid-cols-1"
      : stats.length === 2
        ? "md:grid-cols-2"
        : stats.length === 3
          ? "md:grid-cols-3"
          : "md:grid-cols-4"

  const mobileGridColsClass =
    !stats || stats.length <= 1
      ? "grid-cols-1"
      : stats.length === 2
        ? "grid-cols-2"
        : stats.length === 3
          ? "grid-cols-3"
          : "grid-cols-2"

  const renderStatItem = (stat: PracticeHeaderStat, index: number) => {
    const Icon = stat.icon
    return (
      <div
        key={index}
        className="flex flex-col items-center text-center gap-1 transition-all duration-300 hover:-translate-y-px"
      >
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {Icon && <Icon className="h-3 w-3" />}
          {stat.label}
        </div>
        {stat.progressPercent !== undefined ? (
          <div className="flex items-center gap-2 w-full max-w-[140px] justify-center">
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
  }

  return (
    <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm px-4 py-2 shrink-0 sticky top-0 z-20">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {title && (
            <h1 className="text-lg font-bold text-foreground truncate">{title}</h1>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        {headerActions && (
          <div className="flex-shrink-0">{headerActions}</div>
        )}
      </div>

      {showStats && stats && stats.length > 0 && (
        <>
          {/* Tampilan Desktop (md ke atas): selalu normal, 1 baris semua point nilai */}
          <div className={`hidden md:grid ${desktopGridColsClass} gap-3 mt-2 p-3 rounded-xl bg-muted/30 border border-border/40`}>
            {stats.map((stat, i) => renderStatItem(stat, i))}
          </div>

          {/* Tampilan Mobile (< md): collapsible jika collapsibleStats aktif */}
          <div className="block md:hidden">
            {isCollapsible ? (
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Perkecil tampilan statistik" : "Tampilkan semua statistik"}
                title={isExpanded ? "Klik untuk memperingkas statistik" : "Klik untuk menampilkan semua statistik"}
                onClick={() => setIsExpanded((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setIsExpanded((prev) => !prev)
                  }
                }}
                className="group mt-2 p-2.5 sm:p-3 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/40 hover:border-border/60 transition-all duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {/* 2 stat teratas selalu tampil */}
                <div className="grid grid-cols-2 gap-3">
                  {stats.slice(0, 2).map((stat, i) => renderStatItem(stat, i))}
                </div>

                {/* Stat tambahan yang expandable (memanjang ke bawah saat diklik) */}
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    isExpanded
                      ? "grid-rows-[1fr] opacity-100 mt-2.5 pt-2.5 border-t border-border/30"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="grid grid-cols-2 gap-3">
                      {stats.slice(2).map((stat, i) => renderStatItem(stat, i + 2))}
                    </div>
                  </div>
                </div>

                {/* Indikator chevron untuk klik/expand */}
                <div className="flex items-center justify-center pt-1.5 -mb-0.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-300 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>
            ) : (
              <div className={`grid ${mobileGridColsClass} gap-3 mt-2 p-3 rounded-xl bg-muted/30 border border-border/40`}>
                {stats.map((stat, i) => renderStatItem(stat, i))}
              </div>
            )}
          </div>
        </>
      )}

      {progress !== undefined && !showStats && (
        <div className="w-full h-1.5 bg-border/40 mt-2">
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

      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}
