import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyAdminRole, handleAdminError } from "@/lib/admin-auth"

// GET - Fetch single modul level
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminRole()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    const supa = await createClient()
    const { data, error } = await supa
      .from("modul_levels")
      .select("*")
      .eq("id", id)
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return handleAdminError(error, "Failed to fetch modul level")
  }
}

// PUT - Update modul level
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminRole()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { code, label, description, order_index } = body
    const { id } = await params

    const supa = await createClient()
    const { data, error } = await supa
      .from("modul_levels")
      .update({
        code,
        label,
        description: description || null,
        order_index: order_index || 0
      })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return handleAdminError(error, "Failed to update modul level")
  }
}

// DELETE - Delete modul level
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminRole()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    const supa = await createClient()

    // Check for related modules
    const { count: moduleCount } = await supa
      .from("modul_modules")
      .select("*", { count: "exact", head: true })
      .eq("level_id", id)

    if (moduleCount && moduleCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${moduleCount} modules are linked to this level` },
        { status: 400 }
      )
    }

    const { error } = await supa
      .from("modul_levels")
      .delete()
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAdminError(error, "Failed to delete modul level")
  }
}
