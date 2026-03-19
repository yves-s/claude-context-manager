// apps/web/src/app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { acceptInvite } from '@/lib/auth/actions'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/select-org'
  const inviteToken = searchParams.get('invite')

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      if (inviteToken) {
        const result = await acceptInvite(inviteToken, data.user.id)
        if (!result.error && result.orgSlug) {
          return NextResponse.redirect(`${origin}/${result.orgSlug}/dashboard`)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
