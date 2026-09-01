"use client"

import * as React from "react"
import { Flag } from "lucide-react"
import { cn } from "@/lib/utils"

// Lebar area tombol report yang tersembunyi di belakang card. Diseret ke
// kiri (mouse drag / swipe jari) untuk memunculkannya — polanya sama
// seperti "swipe to reveal action" di aplikasi chat/email.
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
    // Cuma track drag horizontal utk mouse/touch/pen; biarkan klik biasa lewat.
    dragStartRef.current = { x: e.clientX, base: dragX }
    movedRef.current = false
    setIsDragging(true)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reported || !dragStartRef.current) return
    const delta = e.clientX - dragStartRef.current.x
    if (Math.abs(delta) > 4) movedRef.current = true
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, dragStartRef.current.base + delta))
    setDragX(next)
  }

  function endDrag() {
    if (reported || !dragStartRef.current) return
    dragStartRef.current = null
    setIsDragging(false)
    const shouldOpen = dragX <= -OPEN_THRESHOLD
    setOpen(shouldOpen)
    setDragX(shouldOpen ? -REVEAL_WIDTH : 0)
  }

  function handleClickCapture(e: React.MouseEvent) {
    // Kalau lagi kebuka (nampilin tombol report) atau baru selesai
    // drag, klik pertama dipakai buat nutup dulu, bukan trigger aksi
    // kartu di baliknya.
    if (open || movedRef.current) {
      e.preventDefault()
      e.stopPropagation()
      if (open) close()
      movedRef.current = false
    }
  }

  function handleReportClick(e: React.MouseEvent) {
    e.stopPropagation()
    onReport()
    close()
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {!reported && (
        <button
          type="button"
          onClick={handleReportClick}
          aria-label={reportLabel}
          title={reportLabel}
          className="absolute inset-y-0 right-0 flex items-center justify-center gap-1 bg-orange-500/15 text-orange-500 hover:bg-orange-500/25 transition-colors"
          style={{ width: REVEAL_WIDTH }}
        >
          <Flag className="h-4 w-4" />
          <span className="text-[10px] font-medium">Report</span>
        </button>
      )}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={handleClickCapture}
        className="relative touch-pan-y bg-background"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform 200ms ease",
        }}
      >
        {children}
      </div>
    </div>
  )
}
