"use client"

import * as React from "react"
import { Flag } from "lucide-react"
import { cn } from "@/lib/utils"

// Lebar tombol report yang muncul di sebelah kanan card. Card + tombol
// sama-sama diletakkan di satu "track" flex yang lebih lebar dari
// container (overflow-hidden) — geser track ke kiri utk memunculkan
// tombolnya. Ini dipilih dibanding "tombol absolute di belakang card +
// translateX" supaya tombolnya betul-betul ada di document flow (bukan
// cuma keliatan lewat celah hasil transform), jadi nggak ada ambiguitas
// hit-testing/stacking yang bikin klik-nya nggak kena.
const REVEAL_WIDTH = 76
const OPEN_THRESHOLD = REVEAL_WIDTH / 2

type SwipeToReportProps = {
  children: React.ReactNode
  onReport: () => void
  /** Kalau true, kartu sudah pernah di-report — tombol report disembunyikan & swipe dimatikan. */
  reported?: boolean
  className?: string
  reportLabel?: string
}

export function SwipeToReport({ children, onReport, reported = false, className, reportLabel = "Laporkan kalimat" }: SwipeToReportProps) {
  const [dragX, setDragX] = React.useState(0)
  const [open, setOpen] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStartRef = React.useRef<{ x: number; base: number } | null>(null)
  const movedRef = React.useRef(false)

  React.useEffect(() => {
    if (reported) {
      setOpen(false)
      setDragX(0)
    }
  }, [reported])

  function close() {
    setOpen(false)
    setDragX(0)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (reported) return
    dragStartRef.current = { x: e.clientX, base: dragX }
    movedRef.current = false
    setIsDragging(true)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Sebagian browser lama nolak elemen non-form — aman diabaikan.
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reported || !dragStartRef.current) return
    const delta = e.clientX - dragStartRef.current.x
    if (Math.abs(delta) > 4) movedRef.current = true
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, dragStartRef.current.base + delta))
    setDragX(next)
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (reported || !dragStartRef.current) return
    dragStartRef.current = null
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // no-op
    }
    const wasDrag = movedRef.current
    const shouldOpen = dragX <= -OPEN_THRESHOLD
    setOpen(shouldOpen)
    setDragX(shouldOpen ? -REVEAL_WIDTH : 0)
    // Kalau ini beneran gesture drag, browser bakal nembak event "click"
    // susulan tepat setelah pointerup ini (di elemen yang sama). Klik
    // susulan itu HARUS diabaikan di handleClickCapture — bukan dianggap
    // "user tap kartu untuk nutup" — makanya movedRef sengaja belum
    // direset di sini, baru direset di handleClickCapture. Fallback:
    // kalau ternyata event "click" itu nggak muncul sama sekali (mis.
    // browser malah ngirim pointercancel), movedRef tetap direset habis
    // jeda singkat supaya tap berikutnya nggak ke-suppress juga.
    if (wasDrag) {
      window.setTimeout(() => {
        movedRef.current = false
      }, 300)
    }
  }

  function handleClickCapture(e: React.MouseEvent) {
    if (movedRef.current) {
      e.preventDefault()
      e.stopPropagation()
      movedRef.current = false
      return
    }
    if (open) {
      // Card lagi kebuka (reveal tombol report) dan user tap area
      // kartunya (bukan tombolnya) dengan gesture baru — anggap sebagai
      // batal, tutup lagi.
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }

  function handleReportClick(e: React.MouseEvent) {
    e.stopPropagation()
    onReport()
    close()
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <div
        className="flex items-stretch"
        style={{
          width: `calc(100% + ${REVEAL_WIDTH}px)`,
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform 200ms ease",
        }}
      >
        {/* Card asli — cuma elemen ini yang boleh mulai drag / kena
            suppress-click, supaya tombol report di sebelahnya selalu
            independen dan pasti bisa diklik. */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={handleClickCapture}
          className="relative touch-pan-y bg-background"
          style={{ width: "100%", flexShrink: 0 }}
        >
          {children}
        </div>

        {/* Tombol report — sungguhan ada di document flow di sebelah
            kanan card, bukan cuma "keliatan lewat celah transform", jadi
            selalu bisa diklik begitu ke-reveal. */}
        {!reported && (
          <button
            type="button"
            onClick={handleReportClick}
            aria-label={reportLabel}
            title={reportLabel}
            className="flex flex-col items-center justify-center gap-1 bg-orange-500/15 text-orange-500 hover:bg-orange-500/25 active:bg-orange-500/30 transition-colors"
            style={{ width: REVEAL_WIDTH, flexShrink: 0 }}
          >
            <Flag className="h-4 w-4" />
            <span className="text-[10px] font-medium">Report</span>
          </button>
        )}
      </div>
    </div>
  )
}
