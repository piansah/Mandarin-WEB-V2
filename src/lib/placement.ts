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
 * Pertanyaan 2 & 3 (target waktu harian, tujuan belajar) tidak memengaruhi
 * unlock — sekadar dicatat sebagai konteks. Target waktu harian juga
 * dipakai sebagai `daily_goal_minutes` awal di `user_profile`, dasar buat
 * target harian/streak di dashboard nantinya.
 *
 * Catatan (2026): pertanyaan preferensi Hanzi (simplified/traditional)
 * sengaja dihapus dari ALUR PLACEMENT ini. Placement adalah pengalaman
 * awal untuk SEMUA bahasa yang bakal didukung Journey Learning ke
 * depannya, jadi pertanyaannya sekarang ditulis generik dan tidak lagi
 * mengasumsikan Mandarin sebagai satu-satunya bahasa. Pemetaan level ke
 * tier/HSK di bawah tetap dipakai untuk konten Mandarin yang sudah ada.
 *
 * `HanziMode` tetap diekspor dari sini (bukan lagi dipakai di placement)
 * karena masih jadi preferensi tampilan yang bisa diganti user kapan saja
 * lewat halaman Settings — lihat `updateHanziMode` di `lib/user-settings.ts`.
 * Itu preferensi tampilan Hanzi untuk user yang memang belajar Mandarin,
 * beda konteks dari placement yang sekarang bahasa-agnostik.
 */

import { createClient } from "@/lib/supabase/browser"
import { unlockFirstNTiers, TIER_ORDER, TIER_LABEL, TIER_HSK, type Tier } from "@/lib/tier-unlock"

export type PlacementLevel = 0 | 1 | 2 | 3 | 4
export type PlacementGoal = 0 | 1 | 2 | 3
export type PlacementDailyGoal = 5 | 10 | 15 | 20
export type HanziMode = 0 | 1 | 2

export const PLACEMENT_LEVEL_OPTIONS: { value: PlacementLevel; title: string; sub: string }[] = [
  { value: 0, title: "Baru mulai", sub: "Belum tahu dasar-dasarnya sama sekali" },
  { value: 1, title: "Pemula", sub: "Hafal beberapa kosakata dasar" },
  { value: 2, title: "Menengah", sub: "Paham kalimat sederhana" },
  { value: 3, title: "Lanjut", sub: "Bisa memahami paragraf pendek" },
  { value: 4, title: "Mahir", sub: "Percaya diri di banyak topik" },
]

export const DAILY_GOAL_OPTIONS: { value: PlacementDailyGoal; title: string; sub: string }[] = [
  { value: 5, title: "Santai", sub: "5 menit / hari" },
  { value: 10, title: "Reguler", sub: "10 menit / hari" },
  { value: 15, title: "Serius", sub: "15 menit / hari" },
  { value: 20, title: "Intens", sub: "20 menit / hari" },
]

export const GOAL_OPTIONS: { value: PlacementGoal; title: string }[] = [
  { value: 0, title: "Ujian resmi" },
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
  dailyGoal: PlacementDailyGoal
  goal: PlacementGoal
}

/**
 * Simpan hasil placement: buka tier awal (selalu berhasil, karena cuma
 * menyentuh `user_profile` yang sudah pasti ada), catat target harian ke
 * `user_profile.daily_goal_minutes` (best effort — kolom opsional), lalu—
 * best effort juga—catat detail jawabannya ke tabel `user_placement` kalau
 * tabel itu tersedia di project ini. Kalau salah satu tabel/kolom belum
 * dibuat, unlock tier tetap jalan normal.
 */
export async function submitPlacement(result: PlacementResult): Promise<{ unlockedTiers: Tier[] }> {
  const unlockedTiers = await unlockFirstNTiers(unlockCountForLevel(result.level))

  try {
    const supa = createClient()
    const {
      data: { user },
    } = await supa.auth.getUser()
    if (user) {
      const { error: profileError } = await supa
        .from("user_profile")
        .upsert(
          { user_id: user.id, daily_goal_minutes: result.dailyGoal },
          { onConflict: "user_id" },
        )
      if (profileError) console.warn("[placement] Gagal menyimpan target harian:", profileError.message)

      const { error } = await supa.from("user_placement").upsert(
        {
          user_id: user.id,
          level: result.level,
          daily_goal_minutes: result.dailyGoal,
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
