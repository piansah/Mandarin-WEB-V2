"use client"

import * as React from "react"
import { Flag, Heart } from "lucide-react"
import { cn } from "@/lib/utils"

// Lebar area tombol report yang tersembunyi di belakang card. Diseret ke
// kiri (mouse drag / swipe jari) untuk memunculkannya — polanya sama
// seperti "swipe to reveal action" di aplikasi chat/email.
const REVEAL_WIDTH = 96
const OPEN_THRESHOLD = REVEAL_WIDTH / 2

type SwipeToReportProps = {
  children: React.ReactNode
  onReport?: () => void
  onFavorite?: () => void
  favorited?: boolean
  /** Kalau true, kartu sudah pernah di-report — tombol report disembunyikan & swipe dimatikan. */
  reported?: boolean
  className?: string
  reportLabel?: string
}

export function SwipeToReport({ children, onReport, onFavorite, favorited = false, reported = false, className, reportLabel = "Laporkan kalimat" }: SwipeToReportProps) {
  const actionMode = onFavorite ? "favorite" : "report"
  const actionLabel = actionMode === "favorite"
    ? favorited ? "Hapus dari favorit" : "Tambah ke favorit"
    : reportLabel
  const [dragX, setDragX] = React.useState(0)
  const [open, setOpen] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStartRef = React.useRef<{ x: number; base: number; pointerId: number } | null>(null)
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
    // Cuma catat titik awal & pointerId di sini — TIDAK langsung capture.
    // FIX: sebelumnya setPointerCapture dipanggil di pointerdown untuk
    // SETIAP interaksi (termasuk tap biasa tanpa gerakan sama sekali).
    // Di sejumlah browser/webview, pointer capture yang diaktifkan sejak
    // pointerdown bisa bikin event "click" susulan gagal disintesis kalau
    // pointerup terjadi persis di titik yang sama (tap murni) — hasilnya
    // kartu terasa "tidak bisa di-tap" walau tombol report/swipe sendiri
    // tidak pernah dipakai. Sekarang capture baru diaktifkan belakangan,
    // di handlePointerMove, dan HANYA kalau gerakan horizontal sudah
    // melewati ambang batas (baru dianggap gesture geser beneran) — tap
    // biasa jadi tidak pernah menyentuh setPointerCapture sama sekali.
    dragStartRef.current = { x: e.clientX, base: dragX, pointerId: e.pointerId }
    movedRef.current = false
    setIsDragging(true)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reported || !dragStartRef.current) return
    const delta = e.clientX - dragStartRef.current.x
    if (Math.abs(delta) > 4 && !movedRef.current) {
      movedRef.current = true
      // Baru capture pointer begitu gerakan geser terkonfirmasi, supaya
      // move/up berikutnya tetap kekirim ke elemen ini walau jari/kursor
      // sempat keluar dari batas elemen.
      try {
        e.currentTarget.setPointerCapture(dragStartRef.current.pointerId)
      } catch {
        // Sebagian browser lama nolak elemen non-form — aman diabaikan.
      }
    }
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
    if (actionMode === "favorite") onFavorite?.()
    else onReport?.()
    close()
  }

  return (
    <div className={cn("relative overflow-visible rounded-xl", className)}>
      {!reported && (
        <button
          type="button"
          data-bottom-accent="off"
          onClick={handleReportClick}
          aria-label={actionLabel}
          title={actionLabel}
          className={`absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 rounded-r-xl transition-colors ${actionMode === "favorite" ? "bg-rose-500/15 text-rose-500 hover:bg-rose-500/25" : "bg-orange-500/15 text-orange-500 hover:bg-orange-500/25"}`}
          // z-index cuma dinaikkan pas kartu lagi/sudah kebuka, supaya tombol
          // menang hit-test dari kartu yang masih animasi geser (200ms) atau
          // ada overlap 1px akibat pembulatan subpixel. Pas kartu ketutup,
          // z-index dibiarkan default (0) supaya kartu tetap nutupin tombol
          // sepenuhnya secara visual — nggak nembus/transparan lagi.
          style={{ width: REVEAL_WIDTH, zIndex: open ? 10 : 0 }}
        >
          {actionMode === "favorite" ? <Heart className="h-4 w-4" fill={favorited ? "currentColor" : "none"} /> : <Flag className="h-4 w-4" />}
          <span className="text-[10px] font-medium">{actionMode === "favorite" ? favorited ? "Disukai" : "Suka" : "Report"}</span>
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
