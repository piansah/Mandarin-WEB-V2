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
    // Pointer capture supaya move/up tetap kekirim ke elemen ini walau
    // jari/kursor sempat keluar dari batas elemen saat digeser cepat.
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

  function endDrag() {
    if (reported || !dragStartRef.current) return
    dragStartRef.current = null
    setIsDragging(false)
    const wasDrag = movedRef.current
    const shouldOpen = dragX <= -OPEN_THRESHOLD
    setOpen(shouldOpen)
    setDragX(shouldOpen ? -REVEAL_WIDTH : 0)
    // Kalau ini beneran gesture drag, browser bakal nembak event "click"
    // susulan tepat setelah pointerup ini (di elemen yang sama). Klik
    // susulan itu HARUS diabaikan di handleClickCapture — bukan dianggap
    // "user tap kartu untuk nutup" — makanya movedRef sengaja belum
    // direset di sini, baru direset di handleClickCapture.
    // Fallback: kalau ternyata event "click" itu nggak muncul sama
    // sekali (mis. browser malah ngirim pointercancel karena dianggap
    // scroll), movedRef tetap direset habis jeda singkat supaya tap
    // berikutnya nggak ke-suppress juga.
    if (wasDrag) {
      window.setTimeout(() => {
        movedRef.current = false
      }, 300)
    }
  }

  function handleClickCapture(e: React.MouseEvent) {
    if (movedRef.current) {
      // Ini klik bawaan browser yang otomatis muncul di akhir gesture
      // drag/swipe barusan — abaikan supaya reveal tombol report tidak
      // langsung balik nutup lagi sebelum sempat di-tap.
      e.preventDefault()
      e.stopPropagation()
      movedRef.current = false
      return
    }
    if (open) {
      // Tombol report sudah kebuka dan user tap area kartu (bukan
      // tombolnya) dengan gesture baru (bukan sisa drag) — anggap
      // sebagai batal, tutup lagi.
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
      {!reported && (
        <button
          type="button"
          onClick={handleReportClick}
          aria-label={reportLabel}
          title={reportLabel}
          className="absolute inset-y-0 right-0 z-10 flex items-center justify-center gap-1 bg-orange-500/15 text-orange-500 hover:bg-orange-500/25 transition-colors"
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