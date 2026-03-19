# CCM Web App — Auth + Multi-Tenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the auth + multi-tenant foundation of the CCM SaaS Web App: signup, login (Email + Google + Microsoft), org creation, invite flow, and JWT-based middleware.

**Architecture:** Next.js 14 App Router in `apps/web/` within the existing monorepo. Supabase handles auth (three providers), PostgreSQL (three tables with RLS), and JWT custom claims for zero-DB-round-trip middleware. Server Actions handle all mutations.

**Tech Stack:** Next.js 14, Supabase (Auth + PostgreSQL + RLS), shadcn/ui, Tailwind CSS, Vitest, Vercel

---

## File Map

```
apps/web/
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── components.json                    shadcn config
├── vitest.config.ts
├── .env.local.example                 env template (committed)
├── supabase/
│   └── migrations/
│       └── 0001_auth_multitenant.sql  DB schema + RLS + JWT hook
├── src/
│   ├── test-setup.ts                  Vitest global setup (@testing-library/jest-dom)
│   ├── app/
│   │   ├── layout.tsx                 Root layout (wraps AuthProvider)
│   │   ├── page.tsx                   Landing (public stub)
│   │   ├── auth/
│   │   │   ├── login/page.tsx         Login page
│   │   │   ├── signup/page.tsx        Signup page
│   │   │   ├── callback/route.ts      OAuth callback handler
│   │   │   └── create-org/page.tsx    Create org after signup
│   │   ├── invite/
│   │   │   └── [token]/page.tsx       Accept invite landing
│   │   ├── select-org/
│   │   │   ├── page.tsx               Multi-org selector (sets ccm_last_org cookie)
│   │   │   └── select-org-list.tsx    Client component — sets ccm_last_org cookie on click
│   │   └── [org]/
│   │       ├── layout.tsx             Org layout (reads x-org-id header, wraps OrgProvider)
│   │       ├── dashboard/page.tsx     Dashboard stub
│   │       └── settings/
│   │           └── page.tsx           Member management
│   ├── components/
│   │   ├── auth/
│   │   │   ├── login-form.tsx         Email + SSO login form
│   │   │   └── signup-form.tsx        Email signup form (forwards ?invite= param)
│   │   └── org/
│   │       ├── org-switcher.tsx       Header org switcher (writes ccm_last_org cookie)
│   │       ├── member-list.tsx        Members table
│   │       └── invite-form.tsx        Send invite form
│   ├── providers/
│   │   ├── auth-provider.tsx          AuthProvider (onAuthStateChange, session context)
│   │   └── org-provider.tsx           OrgProvider (active org + role context)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              Browser Supabase client
│   │   │   ├── server.ts              Server Component client (cookies)
│   │   │   └── service.ts             Service Role client (bypasses RLS)
│   │   └── auth/
│   │       ├── actions.ts             All Server Actions
│   │       └── actions.test.ts        Vitest unit tests
│   └── middleware.ts                  Edge middleware (session + org check, sets x-org-id on request)
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/components.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/.env.local.example`

- [ ] **Step 1: Create apps/web directory and scaffold Next.js**

```bash
mkdir -p apps/web
cd apps/web
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --no-import-alias \
  --turbopack
```

When prompted for project name, accept default (`.`).

- [ ] **Step 2: Install Supabase, shadcn, and test dependencies**

```bash
cd apps/web
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
npx shadcn@latest init
```

For shadcn init, choose:
- Style: New York
- Base color: Zinc
- CSS variables: Yes

- [ ] **Step 3: Install shadcn components needed for auth**

```bash
cd apps/web
npx shadcn@latest add button input label card form
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 5: Create test setup file**

```typescript
// apps/web/src/test-setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Create .env.local.example**

