
/**
 * USER SENTENCES — fitur untuk user menambahkan contoh kalimat ke word_examples
 * 
 * User bisa submit contoh kalimat untuk kata yang sedang dilihat
 * Sistem menggunakan table word_examples yang sudah ada
 */

import { createClient } from "@/lib/supabase/browser"

export type WordExample = {
  id: number
  hanzi: string
  pinyin: string
  arti: string
  section_label: string | null
  section_tag: string | null
  hanzi_item_id: number | null
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
  }
): Promise<{ error: string | null; id?: number }> {
  const { supa, user } = await requireUser()
  if (!user) return { error: "Belum login" }

  const { data, error } = await supa
    .from("word_examples")
    .insert({
      hanzi: sentence.hanzi,
      pinyin: sentence.pinyin,
      arti: sentence.arti,
      word_hanzi: sentence.hanzi_key,
      // section_label: "",
      // section_tag: "",
      // hanzi_item_id: null,
    })
    .select("id")
    .single()

  if (error) return { error: error?.message ?? null }
  return { error: null, id: data?.id }
}

export async function listUserSentences(): Promise<Array<{ id: number; hanzi: string; pinyin: string | null; arti: string | null; created_at: string | null }>> {
  const { supa, user } = await requireUser()
  if (!user) return []

  const { data, error } = await supa
    .from("word_examples")
    .select("id, hanzi, pinyin, arti, created_at")
    .order("created_at", { ascending: false })

  if (error || !data) return []
  return data
}

export async function deleteUserSentence(id: number): Promise<{ error: string | null }> {
  const { supa, user } = await requireUser()
  if (!user) return { error: "Belum login" }

  const { error } = await supa
    .from("word_examples")
    .delete()
    .eq("id", id)

  return { error: error?.message ?? null }
}

