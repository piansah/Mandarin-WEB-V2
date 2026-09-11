import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyAdminRole, handleAdminError } from "@/lib/admin-auth"

// GET - Fetch all modul modules
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRole()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const supa = await createClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const levelId = searchParams.get("level_id") || ""

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supa
      .from("modul_modules")
      .select("*", { count: "exact" })
      .order("order_index", { ascending: true })
      .range(from, to)

    if (levelId) {
      query = query.eq("level_id", levelId)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      data,
      count,
      page,
      limit
    })
  } catch (error) {
    return handleAdminError(error, "Failed to fetch modul modules")
  }
}

// POST - Create new modul module
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminRole()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { level_id, title, slug, description, summary, order_index, duration_minutes, part_count, has_quiz, is_published } = body

    if (!level_id || !title || !slug) {
      return NextResponse.json(
        { error: "level_id, title, and slug are required" },
        { status: 400 }
      )
    }

    const supa = await createClient()
    const { data, error } = await supa
      .from("modul_modules")
      .insert({
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
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return handleAdminError(error, "Failed to create modul module")
  }
}
