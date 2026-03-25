import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateGithubState } from '@/lib/auth/github-state'

export async function GET(request: NextRequest) {
  // Verify authenticated user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // orgId from query param (set by settings page)
  const orgId = request.nextUrl.searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

  // Verify user is owner/admin of this org
  const service = createServiceClient()
  const { data: member } = await service
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!member || !['owner', 'admin'].includes(member.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Generate CSRF state
  const state = generateGithubState(orgId)

  // Build GitHub OAuth URL
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    scope: 'repo read:org',
    state,
  })

  const response = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  )

  // Store state in cookie for verification in callback
  response.cookies.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })

  return response
}
