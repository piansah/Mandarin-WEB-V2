// Halaman-halaman di bawah /practice sengaja TIDAK fullscreen — sidebar dan
// DashboardHeader dari dashboard-layout-client.tsx tetap tampil, sama seperti
// flashcard biasa, flashcard kumulatif, dan baca (cerita). Layout ini cuma
// pass-through; dulu pernah ada versi fullscreen (lihat kode yang di-comment
// di riwayat git) tapi itu sudah ditinggalkan.
export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
