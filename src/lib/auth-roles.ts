/**
 * AUTH ROLES — Role-based access control (sisi client)
 *
 * Menangani pengecekan role user (superadmin/admin/user).
 *
 * PENTING — file ini berjalan di browser, jadi semua pengecekan di sini
 * hanya untuk UX (menampilkan/menyembunyikan menu). Hak akses yang
 * sebenarnya ditegakkan di database (RLS + fungsi RPC + trigger, lihat
 * supabase/migrations/20261009_secure_role_system.sql) dan di server
 * (admin-auth.ts / admin-middleware.ts).
 *
 * Sumber kebenaran role = kolom `user_profile.role`. Tidak ada lagi daftar
 * email yang di-hardcode. Untuk menjadikan seseorang superadmin, ubah
 * rolenya lewat SQL editor / service role (lihat file migrasi).
 *
 * Hierarchy:
 * - superadmin: bisa mengubah role user lain, full CRUD access
 * - admin: bisa kelola user biasa, tapi tidak bisa ubah role siapa pun
 * - user: user biasa, akses fitur belajar saja
 */

import { createClient } from "@/lib/supabase/browser"

export type UserRole = "superadmin" | "admin" | "user"

export interface UserProfileWithRole {
  user_id: string
  display_name: string | null
  role: UserRole
  email: string | null  // Email akan diambil secara terpisah dari auth.users jika diperlukan
  created_at: string | null
  updated_at: string | null
  title_id: string | null
  unlocked_tiers: string[] | null
}

const VALID_ROLES: readonly UserRole[] = ["superadmin", "admin", "user"]

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value)
}

/**
 * Ambil role user saat ini dari database.
 * - Belum login            -> null
 * - Profil tidak ada/error -> "user" (fail-closed: tanpa hak istimewa)
 */
export async function getUserRole(): Promise<UserRole | null> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return null

  try {
    const { data, error } = await supa
      .from("user_profile")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      console.error("Error checking user role:", error)
      return "user"
    }

    return isUserRole(data?.role) ? data.role : "user"
  } catch (catchError) {
    console.error("Exception in getUserRole:", catchError)
    return "user"
  }
}

/**
 * Cek apakah user saat ini adalah superadmin
 */
export async function isSuperAdmin(): Promise<boolean> {
  return (await getUserRole()) === "superadmin"
}

/**
 * Cek apakah user saat ini adalah admin (superadmin atau admin biasa)
 * Dipakai di client-side components
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole()
  return role === "admin" || role === "superadmin"
}

/**
 * Cek apakah user memiliki role tertentu
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  return (await getUserRole()) === role
}

/**
 * Update role user (hanya superadmin).
 *
 * Pengecekan di sini hanya untuk pesan error yang ramah. Yang benar-benar
 * menolak request dari non-superadmin adalah fungsi RPC
 * `update_user_role_admin` + trigger di database.
 */
export async function updateUserRole(
  targetUserId: string,
  newRole: UserRole
): Promise<{ error: string | null }> {
  if (!isUserRole(newRole)) {
    return { error: "Role tidak valid" }
  }

  if (!(await isSuperAdmin())) {
    return { error: "Unauthorized: Only superadmins can change roles" }
  }

  const supa = createClient()
  const { error } = await supa.rpc("update_user_role_admin", {
    target_user_id: targetUserId,
    new_role: newRole,
  })

  if (error) {
    console.error("Error updating user role:", error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Ambil semua user dengan role (untuk admin dashboard)
 * - Superadmin: semua user
 * - Admin biasa: hanya user biasa dan admin biasa
 * - Lainnya: kosong
 *
 * Pembatasan yang sebenarnya dilakukan di dalam fungsi RPC (SECURITY DEFINER
 * dengan pengecekan role), bukan di sini.
 */
export async function getAllUsersWithRoles(): Promise<UserProfileWithRole[]> {
  const supa = createClient()
  const role = await getUserRole()

  if (role !== "admin" && role !== "superadmin") {
    return []
  }

  const rpcName = role === "superadmin" ? "get_all_users_admin" : "get_users_for_regular_admin"
  const { data, error } = await supa.rpc(rpcName)

  if (error) {
    console.error(`Error fetching users via RPC (${rpcName}):`, error)
    return []
  }

  return (data ?? []) as unknown as UserProfileWithRole[]
}

/**
 * Ambil statistik admin untuk dashboard
 * Memakai sumber data yang sama dengan getAllUsersWithRoles() untuk konsistensi
 */
export async function getAdminStats(): Promise<{
  totalUsers: number
  activeToday: number
  adminUsers: number
}> {
  const empty = { totalUsers: 0, activeToday: 0, adminUsers: 0 }

  try {
    const users = await getAllUsersWithRoles()
    if (users.length === 0) return empty

    const totalUsers = users.length
    const adminUsers = users.filter((u) => u.role === "admin" || u.role === "superadmin").length

    // Active today = users yang updated hari ini
    const today = new Date().toISOString().split("T")[0]
    const activeToday = users.filter((u) => u.updated_at?.startsWith(today)).length

    return { totalUsers, activeToday, adminUsers }
  } catch (error) {
    console.error("Error fetching admin stats:", error)
    return empty
  }
}