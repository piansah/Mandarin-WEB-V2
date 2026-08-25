/**
 * PERSONAL DECK & FAVORIT — port dari `src/JS/features/personal-deck.js`
 * (project lama, 1024 baris). Fungsionalitas dipangkas ke inti yang bikin
 * `/dashboard/personal-cards` dan `/dashboard/favorit` (sudah ditaut di
 * sidebar tapi belum ada halamannya) berjalan: kelola tema → deck → kata,
 * plus daftar kosakata favorit. Fitur yang TIDAK diport: emoji picker custom,
 * swipe-to-delete gesture, pencarian kosakata terintegrasi saat nambah kata
 * (di sini nambah kata pakai form manual hanzi/pinyin/arti).
 *
 * Tabel & kolom dipakai apa adanya dari project lama (skema Supabase yang
 * sama): personal_themes, personal_decks, personal_cards, personal_favorites.
 */

import { createClient } from "@/lib/supabase/browser"

export type PersonalTheme = {
  id: number
  user_id: string
  name: string
  icon: string | null
  created_at: string
  deck_count?: number
}

export type PersonalDeck = {
  id: number
  theme_id: number
  created_by: string
  title: string
  description: string | null
  created_at: string
  card_count?: number
}

export type PersonalCard = {
  id: number
  deck_id: number
  hanzi: string
  pinyin: string
  arti: string
  word_class: string | null
  catatan: string | null
  created_at: string
}

export type FavoriteCard = {
  id: number
  user_id: string
  hanzi: string
  pinyin: string
  arti: string
  word_class: string | null
  catatan: string | null
  source: string | null
  source_id: number | null
  created_at: string
}

async function requireUser() {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  return { supa, user }
}

/* ══════════════════════════════════════════
   TEMA
══════════════════════════════════════════ */

