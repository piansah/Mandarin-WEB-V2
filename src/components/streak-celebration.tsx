"use client"

import * as React from "react"
import { Flame } from "lucide-react"
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

function LayeredFlame({ className = "", size = "large" }: { className?: string; size?: "large" | "small" }) {
  return (
    <span role="img" aria-label="Api streak" className={`relative block shrink-0 ${size === "large" ? "h-20 w-20" : "h-16 w-16"} ${className}`}>
      <Flame aria-hidden="true" className="absolute inset-0 h-full w-full text-[#ed4936]" strokeWidth={2.2} />
      <Flame aria-hidden="true" className="absolute left-[9%] top-[5%] h-[82%] w-[82%] text-[#ff7a2f]" strokeWidth={2.2} />
    </span>
  )
}

export function StreakCelebration() {
  const [celebration, setCelebration] = React.useState<{ streak: number; phase: "ignite" | "reveal" } | null>(null)
  const open = celebration !== null
  const streak = celebration?.streak ?? 0
  const isRevealing = celebration?.phase === "reveal"

  React.useEffect(() => {
    if (!celebration || celebration.phase !== "ignite") return
    const timer = window.setTimeout(() => {
      setCelebration(current => current ? { ...current, phase: "reveal" } : null)
    }, 1300)
    return () => window.clearTimeout(timer)
  }, [celebration])

  React.useEffect(() => {
    const handleCelebration = (event: Event) => {
      const detail = (event as CustomEvent<{ streak?: number }>).detail
      if (typeof detail?.streak === "number" && detail.streak > 0) {
        setCelebration({ streak: detail.streak, phase: "ignite" })
      }
    }

    window.addEventListener("mandarin:streak-celebration", handleCelebration)
    return () => window.removeEventListener("mandarin:streak-celebration", handleCelebration)
  }, [])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) setCelebration(null) }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={isRevealing ? styles.revealBackdrop : styles.igniteBackdrop}
        className={`!fixed !inset-0 !left-0 !top-0 !z-[100] !grid !h-dvh !w-screen !max-w-none !-translate-x-0 !-translate-y-0 !gap-0 !overflow-hidden !rounded-none !border-0 !bg-transparent !p-0 !text-foreground !ring-0 !duration-300 ${isRevealing ? styles.revealPopup : styles.ignitePopup}`}
      >
        <DialogTitle className="sr-only">Streak belajar bertambah</DialogTitle>
        <DialogDescription className="sr-only">
          Kamu sudah belajar {streak ?? 0} hari berturut-turut.
        </DialogDescription>

        <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${isRevealing ? styles.revealGlow : ""}`}>
          {isRevealing && CONFETTI.map((piece, index) => (
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

        {!isRevealing ? (
          <div className="relative z-10 flex min-h-dvh items-center justify-center">
            <LayeredFlame className={styles.igniteFlame} />
            <span className="sr-only">Streak belajar bertambah</span>
          </div>
        ) : (
          <div className={`relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 text-center ${styles.revealContent}`}>
            <LayeredFlame size="small" className={`mb-4 ${styles.flameSettle}`} />
            <p className="font-heading text-7xl font-bold leading-none text-amber-600 dark:text-[#ff963f] sm:text-8xl">
              {streak}
            </p>
            <h2 className="mt-3 font-heading text-2xl font-bold text-amber-600 dark:text-[#ff963f] sm:text-3xl">
              hari beruntun!
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
              {streak === 1
                ? "Api pertamamu menyala. Belajar lagi besok supaya terus menyala."
                : "Kebiasaan belajarmu terus menyala. Belajar lagi besok untuk menjaga streak ini."}
            </p>
            <Button
              onClick={() => setCelebration(null)}
              className="mt-8 h-14 w-full max-w-sm rounded-2xl bg-gradient-to-r from-[#f04432] to-[#ff982f] text-base font-semibold text-white shadow-[0_4px_0_#bd3825] hover:brightness-110 active:translate-y-0.5 active:shadow-[0_2px_0_#bd3825]"
            >
              Lanjutkan
            </Button>
            <div className="sr-only" aria-live="polite">Streak kamu sekarang {streak} hari.</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
