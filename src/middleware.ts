import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Halaman yang wajib login. Tambah prefix lain di sini kalau perlu.
const PROTECTED_PREFIXES = ["/dashboard"]

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // WAJIB dipanggil supaya token direfresh — jangan hapus / taruh logic
  // antara createServerClient dan getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  )

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Sudah login tapi masih buka /login → lempar ke dashboard.
  if (request.nextUrl.pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Placement test (pemicu unlock tier awal) belum dikerjakan → paksa ke
  // /dashboard/placement dulu sebelum bisa akses halaman dashboard lain.
  // `has_seen_onboarding` dipakai sebagai penanda "setup awal selesai",
  // sama seperti di project lama.
  const isPlacementRoute = request.nextUrl.pathname.startsWith("/dashboard/placement")
  if (isProtected && user && !isPlacementRoute) {
    const { data: profile } = await supabase
      .from("user_profile")
      .select("has_seen_onboarding")
      .eq("user_id", user.id)
      .maybeSingle()

    if (profile && profile.has_seen_onboarding === false) {
      return NextResponse.redirect(new URL("/dashboard/placement", request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Jalan di semua route KECUALI:
     * - static assets Next.js (_next/static, _next/image)
     * - favicon, gambar umum
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
