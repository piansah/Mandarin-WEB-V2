"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"
import { saveUserScore } from "@/lib/user-scores"
import { recordSrsReview } from "@/lib/srs"
import { SwipeFlashcardSession, type SwipeFlashcard } from "@/components/swipe-flashcard-session"

// Key localStorage untuk menandai kartu mana saja yang sudah dinilai
// dalam sesi yang BELUM selesai, per user + per deck. Dipakai supaya
// kalau user keluar di tengah sesi lalu buka deck yang sama lagi,
// kartu yang sudah dinilai tidak muncul dan ke-rating dobel.
function sessionStorageKey(userId: string, deckId: number) {
  return `mj_practice_session_${userId}_${deckId}`
}

function readRatedCardIds(userId: string, deckId: number): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(sessionStorageKey(userId, deckId))
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set()
  } catch {
    return new Set()
  }
}

function addRatedCardId(userId: string, deckId: number, cardId: string) {
  if (typeof window === "undefined") return
  try {
    const key = sessionStorageKey(userId, deckId)
    const current = readRatedCardIds(userId, deckId)
    current.add(cardId)
    window.localStorage.setItem(key, JSON.stringify(Array.from(current)))
  } catch {
    // localStorage penuh/diblokir browser — abaikan, tidak fatal
  }
}

function clearRatedCardIds(userId: string, deckId: number) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(sessionStorageKey(userId, deckId))
  } catch {
    // abaikan
  }
}

