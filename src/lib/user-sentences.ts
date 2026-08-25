/**
 * USER SENTENCES — fitur untuk user menambahkan kalimat ke hanzi_items
 * 
 * User bisa submit kalimat yang akan masuk ke hanzi_items dengan flag user_contribution
 * Sistem menggunakan table hanzi_items yang sudah ada
 */

import { createClient } from "@/lib/supabase/browser"

export type HanziItem = {
  id: number
  section_label: string | null
  section_tag: string | null
  sort_order: number | null
  hanzi: string
  pinyin: string
  arti: string
  hanzi_key: string
  user_contribution: boolean | null
  created_at: string
}

async function requireUser() {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  return { supa, user }
}

export async function submitUserSentence(
  sentence: {
    hanzi_key: string
    hanzi: string
    pinyin: string
    arti: string
    section_label?: string | null
    section_tag?: string | null
  }
): Promise<{ error: string | null; id?: number }> {
  const { supa, user } = await requireUser()
  if (!user) return { error: "Belum login" }

  // Get max sort_order for this hanzi_key
  const { data: maxOrder } = await supa
    .from("hanzi_items")
    .select("sort_order")
    .eq("hanzi_key", sentence.hanzi_key)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSortOrder = (maxOrder?.sort_order ?? 0) + 1

  const { data, error } = await supa
    .from("hanzi_items")
    .insert({
      hanzi_key: sentence.hanzi_key,
      hanzi: sentence.hanzi,
      pinyin: sentence.pinyin,
      arti: sentence.arti,
      section_label: sentence.section_label || null,
      section_tag: sentence.section_tag || null,
      sort_order: nextSortOrder,
      user_contribution: true,
    })
    .select("id")
    .single()

  if (error) return { error: error?.message ?? null }
  return { error: null, id: data?.id }
}

export async function listUserSentences(): Promise<HanziItem[]> {
  const { supa, user } = await requireUser()
  if (!user) return []

  const { data, error } = await supa
    .from("hanzi_items")
    .select("*")
    .eq("user_contribution", true)
    .order("created_at", { ascending: false })

  if (error || !data) return []
  return data
}

export async function deleteUserSentence(id: number): Promise<{ error: string | null }> {
  const { supa, user } = await requireUser()
  if (!user) return { error: "Belum login" }

  const { error } = await supa
    .from("hanzi_items")
    .delete()
    .eq("id", id)
    .eq("user_contribution", true)

  return { error: error?.message ?? null }
}
