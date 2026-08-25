"use client"

/**
 * PLACEMENT TEST — port ringkas dari `_obStartPlacement` / `_plFinish` di
 * project lama (`src/JS/app/onboarding.js`), tanpa slide UI beranimasi.
 *
 * Pertanyaan 1 (level) menentukan berapa tier yang langsung dibuka:
 *   level 0 → 1 tier (pemula)      level 3 → 4 tier (s/d master)
 *   level 1 → 2 tier (s/d menengah) level 4 → 5 tier (semua)
 *   level 2 → 3 tier (s/d lanjut)
 *
 * Pertanyaan 2 & 3 (preferensi hanzi & tujuan belajar) tidak memengaruhi
 * unlock — sekadar dicatat sebagai konteks, sama seperti versi lama.
 */

import { createClient } from "@/lib/supabase/browser"
import { unlockFirstNTiers, TIER_ORDER, TIER_LABEL, TIER_HSK, type Tier } from "@/lib/tier-unlock"

export type PlacementLevel = 0 | 1 | 2 | 3 | 4
export type HanziMode = 0 | 1 | 2
export type PlacementGoal = 0 | 1 | 2 | 3

export const PLACEMENT_LEVEL_OPTIONS: { value: PlacementLevel; title: string; sub: string }[] = [
  { value: 0, title: "Baru mulai", sub: "Belum tahu Hanzi/Pinyin sama sekali" },
  { value: 1, title: "Pemula", sub: "Hafal beberapa kosakata dasar (HSK 1–2)" },
  { value: 2, title: "Menengah", sub: "Paham kalimat sederhana (setara HSK 3)" },
  { value: 3, title: "Lanjut", sub: "Bisa baca paragraf pendek (setara HSK 4)" },
  { value: 4, title: "Mahir", sub: "Percaya diri di banyak topik (HSK 5–6)" },
]

export const HANZI_MODE_OPTIONS: { value: HanziMode; title: string }[] = [
  { value: 0, title: "Simplified (简体)" },
  { value: 1, title: "Traditional (繁體)" },
  { value: 2, title: "Keduanya" },
]

export const GOAL_OPTIONS: { value: PlacementGoal; title: string }[] = [
  { value: 0, title: "Ujian HSK" },
  { value: 1, title: "Kerja / bisnis" },
  { value: 2, title: "Kuliah / akademik" },
  { value: 3, title: "Hobi / minat pribadi" },
]

export function unlockCountForLevel(level: PlacementLevel): number {
  return Math.min(level + 1, TIER_ORDER.length)
}

export function tierPreview(level: PlacementLevel): { tier: Tier; label: string; hsk: string; unlocked: boolean }[] {
  const unlockCount = unlockCountForLevel(level)
  return TIER_ORDER.map((tier, i) => ({
    tier,
    label: TIER_LABEL[tier],
    hsk: `HSK ${TIER_HSK[tier].join("–")}`,
    unlocked: i < unlockCount,
  }))
}

export type PlacementResult = {
  level: PlacementLevel
  hanziMode: HanziMode
  goal: PlacementGoal
}

/**
 * Simpan hasil placement: buka tier awal (selalu berhasil, karena cuma
 * menyentuh `user_profile` yang sudah pasti ada), lalu—best effort—catat
 * detail jawabannya ke tabel `user_placement` kalau tabel itu tersedia di
 * project ini. Kalau tabelnya belum dibuat, unlock tier tetap jalan normal.
 */
export async function submitPlacement(result: PlacementResult): Promise<{ unlockedTiers: Tier[] }> {
  const unlockedTiers = await unlockFirstNTiers(unlockCountForLevel(result.level))

  try {
    const supa = createClient()
    const {
      data: { user },
    } = await supa.auth.getUser()
    if (user) {
      const { error } = await supa.from("user_placement").upsert(
        {
          user_id: user.id,
          level: result.level,
          hanzi_mode: result.hanziMode,
          goal: result.goal,
          unlocked_count: unlockCountForLevel(result.level),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      if (error) console.warn("[placement] Tabel user_placement belum tersedia:", error.message)
    }
  } catch (e) {
    console.warn("[placement] Gagal mencatat detail placement:", e)
  }

  return { unlockedTiers }
}