```bash
# apps/web/.env.local.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Copy to `.env.local` and fill in real values from Supabase dashboard.

- [ ] **Step 7: Verify scaffold runs**

```bash
cd apps/web
npm run dev
```

Expected: Server starts on http://localhost:3000, default Next.js page visible.

- [ ] **Step 8: Commit**

```bash
cd /Users/yves/Developer/claude-context-manager
git add apps/web
git commit -m "feat(web): scaffold Next.js 14 + Supabase + shadcn/ui"
```

---

## Task 2: Supabase DB Migration

**Files:**
- Create: `apps/web/supabase/migrations/0001_auth_multitenant.sql`

- [ ] **Step 1: Create migrations directory**

```bash
mkdir -p apps/web/supabase/migrations
```

- [ ] **Step 2: Write migration file**

```sql
-- apps/web/supabase/migrations/0001_auth_multitenant.sql

-- Organizations (tenants)
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  github_org  text,
  plan        text NOT NULL DEFAULT 'free',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Organization members
CREATE TABLE organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Invitations (id = invite token)
CREATE TABLE invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           text,
  role            text NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by      uuid NOT NULL REFERENCES auth.users(id),
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at     timestamptz
);

-- RLS: enable on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- RLS: organizations — user sees only their orgs
CREATE POLICY "users see their orgs"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS: organization_members — user sees members of their orgs
CREATE POLICY "users see members of their orgs"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS: invitations — admins/owners see invites for their orgs
CREATE POLICY "admins see org invitations"
  ON invitations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- JWT Custom Claims Hook: adds org_roles to JWT
-- This lets middleware check membership without a DB round-trip
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  org_roles jsonb;
BEGIN
  claims := event -> 'claims';

  SELECT jsonb_object_agg(organization_id::text, role)
  INTO org_roles
  FROM organization_members
  WHERE user_id = (event ->> 'user_id')::uuid;

  claims := jsonb_set(
    claims,
    '{org_roles}',
    COALESCE(org_roles, '{}'::jsonb)
  );

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
```

- [ ] **Step 3: Apply migration via Supabase CLI**

```bash
cd apps/web
supabase db push
```

Expected output: `Connecting to remote database... OK` followed by `Applied migration 0001_auth_multitenant`.

If Supabase CLI is not installed: `brew install supabase/tap/supabase` and `supabase login` first. Alternatively paste the SQL directly in Supabase Dashboard → SQL Editor → Run.

- [ ] **Step 4: Enable JWT hook in Supabase Dashboard**

Go to: Authentication → Hooks → **Custom Access Token Hook**
Set function: `public.custom_access_token_hook`
Save.

- [ ] **Step 5: Verify schema**

In Supabase Dashboard → Table Editor: confirm `organizations`, `organization_members`, `invitations` tables exist with correct columns.

- [ ] **Step 6: Commit**

```bash
git add apps/web/supabase
git commit -m "feat(web): add Supabase schema — organizations, members, invitations + RLS + JWT hook"
```

---

## Task 3: Supabase Client Helpers

**Files:**
- Create: `apps/web/src/lib/supabase/client.ts`
- Create: `apps/web/src/lib/supabase/server.ts`
- Create: `apps/web/src/lib/supabase/service.ts`

- [ ] **Step 1: Browser client (for Client Components)**

```typescript
// apps/web/src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Server client (for Server Components + Server Actions)**

```typescript
// apps/web/src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — cookies can't be set, OK
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Service role client (bypasses RLS — server only)**

```typescript
// apps/web/src/lib/supabase/service.ts
import { createClient } from '@supabase/supabase-js'

// NEVER import this in client components or expose to browser
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/supabase
git commit -m "feat(web): add Supabase client helpers (browser, server, service role)"
```

---

## Task 4: Server Actions + Tests

**Files:**
- Create: `apps/web/src/lib/auth/actions.ts`
- Create: `apps/web/src/lib/auth/actions.test.ts`

- [ ] **Step 1: Write failing tests first**

```typescript
// apps/web/src/lib/auth/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase clients
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ getAll: () => [], setAll: () => {} })),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateSlug, createOrganization, acceptInvite, createInvite, revokeInvite } from './actions'

