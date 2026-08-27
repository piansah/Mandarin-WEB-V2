/**
 * Shared utility for HSK / badge label & color styling.
 * Digunakan di search page, flashcard list, word detail, dll.
 */

export type BadgeInfo = {
  label: string
  /** Tailwind className untuk background, teks, dan border */
  className: string
}

const HSK_COLORS: Record<number, string> = {
  1: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  2: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  3: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  4: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  5: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  6: "bg-orange-500/15 text-orange-400 border-orange-500/30",
}

const COMMON_CLASS = "bg-teal-500/15 text-teal-400 border-teal-500/30"
const NATIVE_CLASS = "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30"
const DEFAULT_CLASS = "bg-muted/50 text-muted-foreground border-border/50"

/**
 * Mengembalikan label dan className Tailwind untuk badge kosakata.
 * @param hskLevel  Angka level HSK dari kolom hsk_level (lebih diutamakan)
 * @param badge     String badge dari kolom badge ("HSK 1", "common", "native", dll.)
 */
export function getHskBadgeInfo(
  hskLevel?: number | string | null,
  badge?: string | null
): BadgeInfo | null {
  // Priority 1: explicit hsk_level column
  const lvl = hskLevel ? Number(hskLevel) : NaN
  if (!Number.isNaN(lvl) && lvl >= 1 && lvl <= 6) {
    return { label: `HSK ${lvl}`, className: HSK_COLORS[lvl] ?? DEFAULT_CLASS }
  }

  // Priority 2: badge string  
  const norm = badge?.trim().toLowerCase() ?? ""
  const match = norm.match(/hsk\s*([1-6])/)
  if (match) {
    const n = Number(match[1])
    return { label: `HSK ${n}`, className: HSK_COLORS[n] ?? DEFAULT_CLASS }
  }
  if (norm === "common") return { label: "Common", className: COMMON_CLASS }
  if (norm === "native") return { label: "Native", className: NATIVE_CLASS }
  if (badge?.trim()) return { label: badge.trim(), className: DEFAULT_CLASS }

  return null
}
