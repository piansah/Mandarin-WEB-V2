"use client"

import * as React from "react"
import { ChevronDown, Lock } from "lucide-react"

export function HskLevelFilter({
  levels,
  selectedLevel,
  onChange,
  label,
  unlockedLevels,
}: {
  levels: number[]
  selectedLevel: number
  onChange: (level: number) => void
  /** Judul di kiri, default "HSK {selectedLevel}" */
  label?: string
  /**
   * Level HSK yang sudah terbuka (tier-unlock). Kalau di-omit, semua level
   * dianggap terbuka (perilaku lama, dipakai di tempat yang belum
   * memakai tier-unlock). `undefined` selama masih loading — filter tetap
   * tampil tanpa gembok sampai data unlocked_tiers datang.
   */
  unlockedLevels?: number[]
}) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const filterRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsidePress)
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress)
  }, [])

  const isLocked = (level: number) => !!unlockedLevels && !unlockedLevels.includes(level)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {label ?? `HSK ${selectedLevel}`}
      </h2>
      <div ref={filterRef} className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
          onClick={() => setMenuOpen((open) => !open)}
        >
          HSK {selectedLevel}
          <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
        {menuOpen && (
          <div
            role="listbox"
            className="absolute right-0 z-20 mt-2 min-w-36 overflow-hidden rounded-xl border border-border/70 bg-card p-1 shadow-xl shadow-black/20"
          >
            {levels.map((level) => {
              const locked = isLocked(level)
              return (
                <button
                  key={level}
                  type="button"
                  role="option"
                  aria-selected={selectedLevel === level}
                  aria-disabled={locked}
                  title={locked ? "Selesaikan tier sebelumnya untuk membuka level ini" : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    selectedLevel === level
                      ? "bg-primary text-primary-foreground"
                      : locked
                        ? "cursor-not-allowed text-muted-foreground/60"
                        : "text-foreground hover:bg-muted"
                  }`}
                  onClick={() => {
                    if (locked) return
                    onChange(level)
                    setMenuOpen(false)
                  }}
                >
                  HSK {level}
                  {locked && <Lock className="h-3 w-3 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