describe('generateSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(generateSlug('My Company')).toBe('my-company')
  })

  it('strips special characters', () => {
    expect(generateSlug('Acme & Co.')).toBe('acme-co')
  })

  it('collapses multiple hyphens', () => {
    expect(generateSlug('a  b')).toBe('a-b')
  })
})

describe('createOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error if user not authenticated', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const result = await createOrganization('My Org')
    expect(result.error).toBe('Not authenticated')
  })

  it('creates org and member on success', async () => {
    const mockInsertOrg = vi.fn().mockResolvedValue({ data: [{ id: 'org-1', slug: 'my-org' }], error: null })
    const mockInsertMember = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockFrom = vi.fn((table: string) => ({
      insert: table === 'organizations' ? mockInsertOrg : mockInsertMember,
      select: vi.fn().mockReturnThis(),
    }))
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
      from: mockFrom,
    })
    const result = await createOrganization('My Org')
    expect(result.error).toBeNull()
    expect(result.slug).toBe('my-org')
  })
})

describe('acceptInvite', () => {
  it('returns error if token not found', async () => {
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      })),
    })
    const result = await acceptInvite('bad-token', 'user-1')
    expect(result.error).toMatch(/not found/i)
  })

  it('returns error if invite expired', async () => {
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'invite-1',
            organization_id: 'org-1',
            role: 'member',
            expires_at: new Date(Date.now() - 1000).toISOString(),
            accepted_at: null,
          },
          error: null,
        }),
      })),
    })
    const result = await acceptInvite('expired-token', 'user-1')
    expect(result.error).toMatch(/expired/i)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/web
npx vitest run src/lib/auth/actions.test.ts
```

Expected: FAIL — `actions` module not found.

- [ ] **Step 3: Implement actions.ts**

```typescript
// apps/web/src/lib/auth/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

// --- Helpers ---

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function getUniqueSlug(base: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  let slug = base
  let suffix = 2
  while (true) {
    const { data } = await supabase.from('organizations').select('id').eq('slug', slug).single()
    if (!data) return slug
    slug = `${base}-${suffix++}`
  }
}

// --- Server Actions ---

export async function createOrganization(
  name: string
): Promise<{ slug: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { slug: null, error: 'Not authenticated' }

  const baseSlug = generateSlug(name)
  const slug = await getUniqueSlug(baseSlug, supabase)

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name, slug })
    .select('id, slug')
    .single()

  if (orgError || !org) return { slug: null, error: orgError?.message ?? 'Failed to create org' }

  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({ organization_id: org.id, user_id: user.id, role: 'owner' })

  if (memberError) return { slug: null, error: memberError.message }

  return { slug: org.slug, error: null }
}

export async function acceptInvite(
  token: string,
  userId: string
): Promise<{ orgSlug: string | null; error: string | null }> {
  const service = createServiceClient()

  const { data: invite, error } = await service
    .from('invitations')
    .select('id, organization_id, role, expires_at, accepted_at, organizations(slug)')
    .eq('id', token)
    .single()

  if (error || !invite) return { orgSlug: null, error: 'Invite not found' }
  if (invite.accepted_at) return { orgSlug: null, error: 'Invite already used' }
  if (new Date(invite.expires_at) < new Date()) return { orgSlug: null, error: 'Invite expired' }

  await service
    .from('organization_members')
    .insert({ organization_id: invite.organization_id, user_id: userId, role: invite.role })

  await service
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', token)

  const org = invite.organizations as { slug: string } | null
  return { orgSlug: org?.slug ?? null, error: null }
}

export async function createInvite(
  orgId: string,
  role: 'admin' | 'member',
  email?: string
): Promise<{ token: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { token: null, error: 'Not authenticated' }

  // Verify caller is admin or owner
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { token: null, error: 'Insufficient permissions' }
  }

  const { data: invite, error } = await supabase
    .from('invitations')
    .insert({ organization_id: orgId, role, email: email ?? null, invited_by: user.id })
    .select('id')
    .single()

  if (error || !invite) return { token: null, error: error?.message ?? 'Failed to create invite' }
  return { token: invite.id, error: null }
}

