import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyGithubState } from '@/lib/auth/github-state'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const stateCookie = request.cookies.get('github_oauth_state')?.value

  // Validate state (CSRF check)
  if (!code || !stateParam || !stateCookie || stateParam !== stateCookie) {
    return redirectToSettingsWithError(request)
  }

  const verified = verifyGithubState(stateParam)
  if (!verified) return redirectToSettingsWithError(request)

  const { orgId } = verified

  // Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })

  if (!tokenRes.ok) return redirectToSettingsWithError(request)

  const tokenData = await tokenRes.json()
  const accessToken = tokenData.access_token as string | undefined
  if (!accessToken) return redirectToSettingsWithError(request)

  // Fetch user's GitHub orgs to determine github_org
  const orgsRes = await fetch('https://api.github.com/user/orgs', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
  })

  let githubOrg: string | null = null
  if (orgsRes.ok) {
    const orgs = await orgsRes.json() as Array<{ login: string }>
    githubOrg = orgs[0]?.login ?? null
  }

  // If no org found, fall back to user login
  if (!githubOrg) {
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    })
    if (userRes.ok) {
      const userData = await userRes.json() as { login: string }
      githubOrg = userData.login
    }
  }

  // Store token in DB
  const service = createServiceClient()
  const { error } = await service
    .from('organizations')
    .update({ github_access_token: accessToken, github_org: githubOrg } as any)
    .eq('id', orgId)

  if (error) return redirectToSettingsWithError(request)

  // Lookup org slug for redirect
  const { data: org } = await service
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .single()

  const slug = org?.slug ?? ''
  const response = NextResponse.redirect(new URL(`/${slug}/settings`, request.url))

  // Clear the state cookie
  response.cookies.delete('github_oauth_state')

  return response
}

function redirectToSettingsWithError(request: NextRequest): NextResponse {
  // We don't know the org slug here — redirect to select-org as fallback
  const response = NextResponse.redirect(new URL('/select-org?github_error=true', request.url))
  response.cookies.delete('github_oauth_state')
  return response
}
