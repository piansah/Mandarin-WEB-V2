/**
 * ONBOARDING — port dari 6 slide intro `_obOnboarding*` di project lama
 * (`src/JS/app/onboarding.js`), tanpa animasi swipe — cukup tombol
 * lanjut/kembali seperti alur placement yang sudah ada.
 *
 * Ditempel sebagai langkah pertama di `/dashboard/placement` (lihat
 * `page.tsx`) supaya satu flag `has_seen_onboarding` tetap jadi penanda
 * tunggal "setup awal selesai" — sama seperti keputusan yang sudah dipakai
 * middleware untuk placement.
 */

export type OnboardingSlide = {
  emoji: string
  title: string
  desc: string
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    emoji: "👋",
    title: "Selamat datang di Mandarin Journey",
    desc: "Belajar Mandarin selangkah demi selangkah, dari Hanzi paling dasar sampai siap ujian HSK.",
  },
  {
    emoji: "🗂️",
    title: "Flashcard",
    desc: "Hafalkan kosakata dengan sistem pengulangan (SRS) — kata yang gampang lupa akan lebih sering muncul.",
  },
  {
    emoji: "⚡",
    title: "Quiz",
    desc: "Uji pemahaman Hanzi, Pinyin, dan arti lewat quiz harian yang tersusun per level HSK.",
  },
  {
    emoji: "📖",
    title: "Grammar",
    desc: "Pelajari pola kalimat, lalu latihan menyusun kata sesuai urutan yang benar.",
  },
  {
    emoji: "💬",
    title: "Kalimat",
    desc: "Latihan memahami kalimat utuh, bukan cuma kata lepas — biar makin percaya diri ngobrol.",
  },
  {
    emoji: "📚",
    title: "Baca Cerita",
    desc: "Baca cerita pendek berbahasa Mandarin dengan bantuan terjemahan tap-to-reveal di tiap kata.",
  },
]
