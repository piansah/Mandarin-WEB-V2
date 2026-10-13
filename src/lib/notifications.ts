import { createClient } from "@/lib/supabase/browser"

export type NotificationType =
  | "deck_unlocked"
  | "estafet_unlocked"
  | "grammar_completed"
  | "review_completed"
  | "review_due"
  | "kalimat_quiz_completed"
  | "flashcard_completed"
  | "quiz_completed"
  | "nada_completed"
  | "tulis_completed"
  | "speaking_completed"
  | "cerita_completed"
  | "deck_all_completed"
  | "achievement_unlocked"
  | "level_up"
  | "other"

/** Event window yang dikirim setiap kali notifikasi baru berhasil dibuat. */
export const NOTIFICATIONS_CHANGED_EVENT = "notifications:changed"

/**
 * Membuat notifikasi untuk user yang sedang login.
 *
 * @returns `true` kalau baris benar-benar tersimpan di database, `false` kalau
 * tidak ada user login atau insert gagal (error dicatat di console). Pemanggil
 * sebaiknya hanya menyimpan flag "sudah dikirim" kalau hasilnya `true`.
 */
export async function createNotification(
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  try {
    const supa = createClient()
    const {
      data: { user },
    } = await supa.auth.getUser()

    if (!user) {
      console.warn("[Notification] Tidak ada user login, notifikasi dilewati")
      return false
    }

    const { error } = await supa.from("notifications" as any).insert({
      user_id: user.id,
      type,
      title,
      message,
      metadata: (metadata ?? {}) as any,
    })

    if (error) {
      console.error("[Notification] Gagal membuat notifikasi:", error)
      return false
    }

    // Beri tahu komponen (mis. NotificationDropdown) supaya langsung refresh
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
    }
    return true
  } catch (err) {
    console.error("[Notification] Error tak terduga:", err)
    return false
  }
}

export function createDeckUnlockedNotification(deckId: number, deckTitle: string): Promise<boolean> {
  return createNotification(
    "deck_unlocked",
    "🎉 Deck Baru Terbuka!",
    `Selamat! Deck "${deckTitle}" sekarang terbuka. Yuk lanjut belajar!`,
    { deck_id: deckId }
  )
}

export function createEstafetUnlockedNotification(estafetLevel: number, estafetTitle: string): Promise<boolean> {
  return createNotification(
    "estafet_unlocked",
    "🎉 Estafet Baru Terbuka!",
    `Selamat! Estafet "${estafetTitle}" sekarang terbuka. Lanjut baca kalimat kumulatif!`,
    { estafet_level: estafetLevel }
  )
}

export function createFlashcardCompletedNotification(deckTitle: string, score: number): Promise<boolean> {
  return createNotification(
    "flashcard_completed",
    "🃏 Flashcard Selesai!",
    `Luar biasa! Anda menyelesaikan flashcard "${deckTitle}" dengan akurasi ${score}%.`,
    { deck_title: deckTitle, score }
  )
}

export function createQuizCompletedNotification(deckTitle: string, score: number): Promise<boolean> {
  return createNotification(
    "quiz_completed",
    "✅ Quiz Selesai!",
    `Hebat! Anda menyelesaikan quiz "${deckTitle}" dengan nilai ${score}%.`,
    { deck_title: deckTitle, score }
  )
}

export function createNadaCompletedNotification(deckTitle: string, score: number): Promise<boolean> {
  return createNotification(
    "nada_completed",
    "🎵 Latihan Nada Selesai!",
    `Bagus! Anda menyelesaikan latihan nada "${deckTitle}" dengan skor ${score}%.`,
    { deck_title: deckTitle, score }
  )
}

export function createTulisCompletedNotification(deckTitle: string, score: number): Promise<boolean> {
  return createNotification(
    "tulis_completed",
    "✍️ Tulis Hanzi Selesai!",
    `Keren! Anda menyelesaikan latihan tulis "${deckTitle}" dengan skor ${score}%.`,
    { deck_title: deckTitle, score }
  )
}

export function createSpeakingCompletedNotification(estafetTitle: string, score: number): Promise<boolean> {
  return createNotification(
    "speaking_completed",
    "🎤 Latihan Speaking Selesai!",
    `Luar biasa! Anda menyelesaikan latihan speaking "${estafetTitle}" dengan skor ${score}%.`,
    { estafet_title: estafetTitle, score }
  )
}

export function createGrammarCompletedNotification(grammarTitle: string, score: number): Promise<boolean> {
  return createNotification(
    "grammar_completed",
    "📚 Tata Bahasa Selesai!",
    `Pintar! Anda menyelesaikan tata bahasa "${grammarTitle}" dengan nilai ${score}%.`,
    { grammar_title: grammarTitle, score }
  )
}

export function createCeritaCompletedNotification(ceritaTitle: string): Promise<boolean> {
  return createNotification(
    "cerita_completed",
    "📖 Cerita Selesai!",
    `Selamat membaca! Anda telah menyelesaikan cerita "${ceritaTitle}".`,
    { cerita_title: ceritaTitle }
  )
}

export function createDeckAllCompletedNotification(deckTitle: string): Promise<boolean> {
  return createNotification(
    "deck_all_completed",
    "🏆 Deck Lengkap Selesai!",
    `Luar biasa! Anda telah menyelesaikan SEMUA latihan di deck "${deckTitle}" (Flashcard, Quiz, Nada, Tulis)!`,
    { deck_title: deckTitle }
  )
}