export async function revokeInvite(
  inviteId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify ownership via RLS (RLS will reject if not admin+)
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', inviteId)

  return { error: error?.message ?? null }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/web
npx vitest run src/lib/auth/actions.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auth
git commit -m "feat(web): add auth Server Actions with tests (createOrg, acceptInvite, createInvite, revokeInvite)"
```

---

## Task 5: Middleware

**Files:**
- Create: `apps/web/src/middleware.ts`

- [ ] **Step 1: Implement middleware**

```typescript
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
    // JWT custom claim contains org_roles: { orgId: role }
    // We need to look up the org id by slug to check membership.
    // For now: fetch org id from DB (one-time per request for org routes).
    // TODO: cache org slug→id mapping in edge config for zero-DB middleware.
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
```

- [ ] **Step 2: Verify middleware doesn't break dev server**

```bash
cd apps/web
npm run dev
```

Test:
1. Visit http://localhost:3000 — loads normally (no redirect for public route)
2. Visit http://localhost:3000/some-org/dashboard without being logged in — should redirect to `/auth/login?redirectTo=/some-org/dashboard`
3. After logging in, visit http://localhost:3000/some-org/dashboard where `some-org` is a slug you are NOT a member of — should redirect to `/select-org`

If either redirect does not happen, check that the `matcher` pattern in `config` covers the route and that `.auth.getUser()` returns no user for the unauthenticated case.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "feat(web): add edge middleware — session guard + org membership check"
```

---

## Task 6: Auth Providers + Root Layout + Landing

**Files:**
- Create: `apps/web/src/providers/auth-provider.tsx`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`

- [ ] **Step 1: AuthProvider (Client Component — session context)**

```typescript
// apps/web/src/providers/auth-provider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface AuthContextValue {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 2: Root layout — wraps children in AuthProvider**

```typescript
// apps/web/src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/providers/auth-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CCM — Claude Context Manager',
  description: 'Centralize your Claude context across your team',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Landing page stub**

```typescript
// apps/web/src/app/page.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">CCM</h1>
      <p className="text-muted-foreground">Claude Context Manager for teams</p>
      <div className="flex gap-2">
        <Button asChild><Link href="/auth/login">Log in</Link></Button>
        <Button variant="outline" asChild><Link href="/auth/signup">Sign up</Link></Button>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/providers apps/web/src/app/layout.tsx apps/web/src/app/page.tsx
git commit -m "feat(web): add AuthProvider, root layout, landing page"
```

---

## Task 7: Auth Form Components + Pages

**Files:**
- Create: `apps/web/src/app/auth/login/page.tsx`
- Create: `apps/web/src/app/auth/signup/page.tsx`
- Create: `apps/web/src/app/auth/callback/route.ts`
- Create: `apps/web/src/app/auth/create-org/page.tsx`
- Create: `apps/web/src/components/auth/login-form.tsx`
- Create: `apps/web/src/components/auth/signup-form.tsx`

- [ ] **Step 1: Login form component**

```typescript
// apps/web/src/components/auth/login-form.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    // On success, middleware + server redirect handles navigation
  }

  async function handleSSO(provider: 'google' | 'azure') {
    await supabase.auth.signInWithOAuth({
      provider: provider === 'azure' ? 'azure' : 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
      <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or continue with</span></div></div>
      <Button type="button" variant="outline" onClick={() => handleSSO('google')}>Google</Button>
      <Button type="button" variant="outline" onClick={() => handleSSO('azure')}>Microsoft</Button>
    </form>
  )
}
```

- [ ] **Step 2: Login page**

```typescript
// apps/web/src/app/auth/login/page.tsx
import { LoginForm } from '@/components/auth/login-form'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-semibold">Sign in to CCM</h1>
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="underline">Sign up</Link>
        </p>
      </div>
      <LoginForm />
    </main>
  )
}
```

- [ ] **Step 3: Signup form component (forwards ?invite= param)**

```typescript
// apps/web/src/components/auth/signup-form.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  invite?: string  // invite token from ?invite= URL param
}

