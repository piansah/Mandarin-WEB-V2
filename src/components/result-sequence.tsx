"use client"

import { useEffect, useState, type ReactNode } from "react"

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const COUNT_DURATION = 1000

type ResultSequenceProps = {
  children: ReactNode
  className?: string
  enabled?: boolean
}

export function ResultSequence({ children, className = "", enabled = true }: ResultSequenceProps) {
  const [phase, setPhase] = useState(enabled ? "counting" : "revealing")

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!enabled || reduceMotion) {
      setPhase("revealing")
      return
    }

    const backgroundTimer = window.setTimeout(() => setPhase("background"), COUNT_DURATION)
    const revealTimer = window.setTimeout(() => setPhase("revealing"), COUNT_DURATION + 380)
    return () => {
      window.clearTimeout(backgroundTimer)
      window.clearTimeout(revealTimer)
    }
  }, [enabled])

  return <div className={`result-sequence-scope ${className}`} data-result-sequence={phase}>{children}</div>
}

type ResultScoreRingProps = {
  value: number
  color: string
  label?: string
}

export function ResultScoreRing({ value, color, label = "Akurasi" }: ResultScoreRingProps) {
  const target = Math.max(0, Math.min(100, Math.round(value)))
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(target)
      return
    }

    let frame = 0
    const startedAt = performance.now()
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / COUNT_DURATION)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(target * eased))
      if (progress < 1) frame = window.requestAnimationFrame(animate)
    }
    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [target])

  const offset = CIRCUMFERENCE - (displayValue / 100) * CIRCUMFERENCE

  return (
    <div data-result-score-ring className="relative z-10 flex items-center justify-center" aria-label={`${displayValue}% ${label}`}>
      <svg width="152" height="152" viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/60" />
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold text-foreground tabular-nums">{displayValue}%</span>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}
