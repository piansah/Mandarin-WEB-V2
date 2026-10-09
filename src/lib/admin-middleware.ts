/**
 * ADMIN MIDDLEWARE — Proteksi admin routes
 *
 * Dipakai di admin pages untuk memastikan hanya admin yang bisa akses.
 * Bisa dipakai di server components dan route handlers.
 *
 * Sumber kebenaran role = kolom `user_profile.role` di database.
 * Role yang boleh masuk area admin: "admin" dan "superadmin"
 * (sama seperti verifyAdminRole() di admin-auth.ts).
 */

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

const ADMIN_ROLES = ["admin", "superadmin"]

/**
 * Ambil user + role saat ini dari database.
 * `user` null  -> belum login
 * `role` null  -> sudah login tapi profil tidak ditemukan / query gagal
 */
async function getCurrentUserRole(): Promise<{ user: { id: string } | null; role: string | null }> {
  const supa = await createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return { user: null, role: null }

  const { data, error } = await supa
    .from("user_profile")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    console.error("Gagal membaca role user:", error)
    return { user, role: null }
  }

  return { user, role: data?.role ?? null }
}

/**
 * Middleware untuk admin pages - redirect ke dashboard jika bukan admin
 * Dipakai di server components
 */
export async function requireAdmin() {
  const { user, role } = await getCurrentUserRole()

  if (!user) {
    redirect("/login")
  }

  if (!role || !ADMIN_ROLES.includes(role)) {
    redirect("/dashboard")
  }
}

/**
 * Check admin status tanpa redirect - return boolean
 * Dipakai untuk conditional rendering
 */
export async function checkAdminStatus(): Promise<boolean> {
  const { user, role } = await getCurrentUserRole()
  if (!user || !role) return false
  return ADMIN_ROLES.includes(role)
}