export function SignupForm({ invite }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  // Build callback URL: if invite present, pass token so callback can accept it after email verify
  function callbackUrl(next?: string) {
    const params = new URLSearchParams()
    if (invite) params.set('invite', invite)
    if (next) params.set('next', next)
    const qs = params.toString()
    return `${location.origin}/auth/callback${qs ? '?' + qs : ''}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // emailRedirectTo carries the invite token so it survives the email verification click
        emailRedirectTo: callbackUrl(invite ? undefined : '/auth/create-org'),
      },
    })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
  }

  async function handleSSO(provider: 'google' | 'azure') {
    await supabase.auth.signInWithOAuth({
      provider: provider === 'azure' ? 'azure' : 'google',
      options: { redirectTo: callbackUrl(invite ? undefined : '/auth/create-org') },
    })
  }

  if (done) {
    return (
      <p className="text-sm text-center text-muted-foreground">
        Check your email — we sent a confirmation link.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="password">Password (min 8 chars)</Label>
        <Input id="password" type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</Button>
      <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or continue with</span></div></div>
      <Button type="button" variant="outline" onClick={() => handleSSO('google')}>Google</Button>
      <Button type="button" variant="outline" onClick={() => handleSSO('azure')}>Microsoft</Button>
    </form>
  )
}
```

- [ ] **Step 4: Signup page (passes invite token to form)**

```typescript
// apps/web/src/app/auth/signup/page.tsx
import { SignupForm } from '@/components/auth/signup-form'
import Link from 'next/link'

interface Props {
  searchParams: { invite?: string; email?: string }
}

export default function SignupPage({ searchParams }: Props) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="underline">Sign in</Link>
        </p>
      </div>
      <SignupForm invite={searchParams.invite} />
    </main>
  )
}
```

- [ ] **Step 5: OAuth callback route**

```typescript
// apps/web/src/app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/auth/create-org'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
```

- [ ] **Step 6: Create-org page**

```typescript
// apps/web/src/app/auth/create-org/page.tsx
'use client'

import { useState } from 'react'
import { createOrganization } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'

export default function CreateOrgPage() {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await createOrganization(name)
    if (result.error) { setError(result.error); setLoading(false); return }
    router.push(`/${result.slug}/dashboard`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-semibold">Create your organisation</h1>
        <p className="text-sm text-muted-foreground">You can rename it later</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid gap-1">
          <Label htmlFor="name">Organisation name</Label>
          <Input id="name" value={name} onChange={e => setName(e.target.value)} required autoFocus />
        </div>
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? 'Creating…' : 'Create organisation'}
        </Button>
      </form>
    </main>
  )
}
```

- [ ] **Step 7: Verify auth flow manually**

```bash
cd apps/web && npm run dev
```

Test:
1. Visit http://localhost:3000 → landing page
2. Click "Sign up" → signup form
3. Fill in email/password → redirected to create-org
4. Enter org name → redirected to /[org]/dashboard (404 stub is fine — page doesn't exist yet)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app apps/web/src/components/auth
git commit -m "feat(web): add auth pages — login, signup, callback, create-org"
```

---

## Task 8: Invite Flow

**Files:**
- Create: `apps/web/src/app/invite/[token]/page.tsx`
- Create: `apps/web/src/app/select-org/page.tsx`

- [ ] **Step 1: Invite landing page**

```typescript
// apps/web/src/app/invite/[token]/page.tsx
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { acceptInvite } from '@/lib/auth/actions'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Props {
  params: { token: string }
}

export default async function InvitePage({ params }: Props) {
  const service = createServiceClient()

  // Validate token (service role bypasses RLS)
  const { data: invite } = await service
    .from('invitations')
    .select('id, email, role, expires_at, accepted_at, organizations(name, slug)')
    .eq('id', params.token)
    .single()

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">This invite link is invalid or has expired.</p>
      </main>
    )
  }

  if (invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">This invite link has already been used or expired.</p>
      </main>
    )
  }

  const org = invite.organizations as { name: string; slug: string } | null

  // Check if user is already logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Auto-accept and redirect
    const result = await acceptInvite(params.token, user.id)
    if (!result.error && result.orgSlug) {
      redirect(`/${result.orgSlug}/dashboard`)
    }
  }

  // Not logged in — show invite info and login/signup links
  const signupHref = `/auth/signup?invite=${params.token}${invite.email ? `&email=${encodeURIComponent(invite.email)}` : ''}`
  const loginHref = `/auth/login?invite=${params.token}`

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">You&apos;re invited!</h1>
        <p className="text-muted-foreground">
          Join <strong>{org?.name}</strong> on CCM as <strong>{invite.role}</strong>
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild><Link href={signupHref}>Create account</Link></Button>
        <Button variant="outline" asChild><Link href={loginHref}>Sign in</Link></Button>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Select-org page (multi-org — sets ccm_last_org cookie on selection)**

