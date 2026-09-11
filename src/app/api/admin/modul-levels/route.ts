import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyAdminRole, handleAdminError } from "@/lib/admin-auth"

// GET - Fetch all modul levels
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

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supa
      .from("modul_levels")
      .select("*", { count: "exact" })
      .order("order_index", { ascending: true })
      .range(from, to)

    if (search) {
      query = query.or(`code.ilike.%${search}%,label.ilike.%${search}%,description.ilike.%${search}%`)
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
    return handleAdminError(error, "Failed to fetch modul levels")
  }
}

// POST - Create new modul level
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminRole()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { code, label, description, order_index } = body

    if (!code || !label) {
      return NextResponse.json(
        { error: "code and label are required" },
        { status: 400 }
      )
    }

    const supa = await createClient()
    const { data, error } = await supa
      .from("modul_levels")
      .insert({
        code,
        label,
        description: description || null,
        order_index: order_index || 0
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return handleAdminError(error, "Failed to create modul level")
  }
}
