"use client"

import * as React from "react"
import { ChevronLeft, Eye, EyeOff, SkipForward, Volume2 } from "lucide-react"
import { WORD_CLASS_LABELS } from "@/lib/hanzi-utils"
import { speakMandarin } from "@/lib/tts"

type ShowcaseWord = {
  hanzi: string
  pinyin: string
  arti: string
  wordClass: keyof typeof WORD_CLASS_LABELS
}

const WORDS: ShowcaseWord[] = [
  { hanzi: "你好", pinyin: "nǐ hǎo", arti: "Halo", wordClass: "interj" },
  { hanzi: "谢谢", pinyin: "xièxiè", arti: "Terima kasih", wordClass: "verb" },
  { hanzi: "请", pinyin: "qǐng", arti: "Tolong / Silakan", wordClass: "adv" },
  { hanzi: "再见", pinyin: "zàijiàn", arti: "Sampai jumpa", wordClass: "interj" },
  { hanzi: "对不起", pinyin: "duìbuqǐ", arti: "Maaf", wordClass: "verb" },
  { hanzi: "没关系", pinyin: "méi guānxi", arti: "Tidak apa-apa", wordClass: "adj" },
]

type RatingKey = "lupa" | "sulit" | "ingat" | "mudah"

const RATINGS: {
  key: RatingKey
  num: number
  label: string
  days: string
  color: string
  bg: string
  border: string
}[] = [
    { key: "lupa", num: 1, label: "Lupa", days: "1 hari", color: "#F16565", bg: "rgba(241,101,101,0.08)", border: "rgba(241,101,101,0.28)" },
    { key: "sulit", num: 2, label: "Sulit", days: "1 hari", color: "#F2A94E", bg: "rgba(242,169,78,0.08)", border: "rgba(242,169,78,0.28)" },
    { key: "ingat", num: 3, label: "Ingat", days: "2 hari", color: "#5B9EF2", bg: "rgba(91,158,242,0.08)", border: "rgba(91,158,242,0.28)" },
    { key: "mudah", num: 4, label: "Mudah", days: "4 hari", color: "#3ECF8E", bg: "rgba(62,207,142,0.08)", border: "rgba(62,207,142,0.28)" },
  ]

const SWIPE_META: Record<RatingKey, { flyX: number; flyY: number; text: string }> = {
  lupa: { flyX: -420, flyY: 0, text: "LUPA ✕" },
  sulit: { flyX: 0, flyY: 420, text: "SULIT ?" },
  ingat: { flyX: 0, flyY: -420, text: "INGAT !" },
  mudah: { flyX: 420, flyY: 0, text: "MUDAH ✓" },
}

const SWIPE_THRESHOLD = 70
const TAP_THRESHOLD = 8

type FlashcardShowcaseProps = {
  // Label tombol Lanjutkan untuk mobile. Kalau diisi, komponen akan
  // merender tombol di bawah showcase dengan kelas `md:hidden` —
  // otomatis tersembunyi di desktop.
  continueLabel?: string
  // Callback saat tombol Lanjutkan ditekan.
  onContinue?: () => void
}

