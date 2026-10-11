import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Pastikan parameter `next` hanya mengarah ke path internal situs ini.
 *
 * Mencegah open redirect, contoh serangan:
 *   ?next=@evil.com   -> https://situs-kita@evil.com (host sebenarnya: evil.com)
 *   ?next=//evil.com  -> protocol-relative URL
 *   ?next=/\evil.com  -> browser menganggap "\" sama dengan "/"
 *   ?next=https://evil.com
 *
 * Kalau tidak valid, fallback ke "/".
 */
function getSafeNextPath(rawNext: string | null, origin: string): string {
  const fallback = '/'
  if (!rawNext) return fallback

  // Harus diawali satu "/" saja, bukan "//" dan tanpa backslash.
  if (!rawNext.startsWith('/') || rawNext.startsWith('//') || rawNext.includes('\\')) {
    return fallback
  }

  // Lapis kedua: parse sebagai URL dan pastikan origin-nya tetap origin kita.
  try {
    const parsed = new URL(rawNext, origin)
    if (parsed.origin !== origin) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = getSafeNextPath(searchParams.get('next'), origin)

  if (code) {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && session?.user) {
      // Ensure user profile exists
      const user = session.user
      const { data: profile } = await supabase
        .from('user_profile')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile) {
        const displayName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Pelajar'

        const { error: insertError } = await supabase.from('user_profile').insert({
          user_id: user.id,
          display_name: displayName,
          has_seen_onboarding: false,
          unlocked_tiers: ['pemula'],
        })

        if (insertError) {
          // Jangan blokir login hanya karena insert profil gagal,
          // tapi catat supaya ketahuan di log server.
          console.error('Gagal membuat user_profile:', insertError)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=CouldNotAuthenticate`)
}