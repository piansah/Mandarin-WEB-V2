/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/* 
   layout.tsx -- Admin Layout */

import { requireAdmin } from "@/lib/admin-middleware"

/**
 * Gerbang area admin di SISI SERVER.
 *
 * - Belum login        -> diarahkan ke /login
 * - Login, bukan admin -> diarahkan ke /dashboard
 * - admin / superadmin -> halaman ditampilkan
 *
 * Pengecekan terjadi sebelum HTML dikirim, jadi non-admin tidak pernah
 * melihat kerangka halaman admin. Perlu diingat: layout tidak dijalankan
 * ulang saat berpindah antar halaman DI DALAM /dashboard/admin, sehingga
 * perlindungan data yang sebenarnya tetap ada di database (RLS dan RPC).
 * Gerbang ini adalah lapisan tambahan untuk pengalaman pengguna.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()
  return <>{children}</>
}