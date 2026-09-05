/**
 * AUTH ROLES — Role-based access control
 * 
 * Menangani pengecekan role user (superadmin/admin/user) dan authorization
 * untuk proteksi admin routes dan features.
 * 
 * Menggunakan kombinasi hardcoded admin emails + database role check
 * untuk menghindari circular logic di RLS policies.
 * 
 * Hierarchy:
 * - superadmin: bisa menambah/hapus admin, full CRUD access
 * - admin: bisa kelola user biasa, tapi tidak bisa ubah role admin lain
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
}

// Hardcoded superadmin emails (hanya superadmin yang bisa menambah/hapus admin)
const SUPERADMIN_EMAILS = [
  "alifalpian157@gmail.com",
  // Tambah email superadmin lain di sini jika perlu
]

// Hardcoded admin emails (termasuk superadmin untuk backward compatibility)
const ADMIN_EMAILS = [
  "alifalpian157@gmail.com",
  // Tambah email admin biasa di sini jika perlu
]

/**
 * Cek apakah user saat ini adalah superadmin
 * Hanya superadmin yang bisa menambah/hapus admin lain
 */
export async function isSuperAdmin(): Promise<boolean> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return false

  const userEmail = user.email?.toLowerCase()

  // Cek berdasarkan hardcoded superadmin emails
  if (userEmail && SUPERADMIN_EMAILS.includes(userEmail)) {
    return true
  }

  // Fallback ke database check
  try {
    const { data, error } = await supa
      .from("user_profile")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      console.error("Error checking superadmin role:", error)
      return false
    }

    return data?.role === "superadmin"
  } catch (catchError) {
    console.error("Exception in isSuperAdmin:", catchError)
    return false
  }
}

/**
 * Cek apakah user saat ini adalah admin (superadmin atau admin biasa)
 * Dipakai di client-side components
 */
export async function isAdmin(): Promise<boolean> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return false

  const userEmail = user.email?.toLowerCase()

  // Cek berdasarkan hardcoded admin emails (termasuk superadmin)
  if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
    return true
  }

  // Fallback ke database check
  try {
    const { data, error } = await supa
      .from("user_profile")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      console.error("Error checking admin role:", error)
      return false
    }

    return data?.role === "admin" || data?.role === "superadmin"
  } catch (catchError) {
    console.error("Exception in isAdmin:", catchError)
    return false
  }
}

/**
 * Ambil role user saat ini
 */
export async function getUserRole(): Promise<UserRole | null> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return null

  const userEmail = user.email?.toLowerCase()

  // Cek hardcoded emails dulu
  if (userEmail && SUPERADMIN_EMAILS.includes(userEmail)) {
    return "superadmin"
  }
  if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
    return "admin"
  }

  // Fallback ke database check
  const { data } = await supa
    .from("user_profile")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle()

  return (data?.role as UserRole) ?? "user"
}

/**
 * Update role user (hanya superadmin yang bisa menambah/hapus admin)
 * Admin biasa tidak bisa mengubah role user lain
 */
export async function updateUserRole(
  targetUserId: string,
  newRole: "admin" | "user" | "superadmin"
): Promise<{ error: string | null }> {
  // Cek apakah caller adalah superadmin
  const callerIsSuperAdmin = await isSuperAdmin()
  if (!callerIsSuperAdmin) {
    return { error: "Unauthorized: Only superadmins can change roles" }
  }

  const supa = createClient()
  
  // Coba gunakan RPC untuk bypass RLS
  const { data, error } = await supa.rpc('update_user_role_admin', {
    target_user_id: targetUserId,
    new_role: newRole
  })
  
  if (error) {
    console.error("RPC error, trying direct update:", error)
    // Fallback ke direct update jika RPC tidak ada
    const { error: directError } = await supa
      .from("user_profile")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("user_id", targetUserId)
    
    if (directError) {
      console.error("Direct update error:", directError)
      return { error: directError.message }
    }
  }
  
  console.log("Role update successful:", { targetUserId, newRole })
  return { error: null }
}

/**
 * Ambil semua user dengan role (untuk admin dashboard)
 * Superadmin bisa melihat semua user, admin biasa hanya bisa melihat user biasa dan admin biasa
 * 
 * NOTE: Karena RLS policies bermasalah, kita bypass dengan query langsung
 * tapi tetap validasi di application layer
 */
