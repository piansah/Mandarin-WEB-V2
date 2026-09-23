import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function verifyAdminRole() {
  const supa = await createClient()
  
  const { data: { user }, error: userError } = await supa.auth.getUser()
  
  if (userError || !user) {
    return { error: "Unauthorized", status: 401 }
  }

  // Get user role from user_profile table
  const { data: profile, error: profileError } = await supa
    .from("user_profile")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return { error: "Profile not found", status: 404 }
  }

  if (profile.role !== "admin" && profile.role !== "superadmin") {
    return { error: "Forbidden: Admin access required", status: 403 }
  }

  return { user, profile, error: null, status: 200 }
}

export function handleAdminError(error: unknown, defaultMessage: string = "Internal server error") {
  console.error(defaultMessage, error)
  return NextResponse.json(
    { error: defaultMessage },
    { status: 500 }
  )
}