export const FlashcardShowcase = ({
  continueLabel,
  onContinue,
}: FlashcardShowcaseProps = {}) => {
  const [idx, setIdx] = React.useState(0)
  const [flipped, setFlipped] = React.useState(false)
  const [dragX, setDragX] = React.useState(0)
  const [dragY, setDragY] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const [flyOut, setFlyOut] = React.useState<{ x: number; y: number } | null>(null)
  const [activeRating, setActiveRating] = React.useState<RatingKey | null>(null)

  const startPos = React.useRef({ x: 0, y: 0 })
  const cardRef = React.useRef<HTMLDivElement>(null)

  // Guard pointer: hanya 1 pointer diproses + tap cuma toggle sekali.
  const pointerIdRef = React.useRef<number | null>(null)
  const tapHandledRef = React.useRef(false)

  const word = WORDS[idx]
  const wordClassLabel = WORD_CLASS_LABELS[word.wordClass] ?? word.wordClass

  const goToIndex = React.useCallback((next: number) => {
    setIdx(((next % WORDS.length) + WORDS.length) % WORDS.length)
    setFlipped(false)
    setDragX(0)
    setDragY(0)
    setActiveRating(null)
  }, [])

  const rate = React.useCallback(
    (key: RatingKey) => {
      if (flyOut) return
      setActiveRating(key)
      setIsDragging(false)
      const meta = SWIPE_META[key]
      setFlyOut({ x: meta.flyX, y: meta.flyY })
      window.setTimeout(() => {
        setFlyOut(null)
        setIdx((i) => ((i + 1) % WORDS.length))
        setFlipped(false)
        setDragX(0)
        setDragY(0)
        setActiveRating(null)
      }, 260)
    },
    [flyOut]
  )

  const hideAnswer = React.useCallback(() => setFlipped(false), [])
  const goPrev = React.useCallback(() => { if (!flyOut) goToIndex(idx - 1) }, [flyOut, goToIndex, idx])
  const skip = React.useCallback(() => { if (!flyOut) goToIndex(idx + 1) }, [flyOut, goToIndex, idx])

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return
      if (flyOut) return

      if (e.code === "Space") { e.preventDefault(); setFlipped(true); return }
      if (e.key === "1") { rate("lupa"); return }
      if (e.key === "2") { rate("sulit"); return }
      if (e.key === "3") { rate("ingat"); return }
      if (e.key === "4") { rate("mudah"); return }
      if (e.key === "ArrowLeft") { goPrev(); return }
      if (e.key === "ArrowRight") { skip(); return }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [flyOut, rate, goPrev, skip])

  function onPointerDown(e: React.PointerEvent) {
    if (flyOut) return
    if (pointerIdRef.current !== null) return
    e.preventDefault()

    pointerIdRef.current = e.pointerId
    tapHandledRef.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    setIsDragging(true)
    cardRef.current?.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging || flyOut) return
    if (e.pointerId !== pointerIdRef.current) return

    const nextX = e.clientX - startPos.current.x
    const nextY = e.clientY - startPos.current.y

    // Auto-buka kartu saat drag melewati ambang, supaya user lihat
    // jawaban dulu sebelum menilai lewat swipe.
    if (Math.abs(nextX) > 14 || Math.abs(nextY) > 14) {
      setFlipped(true)
    }

    setDragX(nextX)
    setDragY(nextY)
  }

  function onPointerUp(e: React.PointerEvent) {
    if (e.pointerId !== pointerIdRef.current) return
    pointerIdRef.current = null

    try {
      cardRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    if (!isDragging || flyOut) return
    setIsDragging(false)

    const absX = Math.abs(dragX)
    const absY = Math.abs(dragY)

    // Tap ringan → toggle flip
    if (absX < TAP_THRESHOLD && absY < TAP_THRESHOLD) {
      if (!tapHandledRef.current) {
        tapHandledRef.current = true
        if (!flipped) {
          speakMandarin(WORDS[idx].hanzi)
        }
        setFlipped((f) => !f)
      }
      setDragX(0)
      setDragY(0)
      return
    }

    // Swipe hanya menilai kalau kartu sudah dibuka
    if (!flipped) {
      setDragX(0)
      setDragY(0)
      return
    }

    if (absY > absX && absY > SWIPE_THRESHOLD) {
      rate(dragY > 0 ? "sulit" : "ingat")
      return
    }
    if (absX > absY && absX > SWIPE_THRESHOLD) {
      rate(dragX > 0 ? "mudah" : "lupa")
      return
    }

    setDragX(0)
    setDragY(0)
  }

  function onPointerCancel(e: React.PointerEvent) {
    if (e.pointerId !== pointerIdRef.current) return
    pointerIdRef.current = null
    setIsDragging(false)
    setDragX(0)
    setDragY(0)
  }

  let previewKey: RatingKey | null = null
  const absX = Math.abs(dragX)
  const absY = Math.abs(dragY)
  if (isDragging && flipped && (absX > 24 || absY > 24)) {
    previewKey = absY > absX ? (dragY > 0 ? "sulit" : "ingat") : (dragX > 0 ? "mudah" : "lupa")
  }
  const previewMeta = previewKey ? SWIPE_META[previewKey] : null
  const previewRating = previewKey ? RATINGS.find((r) => r.key === previewKey) : null
  const previewOpacity = previewKey ? Math.min(1, Math.max(absX, absY) / 100) : 0

  return (
    <div className="w-full flex flex-col gap-3.5 select-none">
      {/* KARTU */}
      <div className="relative w-full max-w-[300px] mx-auto">
        {/* kartu "hantu" di belakang untuk efek tumpukan */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-[24px] bg-[#141B24] border border-[#212B36] pointer-events-none"
          style={{ transform: "translateY(14px) scale(0.95)", opacity: 0.5 }}
        />
        <div
          aria-hidden
          className="absolute inset-0 rounded-[24px] bg-[#141B24] border border-[#212B36] pointer-events-none"
          style={{ transform: "translateY(7px) scale(0.975)", opacity: 0.75 }}
        />

        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClick={(e) => e.stopPropagation()}
          className="relative h-[250px] rounded-[24px] shadow-[0_30px_60px_-25px_rgba(0,0,0,0.75)] cursor-pointer touch-none"
          style={{
            transform: flyOut
              ? `translate(${flyOut.x}px, ${flyOut.y}px) rotate(${flyOut.x * 0.05}deg)`
              : isDragging
                ? `translate(${dragX}px, ${dragY}px) rotate(${dragX / 22}deg)`
                : "translate(0px, 0px) rotate(0deg)",
            opacity: flyOut ? 0 : 1,
            transition: isDragging
              ? "none"
              : flyOut
                ? "transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease"
                : "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
            touchAction: "none",
            willChange: isDragging ? "transform" : "auto",
          }}
        >
          {/* SISI DEPAN — hanya hanzi */}
          <div
            className="absolute inset-0 rounded-[24px] bg-[#141B24] border border-[#212B36] overflow-hidden flex flex-col p-5"
            style={{
              opacity: flipped ? 0 : 1,
              transform: flipped ? "scale(0.96)" : "scale(1)",
              transition: "opacity 0.25s ease, transform 0.25s ease",
              pointerEvents: flipped ? "none" : "auto",
            }}
          >
            <div
              aria-hidden
              className="absolute -right-6 -bottom-8 select-none pointer-events-none text-white/[0.05]"
              style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 130, lineHeight: 1, transform: "scaleX(-1) rotate(-8deg)" }}
            >
              {word.hanzi}
            </div>
            <span className="relative z-10 self-start text-[11px] font-medium text-[#9AA7B5] tracking-wide bg-white/5 px-2 py-0.5 rounded-full truncate max-w-full">
              {wordClassLabel}
            </span>
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-2 text-center">
              <div className="flex items-center justify-center gap-3 translate-x-3">
                <div
                  className="text-[52px] font-semibold text-white leading-none"
                  style={{ fontFamily: "'Noto Serif SC', serif" }}
                >
                  {word.hanzi}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    speakMandarin(word.hanzi)
                  }}
                  className="p-1.5 rounded-full hover:bg-white/10 text-[#9AA7B5] hover:text-white transition-colors cursor-pointer"
                  title="Dengarkan pengucapan"
                >
                  <Volume2 className="h-6 w-6" />
                </button>
              </div>
              <div className="text-[11px] text-[#5D6B7A] flex items-center gap-1.5 mt-1">
                <Eye className="h-3 w-3 shrink-0" />
                Klik kartu untuk lihat jawaban
              </div>
            </div>
          </div>

          {/* SISI BELAKANG — hanzi + pinyin + arti */}
          <div
            className="absolute inset-0 rounded-[24px] bg-[#141B24] border border-[#212B36] overflow-hidden flex flex-col p-5"
            style={{
              opacity: flipped ? 1 : 0,
              transform: flipped ? "scale(1)" : "scale(1.04)",
              transition: "opacity 0.25s ease, transform 0.25s ease",
              pointerEvents: flipped ? "auto" : "none",
            }}
          >
            <div
              aria-hidden
              className="absolute -right-6 -bottom-8 select-none pointer-events-none text-white/[0.05]"
              style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 130, lineHeight: 1, transform: "scaleX(-1) rotate(-8deg)" }}
            >
              {word.hanzi}
            </div>
            <span className="relative z-10 self-start text-[11px] font-medium text-[#9AA7B5] tracking-wide bg-white/5 px-2 py-0.5 rounded-full truncate max-w-full">
              {wordClassLabel}
            </span>
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-1.5 text-center">
              <div className="flex items-center justify-center gap-3 translate-x-3">
                <div
                  className="text-[34px] font-semibold text-white leading-none"
                  style={{ fontFamily: "'Noto Serif SC', serif" }}
                >
                  {word.hanzi}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    speakMandarin(word.hanzi)
                  }}
                  className="p-1.5 rounded-full hover:bg-white/10 text-[#9AA7B5] hover:text-white transition-colors cursor-pointer"
                  title="Dengarkan pengucapan"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
              <div className="text-sm text-[#9AA7B5] tracking-wide">{word.pinyin}</div>
              <div className="text-[15px] text-[#4FDDA5] font-semibold mt-1">{word.arti}</div>
            </div>
          </div>

          {/* Overlay preview swipe — hanya saat kartu sudah dibuka */}
          {previewMeta && previewRating && flipped && (
            <div
              className="absolute inset-0 rounded-[24px] flex items-center justify-center text-2xl font-bold tracking-wider pointer-events-none z-20"
              style={{
                background: `${previewRating.color}26`,
                border: `2px solid ${previewRating.color}66`,
                color: previewRating.color,
                opacity: previewOpacity,
              }}
            >
              {previewMeta.text}
            </div>
          )}
        </div>
      </div>

      {/* Sebelumnya / Sembunyi / Lewati */}
      <div className="grid grid-cols-3 gap-2 max-w-[300px] w-full mx-auto">
        <button
          type="button"
          onClick={goPrev}
          className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#10161D] text-[#9AA7B5] text-[11.5px] font-medium py-2 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" /> Sebelumnya
        </button>
        <button
          type="button"
          onClick={hideAnswer}
          className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#10161D] text-[#9AA7B5] text-[11.5px] font-medium py-2 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <EyeOff className="h-3.5 w-3.5 shrink-0" /> Sembunyi
        </button>
        <button
          type="button"
          onClick={skip}
          className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#10161D] text-[#9AA7B5] text-[11.5px] font-medium py-2 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          Lewati <SkipForward className="h-3.5 w-3.5 shrink-0" />
        </button>
      </div>

      <div className="text-center text-[12.5px] font-semibold text-white">
        Seberapa mudah kamu mengingatnya?
      </div>

      {/* Grid penilaian */}
      <div className="grid grid-cols-4 gap-1.5 max-w-[300px] w-full mx-auto">
        {RATINGS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => rate(r.key)}
            className="relative rounded-[10px] border px-1 py-1.5 text-center text-[10.5px] font-bold transition-all duration-200"
            style={{
              color: r.color,
              borderColor: activeRating === r.key ? r.color : r.border,
              background: activeRating === r.key ? "#141B24" : r.bg,
              transform: activeRating === r.key ? "translateY(-2px) scale(1.05)" : "none",
              boxShadow: activeRating === r.key ? `0 8px 16px -8px ${r.color}` : "none",
            }}
          >
            <span className="absolute top-1 right-1 flex items-center justify-center h-3.5 w-3.5 rounded-md bg-white/10 text-[8.5px] font-semibold text-[#9AA7B5]">
              {r.num}
            </span>
            {r.label}
            <span className="block text-[9px] font-medium text-[#5D6B7A] mt-0.5">{r.days}</span>
          </button>
        ))}
      </div>

      {/* Hint navigasi keyboard */}
      <p className="hidden xl:flex items-center justify-center gap-1.5 text-[10.5px] text-[#5D6B7A]">
        <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[9.5px]">1</kbd>
        <span>–</span>
        <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[9.5px]">4</kbd>
        <span>nilai</span>
        <span className="mx-1">·</span>
        <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[9.5px]">←</kbd>
        <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[9.5px]">→</kbd>
        <span>navigasi</span>
      </p>

      {/* Tombol Lanjutkan — hanya muncul kalau continueLabel diisi.
          `md:hidden` membuatnya otomatis tersembunyi di desktop. */}
      {continueLabel && (
        <button
          type="button"
          onClick={onContinue}
          className="md:hidden mx-auto inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold px-8 h-11 text-sm shadow-sm hover:opacity-90 transition-opacity"
        >
          {continueLabel}
        </button>
      )}
    </div>
  )
}