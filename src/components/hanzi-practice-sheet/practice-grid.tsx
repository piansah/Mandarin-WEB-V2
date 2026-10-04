"use client"

import * as React from "react"

type PracticeGridProps = {
  char: string
  showGuide?: boolean
}

const GRID_COLS = 9
const GRID_ROWS = 8

// Warna tetap supaya aman untuk html2canvas / cetak
const BORDER = "#1f2937"
const CROSS = "#9ca3af"
const DIAGONAL = "#d1d5db"
const GUIDE_STROKE = "#e5e7eb"

// Cache stroke data
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
    return null
  }
}

export function PracticeGrid({ char, showGuide = true }: PracticeGridProps) {
  const totalBoxes = GRID_COLS * GRID_ROWS
  const [strokeData, setStrokeData] = React.useState<string[] | null>(null)

  React.useEffect(() => {
    if (showGuide) {
      loadStrokes(char).then(setStrokeData)
    }
  }, [char, showGuide])

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`, gap: 6 }}
    >
      {Array.from({ length: totalBoxes }).map((_, index) => (
        <TianZiGe 
          key={index} 
          showGuide={showGuide && index % GRID_COLS === 0}
          strokeData={strokeData}
        />
      ))}
    </div>
  )
}

function TianZiGe({ showGuide, strokeData }: { showGuide: boolean; strokeData: string[] | null }) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        border: `1.5px solid ${BORDER}`,
        background: "#ffffff",
      }}
    >
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* Garis silang tengah */}
        <line x1="50" y1="0" x2="50" y2="100" stroke={CROSS} strokeWidth="0.6" />
        <line x1="0" y1="50" x2="100" y2="50" stroke={CROSS} strokeWidth="0.6" />
        {/* Diagonal putus-putus */}
        <line x1="0" y1="0" x2="100" y2="100" stroke={DIAGONAL} strokeWidth="0.6" strokeDasharray="4 4" />
        <line x1="100" y1="0" x2="0" y2="100" stroke={DIAGONAL} strokeWidth="0.6" strokeDasharray="4 4" />
      </svg>
      {/* Karakter panduan berbasis goresan */}
      {showGuide && strokeData && (
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          viewBox="0 0 1024 1024"
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform="scale(1, -1) translate(0, -900)">
            {strokeData.map((d, i) => (
              <path key={i} d={d} fill={GUIDE_STROKE} />
            ))}
          </g>
        </svg>
      )}
    </div>
  )
}