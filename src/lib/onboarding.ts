/**
 * ONBOARDING — port dari 6 slide intro `_obOnboarding*` di project lama
 * (`src/JS/app/onboarding.js`), tanpa animasi swipe — cukup tombol
 * lanjut/kembali seperti alur placement yang sudah ada.
 *
 * Ditempel sebagai langkah pertama di `/dashboard/placement` (lihat
 * `page.tsx`) supaya satu flag `has_seen_onboarding` tetap jadi penanda
 * tunggal "setup awal selesai" — sama seperti keputusan yang sudah dipakai
 * middleware untuk placement.
 *
 * Slide fitur di bawah ini sengaja dipetakan 1:1 ke menu utama di sidebar
 * (`app-sidebar.tsx`) — Daftar Kata, Flashcard, Modul Belajar, Quiz,
 * Estafet, Simulasi Ujian — supaya user baru langsung kenal nama fitur
 * yang bakal mereka temui, bukan istilah generik yang beda dari UI asli.
 */

export type OnboardingSlide = {
  emoji: string
  pill: string
  title: string
  desc: string
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    emoji: "👋",
    pill: "Selamat datang",
    title: "Selamat datang di Journey Learning",
    desc: "Belajar bahasa baru selangkah demi selangkah, dengan jalur belajar yang tersusun rapi dari dasar sampai mahir.",
  },
  {
    emoji: "🔤",
    pill: "Kosakata",
    title: "Daftar Kata",
    desc: "Jelajahi kosakata per tema dan level, lengkap dengan arti, pelafalan, dan contoh pemakaian.",
  },
  {
    emoji: "🗂️",
    pill: "Latihan ingatan",
    title: "Flashcard",
    desc: "Hafalkan kosakata dengan sistem pengulangan (SRS) — kata yang gampang lupa akan lebih sering muncul.",
  },
  {
    emoji: "📘",
    pill: "Materi terstruktur",
    title: "Modul Belajar",
    desc: "Ikuti modul belajar terstruktur, dari pengenalan dasar sampai topik yang lebih kompleks, tahap demi tahap.",
  },
  {
    emoji: "⚡",
    pill: "Uji pemahaman",
    title: "Quiz",
    desc: "Uji pemahamanmu lewat quiz harian yang tersusun per level, biar makin yakin sebelum naik tingkat.",
  },
  {
    emoji: "🔗",
    pill: "Latihan kalimat",
    title: "Estafet",
    desc: "Latihan memahami kalimat utuh secara berantai — bukan cuma kata lepas, biar makin percaya diri berkomunikasi.",
  },
  {
    emoji: "🏆",
    pill: "Simulasi resmi",
    title: "Simulasi Ujian",
    desc: "Coba simulasi ujian sesuai format resmi untuk mengukur kesiapanmu sebelum ujian yang sesungguhnya.",
  },
]