export async function listThemes(): Promise<PersonalTheme[]> {
  const { supa, user } = await requireUser()
  if (!user) return []
  const { data, error } = await supa
    .from("personal_themes")
    .select("*, personal_decks(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return data.map((t: any) => ({ ...t, deck_count: t.personal_decks?.[0]?.count ?? 0 }))
}

export async function createTheme(name: string, icon = "📚"): Promise<{ error: string | null }> {
  const { supa, user } = await requireUser()
  if (!user) return { error: "Belum login" }
  const { error } = await supa.from("personal_themes").insert({ user_id: user.id, name, icon })
  return { error: error?.message ?? null }
}

export async function renameTheme(id: number, name: string, icon: string): Promise<{ error: string | null }> {
  const supa = createClient()
  const { error } = await supa.from("personal_themes").update({ name, icon }).eq("id", id)
  return { error: error?.message ?? null }
}

export async function deleteTheme(id: number): Promise<{ error: string | null }> {
  const { supa, user } = await requireUser()
  if (!user) return { error: "Belum login" }
  const { error } = await supa.from("personal_themes").delete().eq("id", id).eq("user_id", user.id)
  return { error: error?.message ?? null }
}

/* ══════════════════════════════════════════
   DECK
══════════════════════════════════════════ */

export async function listDecks(themeId: number): Promise<PersonalDeck[]> {
  const supa = createClient()
  const { data, error } = await supa
    .from("personal_decks")
    .select("*, personal_cards(count)")
    .eq("theme_id", themeId)
    .order("created_at", { ascending: true })
  if (error || !data) return []
  return data.map((d: any) => ({ ...d, card_count: d.personal_cards?.[0]?.count ?? 0 }))
}

export async function createDeck(
  themeId: number,
  title: string,
  description: string | null,
): Promise<{ error: string | null }> {
  const { supa, user } = await requireUser()
  if (!user) return { error: "Belum login" }
  const { error } = await supa
    .from("personal_decks")
    .insert({ theme_id: themeId, created_by: user.id, title, description })
  return { error: error?.message ?? null }
}

export async function updateDeck(
  id: number,
  title: string,
  description: string | null,
): Promise<{ error: string | null }> {
  const supa = createClient()
  const { error } = await supa.from("personal_decks").update({ title, description }).eq("id", id)
  return { error: error?.message ?? null }
}

export async function deleteDeck(id: number): Promise<{ error: string | null }> {
  const supa = createClient()
  const { error } = await supa.from("personal_decks").delete().eq("id", id)
  return { error: error?.message ?? null }
}

/* ══════════════════════════════════════════
   KATA DALAM DECK
══════════════════════════════════════════ */

export async function listCards(deckId: number): Promise<PersonalCard[]> {
  const supa = createClient()
  const { data, error } = await supa
    .from("personal_cards")
    .select("*")
    .eq("deck_id", deckId)
    .order("created_at", { ascending: true })
  if (error || !data) return []
  return data
}

export async function addCard(
  deckId: number,
  card: { hanzi: string; pinyin: string; arti: string; word_class?: string | null; catatan?: string | null },
): Promise<{ error: string | null }> {
  const supa = createClient()
  const { error } = await supa.from("personal_cards").insert({
    deck_id: deckId,
    hanzi: card.hanzi,
    pinyin: card.pinyin || "",
    arti: card.arti || "",
    word_class: card.word_class || null,
    catatan: card.catatan || null,
  })
  return { error: error?.message ?? null }
}

export async function deleteCard(id: number): Promise<{ error: string | null }> {
  const supa = createClient()
  const { error } = await supa.from("personal_cards").delete().eq("id", id)
  return { error: error?.message ?? null }
}

/* ══════════════════════════════════════════
   FAVORIT
══════════════════════════════════════════ */

export async function listFavorites(): Promise<FavoriteCard[]> {
  const { supa, user } = await requireUser()
  if (!user) return []
  const { data, error } = await supa
    .from("personal_favorites")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return data
}

export async function removeFavorite(id: number): Promise<{ error: string | null }> {
  const { supa, user } = await requireUser()
  if (!user) return { error: "Belum login" }
  const { error } = await supa.from("personal_favorites").delete().eq("id", id).eq("user_id", user.id)
  return { error: error?.message ?? null }
}

export async function addFavorite(
  card: {
    hanzi: string
    pinyin: string
    arti: string
    word_class?: string | null
    catatan?: string | null
    source?: string | null
    source_id?: number | null
  }
): Promise<{ error: string | null; id?: number }> {
  const { supa, user } = await requireUser()
  if (!user) return { error: "Belum login" }

  const { data, error } = await supa
    .from("personal_favorites")
    .insert({
      user_id: user.id,
      hanzi: card.hanzi,
      pinyin: card.pinyin,
      arti: card.arti,
      word_class: card.word_class || null,
      catatan: card.catatan || null,
      source: card.source || null,
      source_id: card.source_id || null,
    })
    .select("id")
    .single()

  if (error) return { error: error?.message ?? null }
  return { error: null, id: data?.id }
}

export async function checkFavorite(hanzi: string): Promise<boolean> {
  const { supa, user } = await requireUser()
  if (!user) return false

  const { data } = await supa
    .from("personal_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("hanzi", hanzi)
    .maybeSingle()

  return !!data
}

export async function toggleFavorite(
  card: {
    hanzi: string
    pinyin: string
    arti: string
    word_class?: string | null
    catatan?: string | null
    source?: string | null
    source_id?: number | null
  }
): Promise<{ error: string | null; isFavorited: boolean }> {
  const { supa, user } = await requireUser()
  if (!user) return { error: "Belum login", isFavorited: false }

  const isFavorited = await checkFavorite(card.hanzi)
  
  if (isFavorited) {
    // Remove existing favorite
    const { data } = await supa
      .from("personal_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("hanzi", card.hanzi)
      .single()
    
    if (data) {
      const result = await removeFavorite(data.id)
      if (result.error) return { error: result.error, isFavorited: true }
    }
    return { error: null, isFavorited: false }
  } else {
    // Add new favorite
    const result = await addFavorite(card)
    if (result.error) return { error: result.error, isFavorited: false }
    return { error: null, isFavorited: true }
  }
}
