"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import styles from "./streak-celebration.module.css"

const CONFETTI_COLORS = ["#ffb4b1", "#9160ff", "#e4aa8b", "#82c881", "#e7ad00"]
const CONFETTI = Array.from({ length: 34 }, (_, index) => ({
  left: `${(index * 47 + 3) % 100}%`,
  top: `${(index * 73 + 8) % 100}%`,
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  delay: `${(index % 11) * -0.37}s`,
  duration: `${5 + (index % 6)}s`,
  rotation: `${(index * 31) % 180}deg`,
}))

export function StreakCelebration() {
  const [streak, setStreak] = React.useState<number | null>(null)
  const open = streak !== null

  React.useEffect(() => {
    const handleCelebration = (event: Event) => {
      const detail = (event as CustomEvent<{ streak?: number }>).detail
      if (typeof detail?.streak === "number" && detail.streak > 0) setStreak(detail.streak)
    }

    window.addEventListener("mandarin:streak-celebration", handleCelebration)
    return () => window.removeEventListener("mandarin:streak-celebration", handleCelebration)
  }, [])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) setStreak(null) }}>
      <DialogContent
        showCloseButton={false}
        className="!fixed !inset-0 !left-0 !top-0 !z-[100] !grid !h-dvh !w-screen !max-w-none !-translate-x-0 !-translate-y-0 !gap-0 !overflow-hidden !rounded-none !border-0 !bg-[#100e0d] !p-0 !text-white !ring-0 !duration-300"
      >
        <DialogTitle className="sr-only">Streak belajar bertambah</DialogTitle>
        <DialogDescription className="sr-only">
          Kamu sudah belajar {streak ?? 0} hari berturut-turut.
        </DialogDescription>

        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(130,70,12,0.3)_0%,rgba(16,14,13,0)_48%)]" />
          {CONFETTI.map((piece, index) => (
            <span
              key={index}
              className={styles.confetti}
              style={{
                left: piece.left,
                top: piece.top,
                backgroundColor: piece.color,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                transform: `rotate(${piece.rotation})`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 text-5xl leading-none" aria-hidden="true">🔥</div>
          <p className="font-heading text-7xl font-bold leading-none text-[#ff963f] sm:text-8xl">
            {streak}
          </p>
          <h2 className="mt-3 font-heading text-2xl font-bold text-[#ff963f] sm:text-3xl">
            hari beruntun!
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#b6a49d] sm:text-base">
            {streak === 1
              ? "Api pertamamu menyala. Belajar lagi besok supaya terus menyala."
              : "Kebiasaan belajarmu terus menyala. Belajar lagi besok untuk menjaga streak ini."}
          </p>
          <Button
            onClick={() => setStreak(null)}
            className="mt-8 h-14 w-full max-w-sm rounded-2xl bg-[#ffb4b1] text-base font-semibold text-[#351b19] shadow-[0_4px_0_#c9817e] hover:bg-[#ffc3c0] active:translate-y-0.5 active:shadow-[0_2px_0_#c9817e]"
          >
            Lanjutkan
          </Button>
          <div className="sr-only" aria-live="polite">Streak kamu sekarang {streak} hari.</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
