export type Language = 'id' | 'en'

export const translations = {
  id: {
    sidebar: {
      dashboard: 'Dashboard',
      modul: 'Modul',
      utama: 'UTAMA',
      latihan: 'LATIHAN',
      grammar: 'Grammar',
      hanzi: 'Hanzi',
      daftarKata: 'Daftar Kata',
      quizHarian: 'Quiz Harian',
      kartuKumulatif: 'Kartu Kumulatif',
      quizKumulatif: 'Quiz Kumulatif',
      baca: 'Baca',
      koleksiPribadi: 'KOLEKSI PRIBADI',
      favorit: 'Favorit',
      deckSaya: 'Deck Saya',
      profil: 'Profil',
      pengaturan: 'Pengaturan',
      keluar: 'Keluar',
    },
    header: {
      searchPlaceholder: 'Cari modul, vocab...',
      toggleSidebarPin: 'Kunci sidebar tetap terbuka',
      toggleSidebarUnpin: 'Lepas kunci sidebar',
    },
  },
  en: {
    sidebar: {
      dashboard: 'Dashboard',
      modul: 'Modules',
      utama: 'MAIN',
      latihan: 'PRACTICE',
      grammar: 'Grammar',
      hanzi: 'Hanzi',
      daftarKata: 'Vocabulary',
      quizHarian: 'Daily Quiz',
      kartuKumulatif: 'Cumulative Cards',
      quizKumulatif: 'Cumulative Quiz',
      baca: 'Reading',
      koleksiPribadi: 'PERSONAL COLLECTION',
      favorit: 'Favorites',
      deckSaya: 'My Decks',
      profil: 'Profile',
      pengaturan: 'Settings',
      keluar: 'Logout',
    },
    header: {
      searchPlaceholder: 'Search modules, vocab...',
      toggleSidebarPin: 'Pin sidebar',
      toggleSidebarUnpin: 'Unpin sidebar',
    },
  },
}

export function t(lang: Language, key: string): string {
  const keys = key.split('.')
  let value: any = translations[lang]
  for (const k of keys) {
    value = value?.[k]
  }
  return value || key
}
