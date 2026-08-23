import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && session?.user) {
      // Ensure user profile exists
      const user = session.user;
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

        await supabase.from('user_profile').insert({
          user_id: user.id,
          display_name: displayName,
          has_seen_onboarding: false,
          unlocked_tiers: ['pemula'],
        })
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=CouldNotAuthenticate`)
}
