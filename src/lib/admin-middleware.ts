/**
 * ADMIN MIDDLEWARE — Proteksi admin routes
 * 
 * Dipakai di admin pages untuk memastikan hanya admin yang bisa akses.
 * Bisa dipakai di server components dan route handlers.
 */

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"

/**
 * Middleware untuk admin pages - redirect ke dashboard jika bukan admin
 * Dipakai di server components
 */
export async function requireAdmin() {
  const supa = createClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  const { data } = await supa
    .from("user_profile")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle()

  if (data?.role !== "admin") {
    redirect("/dashboard")
  }
}

/**
 * Check admin status tanpa redirect - return boolean
 * Dipakai untuk conditional rendering
 */
export async function checkAdminStatus(): Promise<boolean> {
  const supa = createClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return false

  const { data } = await supa
    .from("user_profile")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle()

  return data?.role === "admin"
}