```typescript
// apps/web/src/app/select-org/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SelectOrgList } from './select-org-list'

export default async function SelectOrgPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('role, organizations(id, name, slug)')
    .eq('user_id', user.id)

  if (!memberships?.length) redirect('/auth/create-org')
  if (memberships.length === 1) {
    const org = memberships[0].organizations as { slug: string }
    redirect(`/${org.slug}/dashboard`)
  }

  const orgs = memberships.map(m => ({
    ...m.organizations as { name: string; slug: string },
    role: m.role,
  }))

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-2xl font-semibold">Select organisation</h1>
      <SelectOrgList orgs={orgs} />
    </main>
  )
}
```

Also create the client component that sets the cookie on click:

```typescript
// apps/web/src/app/select-org/select-org-list.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Org { name: string; slug: string; role: string }

export function SelectOrgList({ orgs }: { orgs: Org[] }) {
  const router = useRouter()

  function selectOrg(slug: string) {
    document.cookie = `ccm_last_org=${slug}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    router.push(`/${slug}/dashboard`)
  }

  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      {orgs.map(org => (
        <Button key={org.slug} variant="outline" onClick={() => selectOrg(org.slug)}>
          <span className="flex-1 text-left">{org.name}</span>
          <span className="text-xs text-muted-foreground">{org.role}</span>
        </Button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Handle invite param in callback route**

Update `apps/web/src/app/auth/callback/route.ts` — after session exchange, check for `invite` param and call `acceptInvite`:

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/invite apps/web/src/app/select-org apps/web/src/app/auth/callback
git commit -m "feat(web): add invite landing page, select-org page, callback invite handling"
```

---

## Task 9: Protected Layout + Dashboard Stub

**Files:**
- Create: `apps/web/src/providers/org-provider.tsx`
- Create: `apps/web/src/app/[org]/layout.tsx`
- Create: `apps/web/src/app/[org]/dashboard/page.tsx`
- Create: `apps/web/src/components/org/org-switcher.tsx`

- [ ] **Step 1: OrgProvider (Client Component — active org + role context)**

```typescript
// apps/web/src/providers/org-provider.tsx
'use client'

import { createContext, useContext } from 'react'

interface OrgContextValue {
  orgId: string
  orgSlug: string
  orgName: string
  role: string
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: OrgContextValue
}) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside OrgProvider')
  return ctx
}
```

- [ ] **Step 2: Org layout (reads x-org-id/x-org-role from request headers, wraps OrgProvider)**

```typescript
// apps/web/src/app/[org]/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { OrgProvider } from '@/providers/org-provider'
import { OrgSwitcher } from '@/components/org/org-switcher'

interface Props {
  children: React.ReactNode
  params: { org: string }
}

export default async function OrgLayout({ children, params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Middleware already validated membership and set these headers
  const headersList = await headers()
  const orgId = headersList.get('x-org-id')
  const orgRole = headersList.get('x-org-role')
  if (!orgId || !orgRole) redirect('/select-org')

  // Fetch org name (id already known from header — one lightweight query)
  const { data: org } = await supabase
    .from('organizations')
    .select('name, slug')
    .eq('id', orgId)
    .single()

  if (!org) redirect('/select-org')

  return (
    <OrgProvider value={{ orgId, orgSlug: org.slug, orgName: org.name, role: orgRole }}>
      <div className="min-h-screen flex flex-col">
        <header className="border-b px-4 py-3 flex items-center gap-4">
          <span className="font-semibold text-sm">CCM</span>
          <OrgSwitcher currentOrg={{ name: org.name, slug: org.slug }} userId={user.id} />
          <span className="ml-auto text-xs text-muted-foreground capitalize">{orgRole}</span>
        </header>
        <main className="flex-1 p-4">{children}</main>
      </div>
    </OrgProvider>
  )
}
```

- [ ] **Step 3: OrgSwitcher component (writes ccm_last_org cookie on switch)**

```typescript
// apps/web/src/components/org/org-switcher.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  currentOrg: { name: string; slug: string }
  userId: string
}

export function OrgSwitcher({ currentOrg, userId }: Props) {
  const [orgs, setOrgs] = useState<{ name: string; slug: string }[]>([])
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('organization_members')
      .select('organizations(name, slug)')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (data) setOrgs(data.map(m => m.organizations as { name: string; slug: string }))
      })
  }, [userId])

  function switchOrg(slug: string) {
    document.cookie = `ccm_last_org=${slug}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    router.push(`/${slug}/dashboard`)
  }

  if (orgs.length <= 1) {
    return <span className="text-sm font-medium">{currentOrg.name}</span>
  }

  return (
    <div className="relative group">
      <button className="text-sm font-medium hover:underline">{currentOrg.name} ▾</button>
      <div className="hidden group-hover:flex absolute top-full left-0 mt-1 flex-col bg-popover border rounded shadow-md min-w-40 z-10">
        {orgs.filter(o => o.slug !== currentOrg.slug).map(o => (
          <button
            key={o.slug}
            onClick={() => switchOrg(o.slug)}
            className="px-3 py-2 text-sm hover:bg-accent text-left"
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Dashboard stub**

```typescript
// apps/web/src/app/[org]/dashboard/page.tsx
interface Props { params: { org: string } }

export default function DashboardPage({ params }: Props) {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Dashboard</h1>
      <p className="text-muted-foreground">Welcome to {params.org}. Knowledge view coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 5: Verify full flow manually**

```bash
cd apps/web && npm run dev
```

Test the complete Flow 1:
1. http://localhost:3000 → landing
2. Sign up → create-org → `/[org]/dashboard` with header + org name

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/providers/org-provider.tsx apps/web/src/app/\[org\] apps/web/src/components/org/org-switcher.tsx
git commit -m "feat(web): add OrgProvider, org layout (x-org-id headers), org switcher (ccm_last_org cookie), dashboard stub"
```

---

## Task 10: Member Management (Settings Page)

**Files:**
- Create: `apps/web/src/app/[org]/settings/page.tsx`
- Create: `apps/web/src/components/org/member-list.tsx`
- Create: `apps/web/src/components/org/invite-form.tsx`

- [ ] **Step 1: Member list component**

```typescript
// apps/web/src/components/org/member-list.tsx
'use client'

import { Button } from '@/components/ui/button'
import { revokeInvite } from '@/lib/auth/actions'

interface Member {
  id: string
  email: string
  role: string
  joined_at: string
}

interface PendingInvite {
  id: string
  email: string | null
  role: string
  expires_at: string
}

interface Props {
  members: Member[]
  pendingInvites: PendingInvite[]
  canManage: boolean
}

export function MemberList({ members, pendingInvites, canManage }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="text-sm font-medium mb-2">Members ({members.length})</h3>
        <div className="border rounded divide-y">
          {members.map(m => (
            <div key={m.id} className="flex items-center px-3 py-2 gap-3">
              <span className="flex-1 text-sm">{m.email}</span>
              <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
            </div>
          ))}
        </div>
      </section>

      {canManage && pendingInvites.length > 0 && (
        <section>
          <h3 className="text-sm font-medium mb-2">Pending invites</h3>
          <div className="border rounded divide-y">
            {pendingInvites.map(inv => (
              <div key={inv.id} className="flex items-center px-3 py-2 gap-3">
                <span className="flex-1 text-sm text-muted-foreground">{inv.email ?? 'Any email'}</span>
                <span className="text-xs text-muted-foreground capitalize">{inv.role}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => { await revokeInvite(inv.id); location.reload() }}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Invite form component**

```typescript
// apps/web/src/components/org/invite-form.tsx
'use client'

import { useState } from 'react'
import { createInvite } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props { orgId: string; baseUrl: string }

export function InviteForm({ orgId, baseUrl }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setLink(null)
    const result = await createInvite(orgId, role, email || undefined)
    if (result.error) { setError(result.error); setLoading(false); return }
    setLink(`${baseUrl}/invite/${result.token}`)
    setEmail('')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {link && (
        <div className="p-2 bg-muted rounded text-xs break-all">
          <span className="font-medium">Invite link: </span>{link}
        </div>
      )}
      <div className="flex gap-2 items-end">
        <div className="flex-1 grid gap-1">
          <Label htmlFor="invite-email">Email (optional)</Label>
          <Input id="invite-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@company.com" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            value={role}
            onChange={e => setRole(e.target.value as 'admin' | 'member')}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={loading}>Generate link</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Settings page**

```typescript
// apps/web/src/app/[org]/settings/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, headers } from 'next/navigation'
import { MemberList } from '@/components/org/member-list'
import { InviteForm } from '@/components/org/invite-form'

interface Props { params: { org: string } }

export default async function SettingsPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', params.org)
    .single()
  if (!org) redirect('/select-org')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .single()
  if (!membership) redirect('/select-org')

  const canManage = ['owner', 'admin'].includes(membership.role)

  const { data: members } = await supabase
    .from('organization_members')
    .select('id, role, joined_at, user:auth.users(email)')
    .eq('organization_id', org.id)

  const { data: pendingInvites } = canManage
    ? await supabase
        .from('invitations')
        .select('id, email, role, expires_at')
        .eq('organization_id', org.id)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
    : { data: [] }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">{org.name}</p>
      </div>

      {canManage && (
        <section>
          <h2 className="text-base font-medium mb-3">Invite team members</h2>
          <InviteForm orgId={org.id} baseUrl={baseUrl} />
        </section>
      )}

      <section>
        <MemberList
          members={(members ?? []).map(m => ({
            id: m.id,
            email: (m.user as { email: string } | null)?.email ?? '—',
            role: m.role,
            joined_at: m.joined_at,
          }))}
          pendingInvites={pendingInvites ?? []}
          canManage={canManage}
        />
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Verify settings page**

```bash
cd apps/web && npm run dev
```

Navigate to http://localhost:3000/[your-org]/settings after logging in.
Expected: member list, invite form with role selector, generates invite link.

- [ ] **Step 5: Run all tests**

```bash
cd apps/web
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\[org\]/settings apps/web/src/components/org/member-list.tsx apps/web/src/components/org/invite-form.tsx
git commit -m "feat(web): add settings page — member list, invite form, revoke invite"
```

---

## Final Verification

- [ ] **Full Flow 1 (New user, create org):**
  1. Signup with email → create-org → `/[org]/dashboard` ✓

- [ ] **Full Flow 2 (Accept invite):**
  1. Admin creates invite via settings page → copy link
  2. Open link in incognito → invite landing page shows org name
  3. Click "Create account" → signup → redirected to org dashboard ✓

- [ ] **Full Flow 3 (Login, multi-org):**
  1. Login as user in 1 org → straight to dashboard ✓
  2. Login as user in 2+ orgs → select-org page → dashboard ✓

- [ ] **Deploy to Vercel:**
  ```bash
  cd apps/web
  vercel --prod
  ```
  Set env vars in Vercel dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`
