import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyAdminRole, handleAdminError } from "@/lib/admin-auth"

// GET - Fetch single modul module
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
      .from("modul_modules")
      .select("*")
      .eq("id", id)
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return handleAdminError(error, "Failed to fetch modul module")
  }
}

// PUT - Update modul module
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
    const { level_id, title, slug, description, summary, order_index, duration_minutes, part_count, has_quiz, is_published } = body
    const { id } = await params

    const supa = await createClient()
    const { data, error } = await supa
      .from("modul_modules")
      .update({
        level_id,
        title,
        slug,
        description: description || null,
        summary: summary || null,
        order_index: order_index || 0,
        duration_minutes: duration_minutes || 0,
        part_count: part_count || 0,
        has_quiz: has_quiz || false,
        is_published: is_published !== undefined ? is_published : true
      })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return handleAdminError(error, "Failed to update modul module")
  }
}

// DELETE - Delete modul module
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

    // Check for related parts
    const { count: partCount } = await supa
      .from("modul_module_parts")
      .select("*", { count: "exact", head: true })
      .eq("module_id", id)

    if (partCount && partCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${partCount} parts are linked to this module` },
        { status: 400 }
      )
    }

    const { error } = await supa
      .from("modul_modules")
      .delete()
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAdminError(error, "Failed to delete modul module")
  }
}
