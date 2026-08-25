/**
 * SETTINGS — halaman baru (belum ada versi lamanya secara langsung; project
 * lama menaruh sebagian kecil di `profile.js`, seperti ubah nama). Menyatukan
 * apa yang sudah bisa diubah user dari data yang sudah ada: nama tampilan
 * (`user_profile.display_name`) dan preferensi Hanzi (`user_placement.hanzi_mode`,
 * diisi pertama kali saat placement test).
 */

import { createClient } from "@/lib/supabase/browser"
import type { HanziMode } from "@/lib/placement"

export type UserSettings = {
  displayName: string
  email: string | null
  hanziMode: HanziMode | null
}

export async function fetchUserSettings(): Promise<UserSettings | null> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: placement }] = await Promise.all([
    supa.from("user_profile").select("display_name").eq("user_id", user.id).maybeSingle(),
    supa.from("user_placement").select("hanzi_mode").eq("user_id", user.id).maybeSingle(),
  ])

  return {
    displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "Pelajar",
    email: user.email ?? null,
    hanziMode: placement?.hanzi_mode ?? null,
  }
}

export async function updateDisplayName(name: string): Promise<{ error: string | null }> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return { error: "Belum login" }

  const { error } = await supa
    .from("user_profile")
    .upsert(
      { user_id: user.id, display_name: name, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
  return { error: error?.message ?? null }
}

export async function updateHanziMode(mode: HanziMode): Promise<{ error: string | null }> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return { error: "Belum login" }

  const { error } = await supa
    .from("user_placement")
    .upsert({ user_id: user.id, hanzi_mode: mode, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
  return { error: error?.message ?? null }
}

export async function signOut(): Promise<void> {
  const supa = createClient()
  await supa.auth.signOut()
}