export default function FlashcardPracticePage() {
  const params = useParams()
  const deckId = Number(params.id)
  const supa = useSupabase()

  const [cards, setCards] = React.useState<SwipeFlashcard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [deckTitle, setDeckTitle] = React.useState<string>("Kartu Hafalan")
  const [deckLevel, setDeckLevel] = React.useState<string>("Level A1")

  React.useEffect(() => {
    async function load() {
      const { data: { user } } = await supa.auth.getUser()
      setUserId(user?.id ?? null)

      const { data: setData } = await supa
        .from("flashcard_sets")
        .select("title, description, hsk_level")
        .eq("id", deckId)
        .maybeSingle()

      const deckHskLevel: number | undefined = setData?.hsk_level ?? undefined

      if (setData) {
        setDeckTitle(setData.title ?? "Kartu Hafalan")
        const parts = [setData.description, setData.hsk_level ? `HSK ${setData.hsk_level}` : null].filter(Boolean)
        setDeckLevel(parts.length > 0 ? parts.join(" - ") : "Level A1")
      }

      // word_class ditambahkan agar bisa ditampilkan sebagai
      // "HSK {level} - {word_class}" di atas kartu.
      const { data } = await supa
        .from("flashcard_cards")
        .select("id, hanzi, pinyin, arti, word_class")
        .eq("set_id", deckId)
        .order("created_at", { ascending: true })

      const rawCards = data ?? []

      // Fetch this user's existing SRS progress for these cards so reviews
      // continue from the correct level instead of always resetting to 0.
      // Baris yang ADA di sini juga dipakai untuk menandai kartu yang
      // "belum pernah dibuka" (isNew) — kartu tanpa baris progress sama
      // sekali dianggap baru, terlepas dari nilai srs_level-nya.
      const srsLevelByCard = new Map<string, number>()
      const reviewedCardIds = new Set<string>()
      if (user?.id && rawCards.length > 0) {
        const { data: progressRows } = await supa
          .from("user_card_progress")
          .select("card_id, srs_level")
          .eq("user_id", user.id)
          .in("card_id", rawCards.map(c => String(c.id)))

        for (const row of progressRows ?? []) {
          if (row.card_id) {
            srsLevelByCard.set(String(row.card_id), row.srs_level ?? 0)
            reviewedCardIds.add(String(row.card_id))
          }
        }
      }

      const hanziList = rawCards.map(c => c.hanzi).filter(Boolean)
      const exampleMap = new Map<string, { hanzi: string; pinyin: string; arti: string }>()

      if (hanziList.length > 0) {
        await Promise.all(
          hanziList.map(async (hanzi) => {
            const [directRes, partialRes] = await Promise.all([
              supa.from("word_examples").select("id, hanzi, pinyin, arti").eq("word_hanzi", hanzi).order("id").limit(1),
              supa.from("word_examples").select("id, hanzi, pinyin, arti").ilike("hanzi", `%${hanzi}%`).order("id").limit(1),
            ])
            const first = directRes.data?.[0] ?? partialRes.data?.[0]
            if (first) {
              exampleMap.set(hanzi, { hanzi: first.hanzi ?? "", pinyin: first.pinyin ?? "", arti: first.arti ?? "" })
            }
          })
        )
      }

      const cardsWithExamples: SwipeFlashcard[] = rawCards.map(card => {
        const ex = card.hanzi ? exampleMap.get(card.hanzi) : undefined
        return {
          ...card,
          srsLevel: srsLevelByCard.get(String(card.id)) ?? 0,
          exampleSentence: ex?.hanzi,
          examplePinyin: ex?.pinyin,
          exampleTranslation: ex?.arti,
          deckHskLevel,
          wordClass: card.word_class ?? undefined,
          // Kartu baru = belum pernah punya baris di user_card_progress.
          // Jika belum login, semua kartu ditampilkan sebagai kartu baru.
          isNew: user?.id ? !reviewedCardIds.has(String(card.id)) : true,
        }
      })

      // Skip kartu yang sudah dinilai dalam sesi sebelumnya yang belum
      // selesai (misal user keluar di tengah jalan). Kartu-kartu itu
      // dicatat di localStorage per user+deck saat dinilai (lihat
      // handleReview), dan dihapus begitu sesi benar-benar tuntas (lihat
      // handleComplete). Kalau ternyata SEMUA kartu sudah masuk daftar itu
      // (edge case: localStorage tidak sempat ke-clear), tetap tampilkan
      // deck penuh daripada layar kosong.
      let finalCards = cardsWithExamples
      if (user?.id) {
        const ratedIds = readRatedCardIds(user.id, deckId)
        if (ratedIds.size > 0) {
          const remaining = cardsWithExamples.filter(c => !ratedIds.has(String(c.id)))
          finalCards = remaining.length > 0 ? remaining : cardsWithExamples
        }
      }

      setCards(finalCards)
      setLoading(false)
    }
    load()
  }, [deckId, supa])

  const wordDetailPath = React.useCallback(
    (card: SwipeFlashcard) => `/dashboard/flashcard/${deckId}/word/${card.id}`,
    [deckId]
  )

  const handleComplete = React.useCallback((stats: { hafal: number; lupa: number; ragu: number }) => {
    const total = stats.hafal + stats.lupa + stats.ragu
    const pct = total > 0 ? Math.round((stats.hafal / total) * 100) : 0
    saveUserScore("fc_session", String(deckId), pct).catch(() => { })

    // Sesi tuntas — hapus catatan kartu-yang-sudah-dinilai supaya attempt
    // berikutnya (besok, atau lewat tombol "Ulangi") mulai dari deck penuh.
    if (userId) {
      clearRatedCardIds(userId, deckId)
    }
  }, [deckId, userId])

  // Persists each rating to user_card_progress (srs_level + next_review).
  // Without this, "Jatuh Tempo Hari Ini" never updates because no due date
  // is ever written for cards reviewed in this practice session.
  const handleReview = React.useCallback(async (card: SwipeFlashcard, quality: 0 | 3 | 4 | 5) => {
    if (!userId) return
    await recordSrsReview(supa, userId, String(card.id), quality, card.srsLevel ?? 0)
    // Catat kartu ini sudah dinilai di sesi yang sedang berjalan, supaya
    // kalau user keluar sebelum sesi selesai lalu buka deck ini lagi,
    // kartu ini di-skip dan tidak ke-rating dobel.
    addRatedCardId(userId, deckId, String(card.id))
  }, [supa, userId, deckId])

  return (
    <div className="flex h-full w-full flex-1 flex-col min-h-0 overflow-hidden">
      <SwipeFlashcardSession
        cards={cards}
        loading={loading}
        wordDetailPath={wordDetailPath}
        onReview={handleReview}
        onComplete={handleComplete}
        deckTitle={deckTitle}
        deckLevel={deckLevel}
        userId={userId}
        deckCardIds={cards.map(c => String(c.id))}
      />
    </div>
  )
}