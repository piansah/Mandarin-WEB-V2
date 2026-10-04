"use client"

import * as React from "react"

type StrokeOrderDisplayProps = {
  char: string
}

// Warna tetap (bukan CSS variable): lembar latihan adalah "kertas putih"
// dan harus aman untuk html2canvas / cetak (tidak mendukung oklch).
const ACCENT = "#059669"
const PAST = "#9ca3af"
const BORDER = "#d1d5db"
const CELL = 48

// Cache modul: pindah kata / render ulang tidak fetch lagi
const strokeCache = new Map<string, string[]>()

async function loadStrokes(char: string): Promise<string[] | null> {
  const cached = strokeCache.get(char)
  if (cached) return cached
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(char)}.json`
    )
    if (!res.ok) throw new Error("Character not found")
    const data = await res.json()
    const strokes: string[] = Array.isArray(data.strokes) ? data.strokes : []
    if (strokes.length === 0) return null
    strokeCache.set(char, strokes)
    return strokes
  } catch (error) {
    console.error("Error loading stroke data:", error)
    return null // kegagalan tidak di-cache supaya bisa dicoba lagi
  }
}

export function StrokeOrderDisplay({ char }: StrokeOrderDisplayProps) {
  const [loading, setLoading] = React.useState(!strokeCache.has(char))
  const [strokes, setStrokes] = React.useState<string[] | null>(strokeCache.get(char) ?? null)

  React.useEffect(() => {
    let cancelled = false
    const cached = strokeCache.get(char)
    if (cached) {
      setStrokes(cached)
      setLoading(false)
      return
    }
    setLoading(true)
    loadStrokes(char).then((result) => {
      if (cancelled) return
      setStrokes(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [char])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
      </div>
    )
  }

  if (!strokes) {
    return (
      <div style={{ color: "#6b7280" }} className="text-sm py-4">
        Data goresan tidak tersedia untuk karakter ini
      </div>
    )
  }

  return (
    <div className="flex flex-wrap" style={{ gap: 8 }}>
      {strokes.map((_, i) => (
        <div
          key={i}
          style={{
            width: CELL,
            height: CELL,
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            background: "#ffffff",
          }}
        >
          <svg width={CELL} height={CELL} viewBox="0 0 1024 1024">
            {/* Data hanzi-writer: sumbu Y terbalik, harus di-flip */}
            <g transform="scale(1, -1) translate(0, -900)">
              {strokes.slice(0, i + 1).map((d, j) => (
                <path key={j} d={d} fill={j === i ? ACCENT : PAST} />
              ))}
            </g>
          </svg>
        </div>
      ))}
    </div>
  )
}