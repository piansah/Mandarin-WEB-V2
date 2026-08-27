import { getHskBadgeInfo } from "@/lib/hsk-badge"

interface HskBadgeProps {
  hskLevel?: number | string | null
  badge?: string | null
  className?: string
}

/**
 * Badge pill untuk kosakata dengan warna berbeda per level HSK,
 * serta Common dan Native.
 */
export function HskBadge({ hskLevel, badge, className = "" }: HskBadgeProps) {
  const info = getHskBadgeInfo(hskLevel, badge)
  if (!info) return null
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${info.className} ${className}`}
    >
      {info.label}
    </span>
  )
}
