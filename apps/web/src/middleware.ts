// apps/web/src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Protected routes: /[org]/* and /select-org
  const isProtected = /^\/(select-org|[^/]+\/(dashboard|settings))/.test(pathname)

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Org routes: verify membership via JWT claim
  const orgRouteMatch = pathname.match(/^\/([^/]+)\/(dashboard|settings)/)
  if (orgRouteMatch && user) {
    const orgSlug = orgRouteMatch[1]

    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (!org) {
      return NextResponse.redirect(new URL('/select-org', request.url))
    }

    const session = await supabase.auth.getSession()
    const jwt = session.data.session?.access_token
    if (jwt) {
      // Decode JWT claims (no verification needed — Supabase already verified)
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      const orgRoles = payload.org_roles ?? {}
      if (!orgRoles[org.id]) {
        return NextResponse.redirect(new URL('/select-org', request.url))
      }
      // Set on request headers so Server Components can read them via headers()
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-org-id', org.id)
      requestHeaders.set('x-org-role', orgRoles[org.id])
      return NextResponse.next({ request: { headers: requestHeaders } })
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
