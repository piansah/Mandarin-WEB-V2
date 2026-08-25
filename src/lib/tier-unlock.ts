"use client"

/**
 * TIER-UNLOCK — port dari `src/JS/utilities/tier-unlock.js` (project lama).
 *
 * Lapis tier: HSK dikelompokkan jadi 5 tier — pemula (HSK1-2), menengah (HSK3),
 * lanjut (HSK4), master (HSK5), fasih (HSK6). Tier disimpan di
 * `user_profile.unlocked_tiers` (kolom ini sudah dipakai oleh
 * `auth/callback/route.ts`, default `['pemula']` untuk user baru).
 *
 * Lapis item (sequential per-deck di dalam satu HSK level) tetap jadi urusan
 * masing-masing halaman (quiz/grammar/flashcard) seperti sebelumnya — modul
 * ini cuma menangani lapis tier yang sebelumnya hilang total di project baru.
 */

import * as React from "react"
import { createClient } from "@/lib/supabase/browser"

export const TIER_ORDER = ["pemula", "menengah", "lanjut", "master", "fasih"] as const
export type Tier = (typeof TIER_ORDER)[number]

export const TIER_LABEL: Record<Tier, string> = {
  pemula: "Tingkat Pemula",
  menengah: "Tingkat Menengah",
  lanjut: "Tingkat Lanjut",
  master: "Tingkat Master",
  fasih: "Tingkat Fasih",
}

export const TIER_HSK: Record<Tier, number[]> = {
  pemula: [1, 2],
  menengah: [3],
  lanjut: [4],
  master: [5],
  fasih: [6],
}

function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIER_ORDER as readonly string[]).includes(value)
}

/** Level HSK 3 ada di tier "menengah", dst. HSK di luar range dianggap tier terakhir. */
export function tierForHSK(hsk: number): Tier {
  for (const tier of TIER_ORDER) {
    if (TIER_HSK[tier].includes(hsk)) return tier
  }
  return TIER_ORDER[TIER_ORDER.length - 1]
}

export function tierBefore(tier: Tier): Tier | null {
  const idx = TIER_ORDER.indexOf(tier)
  return idx > 0 ? TIER_ORDER[idx - 1] : null
}

/**
 * Normalisasi array `unlocked_tiers` mentah dari DB: buang nilai tak dikenal,
 * pastikan "pemula" selalu ada, dan cascade — kalau tier tinggi kebuka maka
 * semua tier di bawahnya ikut kebuka (sinkron dengan logika versi lama).
 */
export function normalizeUnlockedTiers(raw: unknown): Tier[] {
  const set = new Set<Tier>()
  if (Array.isArray(raw)) {
    raw.forEach((t) => {
      if (isTier(t)) set.add(t)
    })
  }
  set.add("pemula")

  const highestIdx = TIER_ORDER.reduce((max, t, i) => (set.has(t) ? i : max), 0)
  for (let i = 0; i <= highestIdx; i++) set.add(TIER_ORDER[i])

  return TIER_ORDER.filter((t) => set.has(t))
}

export function unlockedHSKFromTiers(tiers: Tier[]): number[] {
  const levels = new Set<number>()
  tiers.forEach((t) => TIER_HSK[t]?.forEach((h) => levels.add(h)))
  return [...levels].sort((a, b) => a - b)
}

export function getHighestUnlockedTier(tiers: Tier[]): Tier {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    if (tiers.includes(TIER_ORDER[i])) return TIER_ORDER[i]
  }
  return "pemula"
}

/** Kalau level HSK terpilih sekarang terkunci, jatuhkan ke level tertinggi yang masih terbuka. */
export function clampToUnlockedLevel(level: number, unlockedHSK: number[]): number {
  if (unlockedHSK.includes(level)) return level
  const fallback = unlockedHSK.filter((h) => h <= level).pop()
  return fallback ?? unlockedHSK[0] ?? level
}

export function lockedLevelMessage(hsk: number): string {
  const tier = tierForHSK(hsk)
  const prev = tierBefore(tier)
  return prev
    ? `Selesaikan ${TIER_LABEL[prev]} dulu untuk membuka HSK ${hsk}.`
    : `HSK ${hsk} masih terkunci.`
}

/* ══════════════════════════════════════════
   BACA & TULIS KE SUPABASE
══════════════════════════════════════════ */

export async function fetchUnlockedTiers(): Promise<Tier[]> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return ["pemula"]

  const { data, error } = await supa
    .from("user_profile")
    .select("unlocked_tiers")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !data) return ["pemula"]
  return normalizeUnlockedTiers(data.unlocked_tiers)
}

/**
 * Buka tier ke-`unlockCount` pertama (1 = cuma pemula, 5 = semua tier).
 * Dipanggil dari hasil placement test. Selalu menandai `has_seen_onboarding`
 * true juga — di project lama, penyelesaian placement = penyelesaian setup awal.
 */
export async function unlockFirstNTiers(unlockCount: number): Promise<Tier[]> {
  const n = Math.min(Math.max(Math.round(unlockCount), 1), TIER_ORDER.length)
  const tierKeys = TIER_ORDER.slice(0, n) as Tier[]

  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return tierKeys

  const { error } = await supa.from("user_profile").upsert(
    { user_id: user.id, unlocked_tiers: tierKeys, has_seen_onboarding: true },
    { onConflict: "user_id" },
  )
  if (error) console.warn("[tier-unlock] Gagal menyimpan unlocked_tiers:", error.message)

  return tierKeys
}

/* ══════════════════════════════════════════
   REACT HOOK
══════════════════════════════════════════ */

/**
 * `null` selama masih loading. Setelah itu selalu array HSK number yang
 * sudah terbuka (minimal [1, 2] karena "pemula" selalu terbuka).
 */
export function useUnlockedHSK(): number[] | null {
  const [unlockedHSK, setUnlockedHSK] = React.useState<number[] | null>(null)

  React.useEffect(() => {
    let active = true
    fetchUnlockedTiers().then((tiers) => {
      if (active) setUnlockedHSK(unlockedHSKFromTiers(tiers))
    })
    return () => {
      active = false
    }
  }, [])

  return unlockedHSK
}