export async function getAllUsersWithRoles(): Promise<UserProfileWithRole[]> {
  const supa = createClient()
  
  // Cek apakah caller adalah superadmin
  const callerIsSuperAdmin = await isSuperAdmin()
  
  // Cek apakah caller adalah admin (bukan superadmin)
  const callerIsAdmin = await isAdmin()
  const callerIsRegularAdmin = callerIsAdmin && !callerIsSuperAdmin

  console.log("getAllUsersWithRoles - Role check:", { callerIsSuperAdmin, callerIsAdmin, callerIsRegularAdmin })

  if (!callerIsAdmin) {
    console.log("getAllUsersWithRoles - Not authorized")
    return []
  }

  // Gunakan rpc untuk bypass RLS jika superadmin
  if (callerIsSuperAdmin) {
    const { data, error } = await supa.rpc('get_all_users_admin')
    if (error) {
      console.error("Error fetching users via RPC:", error)
      // Fallback ke query biasa jika RPC tidak ada
      const { data: fallbackData, error: fallbackError } = await supa
        .from("user_profile")
        .select("user_id, display_name, role, created_at, updated_at")
        .order("created_at", { ascending: false })
      
      if (fallbackError) {
        console.error("Error fetching users (fallback):", fallbackError)
        return []
      }
      
      console.log("getAllUsersWithRoles - Success (fallback):", { count: fallbackData?.length, roles: fallbackData?.map((u: any) => u.role) })
      return fallbackData as UserProfileWithRole[] || []
    }
    
    console.log("getAllUsersWithRoles - Success (RPC):", { count: data?.length, roles: data?.map((u: any) => u.role) })
    return data as UserProfileWithRole[] || []
  }

  // Admin biasa - gunakan RPC untuk bypass RLS dan filter user/admin biasa
  if (callerIsRegularAdmin) {
    const { data, error } = await supa.rpc('get_users_for_regular_admin')
    if (error) {
      console.error("Error fetching users via RPC (regular admin):", error)
      // Fallback ke query biasa
      let query = supa
        .from("user_profile")
        .select("user_id, display_name, role, created_at, updated_at")
        .order("created_at", { ascending: false })
      
      query = query.in("role", ["user", "admin"])
      
      const { data: fallbackData, error: fallbackError } = await query
      if (fallbackError) {
        console.error("Error fetching users (fallback):", fallbackError)
        return []
      }
      
      console.log("getAllUsersWithRoles - Success (fallback):", { count: fallbackData?.length, roles: fallbackData?.map((u: any) => u.role) })
      return fallbackData as UserProfileWithRole[] || []
    }
    
    console.log("getAllUsersWithRoles - Success (RPC regular admin):", { count: data?.length, roles: data?.map((u: any) => u.role) })
    return data as UserProfileWithRole[] || []
  }

  // Fallback untuk kasus lain (tidak seharusnya terjadi)
  console.log("getAllUsersWithRoles - Unexpected state, returning empty")
  return []
}

/**
 * Cek apakah user memiliki role tertentu
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const userRole = await getUserRole()
  return userRole === role
}

/**
 * Ambil statistik admin untuk dashboard
 * Menggunakan logic yang sama dengan getAllUsersWithRoles() untuk konsistensi
 */
export async function getAdminStats(): Promise<{
  totalUsers: number
  activeToday: number
  adminUsers: number
}> {
  const supa = createClient()
  
  console.log("getAdminStats: Starting to fetch admin stats")
  
  try {
    // Gunakan RPC yang sama dengan user management untuk konsistensi
    const callerIsSuperAdmin = await isSuperAdmin()
    const callerIsAdmin = await isAdmin()
    
    if (!callerIsAdmin) {
      console.log("getAdminStats: Not authorized")
      return { totalUsers: 0, activeToday: 0, adminUsers: 0 }
    }
    
    // Gunakan RPC yang sama dengan user management
    const { data, error } = await supa.rpc(callerIsSuperAdmin ? 'get_all_users_admin' : 'get_users_for_regular_admin')
    
    if (error) {
      console.error("Error fetching admin stats via RPC:", error)
      console.error("Error details:", { code: error.code, message: error.message, details: error.details, hint: error.hint })
      return { totalUsers: 0, activeToday: 0, adminUsers: 0 }
    }
    
    const users = data as UserProfileWithRole[] || []
    const totalUsers = users.length
    const adminUsers = users.filter((u: any) => u.role === 'admin' || u.role === 'superadmin').length
    
    // Active today = users yang updated hari ini
    const today = new Date().toISOString().split('T')[0]
    const activeToday = users.filter((u: any) => u.updated_at?.startsWith(today)).length
    
    console.log("Admin stats (success):", { totalUsers, activeToday, adminUsers })
    return { totalUsers, activeToday, adminUsers }
  } catch (error) {
    console.error("Error fetching admin stats:", error)
    return { totalUsers: 0, activeToday: 0, adminUsers: 0 }
  }
}
