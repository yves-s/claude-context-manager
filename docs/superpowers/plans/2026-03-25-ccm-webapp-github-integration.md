# CCM Webapp — Subsystem 3: GitHub Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect a GitHub OAuth App to a CCM org, sync repos + commits into Supabase (with pgvector embeddings), and replace fixture data in the dashboard with real data.

**Architecture:** GitHub OAuth App flow stores an access token per org in Supabase. A Supabase Edge Function (`sync-github`) runs every 30 minutes via pg_cron + pg_net, fetching repos/CLAUDE.md/commits from GitHub and storing them in three new tables. The existing `getOrgData()` / `getRepoData()` functions (unchanged signatures) are re-implemented to read from these tables instead of fixtures.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + pgvector + Edge Functions + pg_cron + pg_net), TypeScript, Vitest, shadcn/ui, Tailwind v4

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/supabase/migrations/0002_github_integration.sql` | Create | DB schema: 3 new tables, pgvector, RLS, cron setup |
| `apps/web/src/lib/github/parse.ts` | Create | Pure functions: extract context + stack from CLAUDE.md |
| `apps/web/src/lib/github/parse.test.ts` | Create | Vitest tests for parse functions |
| `apps/web/src/lib/github/map.ts` | Create | Pure functions: map DB rows → TypeScript interfaces |
| `apps/web/src/lib/github/map.test.ts` | Create | Vitest tests for map functions |
| `apps/web/src/lib/auth/github-state.ts` | Create | HMAC state token: generate + verify (CSRF protection) |
| `apps/web/src/lib/auth/github-state.test.ts` | Create | Vitest tests for state token |
| `apps/web/src/app/api/github/connect/route.ts` | Create | GET handler: verify role, generate state, redirect to GitHub |
| `apps/web/src/app/api/github/callback/route.ts` | Create | GET handler: verify state, exchange code, store token |
| `apps/web/src/lib/github/actions.ts` | Create | Server Action: `disconnectGitHub` |
| `apps/web/src/components/org/github-connect.tsx` | Create | Client component: GitHub section in Settings |
| `apps/web/src/app/[org]/settings/page.tsx` | Modify | Add GithubConnect section + pass orgId/githubOrg |
| `apps/web/src/lib/data/org.ts` | Modify | Replace fixture implementations with Supabase queries |
| `apps/web/supabase/functions/sync-github/index.ts` | Create | Edge Function: orchestrates sync for all orgs |
| `apps/web/supabase/functions/sync-github/github.ts` | Create | GitHub API helpers (fetch repos, CLAUDE.md, commits) |
| `apps/web/supabase/functions/sync-github/parse.ts` | Create | Same parse logic as `src/lib/github/parse.ts` (Deno) |
| `apps/web/supabase/functions/sync-github/embeddings.ts` | Create | OpenAI embedding generation |

---

## Task 1: Database Migration

**Files:**
- Create: `apps/web/supabase/migrations/0002_github_integration.sql`

- [ ] **Step 1: Write migration**

```sql
-- apps/web/supabase/migrations/0002_github_integration.sql

-- Add GitHub token to organizations
ALTER TABLE organizations ADD COLUMN github_access_token text;
-- Note: github_org column already exists from migration 0001

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Repos synced from GitHub
CREATE TABLE synced_repos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text NOT NULL,
  full_name       text NOT NULL,
  has_claude_md   boolean NOT NULL DEFAULT false,
  context         text,
  stack           text[],
  last_commit_at  timestamptz,
  synced_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- Commits (= Sessions in UI)
CREATE TABLE repo_commits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id       uuid NOT NULL REFERENCES synced_repos(id) ON DELETE CASCADE,
  commit_sha    text NOT NULL,
  author_name   text,
  author_email  text,
  message       text,
  files_changed integer NOT NULL DEFAULT 0,
  committed_at  timestamptz NOT NULL,
  UNIQUE(repo_id, commit_sha)
);

CREATE INDEX repo_commits_author_email_idx ON repo_commits (author_email);
CREATE INDEX repo_commits_committed_at_idx ON repo_commits (committed_at DESC);

-- Embeddings (pgvector)
CREATE TABLE repo_embeddings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id    uuid NOT NULL REFERENCES synced_repos(id) ON DELETE CASCADE,
  content    text NOT NULL,
  embedding  vector(1536),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(repo_id)
);

CREATE INDEX repo_embeddings_vector_idx ON repo_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- RLS: deny all direct client access (service role only)
ALTER TABLE synced_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_embeddings ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies = implicit deny for anon + authenticated
```

- [ ] **Step 2: Apply migration**

```bash
cd apps/web
npx supabase db push
# or: npx supabase migration up
```

Expected: Migration applied without errors. Verify in Supabase Studio: three new tables visible, pgvector extension enabled.

- [ ] **Step 3: Commit**

```bash
git add apps/web/supabase/migrations/0002_github_integration.sql
git commit -m "feat: add GitHub integration DB schema (synced_repos, repo_commits, repo_embeddings)"
```

---

## Task 2: CLAUDE.md Parser

**Files:**
- Create: `apps/web/src/lib/github/parse.ts`
- Create: `apps/web/src/lib/github/parse.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/src/lib/github/parse.test.ts
import { describe, it, expect } from 'vitest'
import { extractContext, extractStack } from './parse'

describe('extractContext', () => {
  it('extracts content below PROJECT CONTEXT BELOW marker', () => {
    const content = `# Header\n\nSome intro\n\n<!-- PROJECT CONTEXT BELOW -->\n\n# My Project\n\nThis is the context.`
    expect(extractContext(content)).toBe('# My Project\n\nThis is the context.')
  })

  it('returns full content when marker is absent', () => {
    const content = '# My Project\n\nNo marker here.'
    expect(extractContext(content)).toBe('# My Project\n\nNo marker here.')
  })

  it('returns null for empty content after marker', () => {
    const content = '# Header\n\n<!-- PROJECT CONTEXT BELOW -->\n\n   \n'
    expect(extractContext(content)).toBeNull()
  })

  it('returns null for empty string input', () => {
    expect(extractContext('')).toBeNull()
  })
})

describe('extractStack', () => {
  it('extracts keywords from ## Stack section bullet points', () => {
    const content = `# Project\n\n## Stack\n\n- Next.js\n- Supabase\n- TypeScript\n\n## Other`
    const result = extractStack(content)
    expect(result).toContain('next.js')
    expect(result).toContain('supabase')
    expect(result).toContain('typescript')
  })

  it('extracts keywords from ## Tech section table rows', () => {
    const content = `## Tech\n\n| Layer | Technologie |\n|-------|------|\n| Frontend | Next.js |\n| DB | Supabase |`
    const result = extractStack(content)
    expect(result).toContain('next.js')
    expect(result).toContain('supabase')
  })

  it('falls back to keyword match when no Stack section', () => {
    const content = 'We use React and TypeScript for the frontend, PostgreSQL for the database.'
    const result = extractStack(content)
    expect(result).toContain('react')
    expect(result).toContain('typescript')
    expect(result).toContain('postgresql')
  })

  it('returns at most 10 keywords', () => {
    const content = '## Stack\n\n- Next.js\n- React\n- Vue\n- Angular\n- Svelte\n- Supabase\n- PostgreSQL\n- TypeScript\n- Python\n- Go\n- Rust\n- Docker'
    expect(extractStack(content).length).toBeLessThanOrEqual(10)
  })

  it('returns lowercase deduplicated results', () => {
    const content = '## Stack\n\n- TypeScript\n- typescript\n- TYPESCRIPT'
    const result = extractStack(content)
    const tsCount = result.filter(k => k === 'typescript').length
    expect(tsCount).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web
npx vitest run src/lib/github/parse.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement parse.ts**

```typescript
// apps/web/src/lib/github/parse.ts

const TECH_KEYWORDS = [
  'next.js', 'react', 'vue', 'angular', 'svelte', 'nuxt',
  'supabase', 'postgresql', 'mysql', 'sqlite', 'mongodb', 'redis',
  'typescript', 'javascript', 'python', 'go', 'rust', 'swift', 'kotlin', 'java',
  'docker', 'kubernetes', 'graphql', 'prisma', 'drizzle', 'tailwind',
  'node.js', 'express', 'fastapi', 'django', 'rails',
]

const CONTEXT_MARKER = '<!-- PROJECT CONTEXT BELOW -->'

export function extractContext(content: string): string | null {
  if (!content.trim()) return null
  const idx = content.indexOf(CONTEXT_MARKER)
  if (idx === -1) return content.trim() || null
  const after = content.slice(idx + CONTEXT_MARKER.length).trim()
  return after || null
}

export function extractStack(content: string): string[] {
  const sectionMatch = content.match(/##\s+(?:Stack|Tech)\b[^\n]*\n([\s\S]*?)(?=\n##|$)/i)
  if (sectionMatch) {
    const sectionContent = sectionMatch[1]
    const keywords: string[] = []

    // Bullet points: "- Next.js" or "* Next.js"
    for (const match of sectionContent.matchAll(/^[-*]\s+([^\n|]+)/gm)) {
      const kw = match[1].trim().toLowerCase()
      if (kw && !kw.startsWith('-')) keywords.push(kw)
    }

    // Table cells (first data column, skip header/divider rows)
    for (const match of sectionContent.matchAll(/^\|\s*([^|\n-][^|\n]*?)\s*\|/gm)) {
      const kw = match[1].trim().toLowerCase()
      if (kw && kw !== 'layer' && kw !== 'technologie' && kw !== 'tech' && kw !== 'stack') {
        keywords.push(kw)
      }
    }

    if (keywords.length > 0) {
      return [...new Set(keywords)].slice(0, 10)
    }
  }

  // Fallback: keyword match against full content
  const lower = content.toLowerCase()
  const found = TECH_KEYWORDS.filter(kw => lower.includes(kw))
  return found.slice(0, 10)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web
npx vitest run src/lib/github/parse.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/github/parse.ts apps/web/src/lib/github/parse.test.ts
git commit -m "feat: add CLAUDE.md parser (extractContext, extractStack)"
```

---

## Task 3: Data Mapper

Maps raw Supabase rows to the TypeScript interfaces defined in `src/lib/data/types.ts`.

**Files:**
- Create: `apps/web/src/lib/github/map.ts`
- Create: `apps/web/src/lib/github/map.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/src/lib/github/map.test.ts
import { describe, it, expect } from 'vitest'
import { mapCommitToSession, mapCommitToActivityEntry, buildContributors } from './map'
import type { MemberInfo } from './map'

const member: MemberInfo = {
  userId: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'admin',
  avatarUrl: undefined,
}

const commit = {
  id: 'commit-id-1',
  commit_sha: 'abc123',
  author_name: 'Alice',
  author_email: 'alice@example.com',
  message: 'feat: add feature',
  files_changed: 3,
  committed_at: '2026-03-20T10:00:00Z',
}

describe('mapCommitToSession', () => {
  it('maps commit to session with member data', () => {
    const memberByEmail = new Map([['alice@example.com', member]])
    const session = mapCommitToSession(commit, memberByEmail)
    expect(session.id).toBe('commit-id-1')
    expect(session.userId).toBe('user-1')
    expect(session.userName).toBe('Alice')
    expect(session.summary).toBe('feat: add feature')
    expect(session.filesChanged).toBe(3)
    expect(session.createdAt).toEqual(new Date('2026-03-20T10:00:00Z'))
  })

  it('falls back to author_name when no member match', () => {
    const session = mapCommitToSession(commit, new Map())
    expect(session.userId).toBe('')
    expect(session.userName).toBe('Alice')
  })

  it('falls back to Unknown when no name at all', () => {
    const noName = { ...commit, author_name: null, author_email: null }
    const session = mapCommitToSession(noName, new Map())
    expect(session.userName).toBe('Unknown')
  })
})

describe('mapCommitToActivityEntry', () => {
  it('maps commit to activity entry', () => {
    const memberByEmail = new Map([['alice@example.com', member]])
    const entry = mapCommitToActivityEntry(commit, 'dashboard', 'Dashboard', memberByEmail)
    expect(entry.sessionId).toBe('commit-id-1')
    expect(entry.repoSlug).toBe('dashboard')
    expect(entry.repoName).toBe('Dashboard')
    expect(entry.userName).toBe('Alice')
  })
})

describe('buildContributors', () => {
  it('groups commits by author and sorts by count descending', () => {
    const commits = [
      { ...commit, id: '1' },
      { ...commit, id: '2' },
      { ...commit, id: '3', author_email: 'bob@example.com', author_name: 'Bob' },
    ]
    const memberByEmail = new Map([['alice@example.com', member]])
    const contributors = buildContributors(commits, memberByEmail)
    expect(contributors[0].userName).toBe('Alice')
    expect(contributors[0].sessionCount).toBe(2)
    expect(contributors[1].userName).toBe('Bob')
    expect(contributors[1].sessionCount).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web
npx vitest run src/lib/github/map.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement map.ts**

```typescript
// apps/web/src/lib/github/map.ts
import type { Session, ActivityEntry, Contributor } from '@/lib/data/types'

export interface MemberInfo {
  userId: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member'
  avatarUrl?: string
}

export interface CommitRow {
  id: string
  commit_sha: string
  author_name: string | null
  author_email: string | null
  message: string | null
  files_changed: number
  committed_at: string
}

export function mapCommitToSession(
  commit: CommitRow,
  memberByEmail: Map<string, MemberInfo>
): Session {
  const member = commit.author_email ? memberByEmail.get(commit.author_email) : undefined
  return {
    id: commit.id,
    userId: member?.userId ?? '',
    userName: member?.name ?? commit.author_name ?? 'Unknown',
    avatarUrl: member?.avatarUrl,
    filesChanged: commit.files_changed,
    summary: commit.message ?? '',
    createdAt: new Date(commit.committed_at),
  }
}

export function mapCommitToActivityEntry(
  commit: CommitRow,
  repoSlug: string,
  repoName: string,
  memberByEmail: Map<string, MemberInfo>
): ActivityEntry {
  const member = commit.author_email ? memberByEmail.get(commit.author_email) : undefined
  return {
    sessionId: commit.id,
    userId: member?.userId ?? '',
    userName: member?.name ?? commit.author_name ?? 'Unknown',
    avatarUrl: member?.avatarUrl,
    repoSlug,
    repoName,
    filesChanged: commit.files_changed,
    createdAt: new Date(commit.committed_at),
  }
}

export function buildContributors(
  commits: CommitRow[],
  memberByEmail: Map<string, MemberInfo>
): Contributor[] {
  const map = new Map<string, { info: MemberInfo | null; name: string; count: number }>()

  for (const c of commits) {
    const member = c.author_email ? memberByEmail.get(c.author_email) : undefined
    const key = member?.userId ?? c.author_email ?? c.author_name ?? 'unknown'
    if (!map.has(key)) {
      map.set(key, {
        info: member ?? null,
        name: member?.name ?? c.author_name ?? 'Unknown',
        count: 0,
      })
    }
    map.get(key)!.count++
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .map(({ info, name, count }) => ({
      userId: info?.userId ?? '',
      name,
      avatarUrl: info?.avatarUrl,
      sessionCount: count,
      role: info?.role,
    }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web
npx vitest run src/lib/github/map.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/github/map.ts apps/web/src/lib/github/map.test.ts
git commit -m "feat: add data mapper for DB rows → TypeScript interfaces"
```

---

## Task 4: GitHub State Token (CSRF)

**Files:**
- Create: `apps/web/src/lib/auth/github-state.ts`
- Create: `apps/web/src/lib/auth/github-state.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/src/lib/auth/github-state.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateGithubState, verifyGithubState } from './github-state'

// GITHUB_CLIENT_SECRET must be set for HMAC
beforeEach(() => {
  process.env.GITHUB_CLIENT_SECRET = 'test-secret'
})

describe('generateGithubState + verifyGithubState', () => {
  it('round-trips successfully', () => {
    const state = generateGithubState('org-id-123')
    const result = verifyGithubState(state)
    expect(result).not.toBeNull()
    expect(result?.orgId).toBe('org-id-123')
  })

  it('returns null for tampered state', () => {
    const state = generateGithubState('org-id-123')
    const tampered = state.slice(0, -4) + 'xxxx'
    expect(verifyGithubState(tampered)).toBeNull()
  })

  it('returns null for expired state', () => {
    // Generate state with timestamp in the past
    const state = generateGithubState('org-id-123')
    // maxAgeMs=0 → always expired
    expect(verifyGithubState(state, 0)).toBeNull()
  })

  it('returns null for malformed state', () => {
    expect(verifyGithubState('not-valid-base64url!')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web
npx vitest run src/lib/auth/github-state.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement github-state.ts**

```typescript
// apps/web/src/lib/auth/github-state.ts
import { createHmac } from 'crypto'

function getSecret(): string {
  const secret = process.env.GITHUB_CLIENT_SECRET
  if (!secret) throw new Error('GITHUB_CLIENT_SECRET not set')
  return secret
}

export function generateGithubState(orgId: string): string {
  const timestamp = Date.now().toString()
  const hmac = createHmac('sha256', getSecret())
  hmac.update(`${orgId}:${timestamp}`)
  const sig = hmac.digest('hex')
  const payload = JSON.stringify({ orgId, timestamp, sig })
  return Buffer.from(payload).toString('base64url')
}

export function verifyGithubState(
  state: string,
  maxAgeMs = 10 * 60 * 1000
): { orgId: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(state, 'base64url').toString())
    const { orgId, timestamp, sig } = payload
    if (typeof orgId !== 'string' || typeof timestamp !== 'string' || typeof sig !== 'string') {
      return null
    }
    if (Date.now() - Number(timestamp) > maxAgeMs) return null
    const hmac = createHmac('sha256', getSecret())
    hmac.update(`${orgId}:${timestamp}`)
    const expected = hmac.digest('hex')
    if (sig !== expected) return null
    return { orgId }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web
npx vitest run src/lib/auth/github-state.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Run all tests**

```bash
cd apps/web
npx vitest run
```

Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/auth/github-state.ts apps/web/src/lib/auth/github-state.test.ts
git commit -m "feat: add GitHub OAuth CSRF state token (HMAC)"
```

---

## Task 5: GitHub OAuth Route Handlers

**Files:**
- Create: `apps/web/src/app/api/github/connect/route.ts`
- Create: `apps/web/src/app/api/github/callback/route.ts`

**Environment variables required (add to `.env.local`):**
```
GITHUB_CLIENT_ID=<from GitHub OAuth App settings>
GITHUB_CLIENT_SECRET=<from GitHub OAuth App settings>
```

**Before you start:** Register a GitHub OAuth App at https://github.com/settings/developers:
- Application name: CCM (local) / CCM (production)
- Homepage URL: http://localhost:3000
- Callback URL: http://localhost:3000/api/github/callback

- [ ] **Step 1: Create connect route**

```typescript
// apps/web/src/app/api/github/connect/route.ts
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
```

- [ ] **Step 2: Create callback route**

```typescript
// apps/web/src/app/api/github/callback/route.ts
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
    .update({ github_access_token: accessToken, github_org: githubOrg })
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
```

- [ ] **Step 3: Test manually in browser**

Start dev server:
```bash
cd apps/web && npm run dev
```

1. Go to `/{org}/settings`
2. Click "Mit GitHub verbinden →"
3. Verify redirect to GitHub OAuth page
4. Authorize → verify redirect back to settings page
5. Check Supabase Studio: `organizations` row should have `github_access_token` set

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/github/connect/route.ts apps/web/src/app/api/github/callback/route.ts
git commit -m "feat: add GitHub OAuth connect/callback route handlers"
```

---

## Task 6: GitHub Disconnect Action + UI Component

**Files:**
- Create: `apps/web/src/lib/github/actions.ts`
- Create: `apps/web/src/components/org/github-connect.tsx`

- [ ] **Step 1: Create server action**

```typescript
// apps/web/src/lib/github/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

export async function disconnectGitHub(
  orgId: string,
  orgSlug: string
): Promise<{ error: string | null }> {
  // Verify authenticated user is owner/admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const service = createServiceClient()

  const { data: member } = await service
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!member || !['owner', 'admin'].includes(member.role as string)) {
    return { error: 'Forbidden' }
  }

  // Delete synced repos first (cascades to repo_commits + repo_embeddings)
  await service.from('synced_repos').delete().eq('organization_id', orgId)

  // Clear token
  const { error } = await service
    .from('organizations')
    .update({ github_access_token: null, github_org: null })
    .eq('id', orgId)

  if (error) return { error: error.message }

  revalidatePath(`/${orgSlug}/settings`)
  return { error: null }
}
```

- [ ] **Step 2: Create UI component**

```typescript
// apps/web/src/components/org/github-connect.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { disconnectGitHub } from '@/lib/github/actions'

interface Props {
  orgId: string
  orgSlug: string
  githubOrg: string | null
  repoCount?: number
}

export function GithubConnect({ orgId, orgSlug, githubOrg, repoCount = 0 }: Props) {
  const searchParams = useSearchParams()
  const hasError = searchParams.get('github_error') === 'true'
  const [isPending, startTransition] = useTransition()

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectGitHub(orgId, orgSlug)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {hasError && (
        <p className="text-sm text-destructive">
          GitHub-Verbindung fehlgeschlagen. Bitte versuche es erneut.
        </p>
      )}

      {githubOrg ? (
        <div className="border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{githubOrg}</p>
              <p className="text-xs text-muted-foreground">GitHub Organisation</p>
            </div>
          </div>
          {repoCount > 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-b">
              {repoCount} {repoCount === 1 ? 'Repository' : 'Repositories'} synchronisiert
            </div>
          )}
          <div className="px-4 py-2">
            <button
              onClick={handleDisconnect}
              disabled={isPending}
              className="text-xs text-destructive hover:underline disabled:opacity-50"
            >
              {isPending ? 'Wird getrennt…' : 'GitHub trennen'}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-xl p-6 text-center">
          <svg
            className="w-7 h-7 text-muted-foreground mx-auto mb-3"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          <p className="text-sm font-medium mb-1">GitHub noch nicht verbunden</p>
          <p className="text-xs text-muted-foreground mb-4">
            Verbinde deine GitHub Organisation um Repositories und Aktivität automatisch zu synchronisieren.
          </p>
          <a
            href={`/api/github/connect?orgId=${orgId}`}
            className="inline-flex items-center justify-center w-full rounded-lg bg-foreground text-background text-sm font-medium py-2.5 px-4 hover:opacity-90 transition-opacity"
          >
            Mit GitHub verbinden →
          </a>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/github/actions.ts apps/web/src/components/org/github-connect.tsx
git commit -m "feat: add GitHub disconnect action and GithubConnect UI component"
```

---

## Task 7: Settings Page Update

**Files:**
- Modify: `apps/web/src/app/[org]/settings/page.tsx`

The settings page needs to:
1. Load `github_org` + `github_access_token` from DB
2. Count synced repos
3. Pass data to `GithubConnect` component

- [ ] **Step 1: Read current settings page**

Read `apps/web/src/app/[org]/settings/page.tsx` to understand the current structure before editing.

- [ ] **Step 2: Update settings page**

Add the following imports at the top (after existing imports):

```typescript
import { GithubConnect } from '@/components/org/github-connect'
```

Replace the existing `const { data: org }` query (currently selects only `name`) to also select `github_org` and `github_access_token`:

```typescript
  const { data: org } = await supabase
    .from('organizations')
    .select('name, github_org, github_access_token')
    .eq('id', orgId)
    .single()
  if (!org) redirect('/select-org')
```

Add repo count query (after the pending invites block, before the return):

```typescript
  // Count synced repos for GitHub section
  const { count: syncedRepoCount } = canManage
    ? await service
        .from('synced_repos')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .then(r => r)
    : { count: 0 }
```

Add GitHub section inside the return JSX, after the closing `</section>` of the MemberList section:

```tsx
      {canManage && (
        <section>
          <h2 className="text-base font-medium mb-3">GitHub</h2>
          <GithubConnect
            orgId={orgId}
            orgSlug={(await params).org}
            githubOrg={(org as any).github_org ?? null}
            repoCount={syncedRepoCount ?? 0}
          />
        </section>
      )}
```

- [ ] **Step 3: Test in browser**

```bash
cd apps/web && npm run dev
```

Navigate to `/{org}/settings`. GitHub section should appear below Members for owner/admin. Verify:
- Not connected: dashed border with "Mit GitHub verbinden →" button
- After connect: green dot, org name, repo count

- [ ] **Step 4: Run type check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[org]/settings/page.tsx
git commit -m "feat: add GitHub section to settings page"
```

---

## Task 8: Replace getOrgData / getRepoData

**Files:**
- Modify: `apps/web/src/lib/data/org.ts`

This replaces the fixture implementations with real Supabase queries. Uses the `MemberInfo` type and mapping functions from Tasks 2–3.

- [ ] **Step 1: Write the new org.ts**

```typescript
// apps/web/src/lib/data/org.ts
import type { OrgData, Repo, Member } from './types'
import { createServiceClient } from '@/lib/supabase/service'
import { mapCommitToSession, mapCommitToActivityEntry, buildContributors } from '@/lib/github/map'
import type { MemberInfo, CommitRow } from '@/lib/github/map'

// --- Helpers ---

async function loadMembers(
  service: ReturnType<typeof createServiceClient>,
  orgId: string
): Promise<{ members: Member[]; memberByEmail: Map<string, MemberInfo> }> {
  const { data: membersRaw } = await service
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', orgId)

  const userIds = (membersRaw ?? []).map(m => m.user_id as string)
  const userResults = await Promise.all(
    userIds.map(id => service.auth.admin.getUserById(id))
  )

  const memberByEmail = new Map<string, MemberInfo>()
  const members: Member[] = []

  for (const result of userResults) {
    const user = result.data.user
    if (!user) continue
    const memberRow = membersRaw!.find(m => m.user_id === user.id)
    if (!memberRow) continue

    const info: MemberInfo = {
      userId: user.id,
      name: (user.user_metadata?.full_name as string) ?? user.email?.split('@')[0] ?? 'Unknown',
      email: user.email ?? '',
      role: memberRow.role as MemberInfo['role'],
      avatarUrl: user.user_metadata?.avatar_url as string | undefined,
    }

    members.push({
      userId: info.userId,
      name: info.name,
      email: info.email,
      role: info.role,
      avatarUrl: info.avatarUrl,
    })

    if (info.email) memberByEmail.set(info.email, info)
  }

  return { members, memberByEmail }
}

// --- Public API (signatures unchanged from Subsystem 2) ---

export async function getOrgData(orgSlug: string): Promise<OrgData> {
  const service = createServiceClient()

  const { data: org } = await service
    .from('organizations')
    .select('id, github_access_token')
    .eq('slug', orgSlug)
    .single()

  if (!org) return { repos: [], members: [], recentActivity: [], githubConnected: false }

  const { members, memberByEmail } = await loadMembers(service, org.id as string)

  if (!org.github_access_token) {
    return { repos: [], members, recentActivity: [], githubConnected: false }
  }

  // Load repos
  const { data: reposRaw } = await service
    .from('synced_repos')
    .select('id, name, slug, has_claude_md, context, stack, last_commit_at')
    .eq('organization_id', org.id)

  const repoIds = (reposRaw ?? []).map(r => r.id as string)
  if (repoIds.length === 0) {
    return { repos: [], members, recentActivity: [], githubConnected: true }
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // Commit counts for the last 14 days (for 7d + prev 7d)
  const { data: recentCounts } = await service
    .from('repo_commits')
    .select('repo_id, committed_at')
    .in('repo_id', repoIds)
    .gte('committed_at', fourteenDaysAgo)

  // Total counts
  const { data: allCommits } = await service
    .from('repo_commits')
    .select('repo_id')
    .in('repo_id', repoIds)

  // 20 newest commits across all repos for recentActivity
  const { data: activityCommits } = await service
    .from('repo_commits')
    .select('id, repo_id, author_name, author_email, message, files_changed, committed_at')
    .in('repo_id', repoIds)
    .order('committed_at', { ascending: false })
    .limit(20)

  // Build count maps
  const counts7d = new Map<string, number>()
  const countsPrev = new Map<string, number>()
  for (const c of recentCounts ?? []) {
    const id = c.repo_id as string
    if ((c.committed_at as string) >= sevenDaysAgo) {
      counts7d.set(id, (counts7d.get(id) ?? 0) + 1)
    } else {
      countsPrev.set(id, (countsPrev.get(id) ?? 0) + 1)
    }
  }
  const totalMap = new Map<string, number>()
  for (const c of allCommits ?? []) {
    const id = c.repo_id as string
    totalMap.set(id, (totalMap.get(id) ?? 0) + 1)
  }

  const repoById = new Map((reposRaw ?? []).map(r => [r.id as string, r]))

  const repos: Repo[] = (reposRaw ?? []).map(r => ({
    slug: r.slug as string,
    name: r.name as string,
    stack: (r.stack as string[]) ?? [],
    lastSyncAt: r.last_commit_at ? new Date(r.last_commit_at as string) : undefined,
    sessionCount7d: counts7d.get(r.id as string) ?? 0,
    sessionCount7dPrevious: countsPrev.get(r.id as string) ?? 0,
    totalSessions: totalMap.get(r.id as string) ?? 0,
    hasClaudeMd: r.has_claude_md as boolean,
    context: r.context as string | undefined,
    contributors: [],
    sessions: [],
  }))

  const recentActivity = (activityCommits ?? []).map(c => {
    const repo = repoById.get(c.repo_id as string)
    return mapCommitToActivityEntry(
      c as CommitRow,
      repo?.slug as string ?? '',
      repo?.name as string ?? '',
      memberByEmail
    )
  })

  return { repos, members, recentActivity, githubConnected: true }
}

export async function getRepoData(orgSlug: string, repoSlug: string): Promise<Repo | null> {
  const service = createServiceClient()

  const { data: org } = await service
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single()

  if (!org) return null

  const { data: repoRaw } = await service
    .from('synced_repos')
    .select('id, name, slug, has_claude_md, context, stack, last_commit_at')
    .eq('organization_id', org.id)
    .eq('slug', repoSlug)
    .single()

  if (!repoRaw) return null

  const { memberByEmail } = await loadMembers(service, org.id as string)

  const { data: commits } = await service
    .from('repo_commits')
    .select('id, commit_sha, author_name, author_email, message, files_changed, committed_at')
    .eq('repo_id', repoRaw.id)
    .order('committed_at', { ascending: false })
    .limit(50)

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { count: totalCount } = await service
    .from('repo_commits')
    .select('id', { count: 'exact', head: true })
    .eq('repo_id', repoRaw.id)

  const { count: count7d } = await service
    .from('repo_commits')
    .select('id', { count: 'exact', head: true })
    .eq('repo_id', repoRaw.id)
    .gte('committed_at', sevenDaysAgo)

  const { count: countPrev } = await service
    .from('repo_commits')
    .select('id', { count: 'exact', head: true })
    .eq('repo_id', repoRaw.id)
    .gte('committed_at', fourteenDaysAgo)
    .lt('committed_at', sevenDaysAgo)

  const sessions = (commits ?? []).map(c => mapCommitToSession(c as CommitRow, memberByEmail))
  const contributors = buildContributors((commits ?? []) as CommitRow[], memberByEmail)

  return {
    slug: repoRaw.slug as string,
    name: repoRaw.name as string,
    stack: (repoRaw.stack as string[]) ?? [],
    lastSyncAt: repoRaw.last_commit_at ? new Date(repoRaw.last_commit_at as string) : undefined,
    sessionCount7d: count7d ?? 0,
    sessionCount7dPrevious: countPrev ?? 0,
    totalSessions: totalCount ?? 0,
    hasClaudeMd: repoRaw.has_claude_md as boolean,
    context: repoRaw.context as string | undefined,
    contributors,
    sessions,
  }
}
```

- [ ] **Step 2: Run type check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No type errors

- [ ] **Step 3: Run all tests**

```bash
cd apps/web && npx vitest run
```

Expected: All tests pass (the data layer has no unit tests — it's tested via the browser)

- [ ] **Step 4: Test in browser**

With GitHub connected and repos synced (via Step 5 of Task 9): dashboard should show real repos, sessions, activity.

Without GitHub connected: dashboard shows `githubConnected: false` empty states.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/data/org.ts
git commit -m "feat: replace fixture data layer with Supabase queries"
```

---

## Task 9: Edge Function — sync-github

**Files:**
- Create: `apps/web/supabase/functions/sync-github/index.ts`
- Create: `apps/web/supabase/functions/sync-github/github.ts`
- Create: `apps/web/supabase/functions/sync-github/parse.ts`
- Create: `apps/web/supabase/functions/sync-github/embeddings.ts`

The Edge Function runs in Deno. Use `Deno.env.get()` for env vars. Import Supabase client via npm specifier.

**Environment variables (set in Supabase Dashboard → Edge Functions → Secrets):**
- `OPENAI_API_KEY` — for embedding generation

- [ ] **Step 1: Create parse.ts (Deno)**

Same logic as `src/lib/github/parse.ts` but no imports needed:

```typescript
// apps/web/supabase/functions/sync-github/parse.ts

const TECH_KEYWORDS = [
  'next.js', 'react', 'vue', 'angular', 'svelte', 'nuxt',
  'supabase', 'postgresql', 'mysql', 'sqlite', 'mongodb', 'redis',
  'typescript', 'javascript', 'python', 'go', 'rust', 'swift', 'kotlin', 'java',
  'docker', 'kubernetes', 'graphql', 'prisma', 'drizzle', 'tailwind',
  'node.js', 'express', 'fastapi', 'django', 'rails',
]

const CONTEXT_MARKER = '<!-- PROJECT CONTEXT BELOW -->'

export function extractContext(content: string): string | null {
  if (!content.trim()) return null
  const idx = content.indexOf(CONTEXT_MARKER)
  if (idx === -1) return content.trim() || null
  const after = content.slice(idx + CONTEXT_MARKER.length).trim()
  return after || null
}

export function extractStack(content: string): string[] {
  const sectionMatch = content.match(/##\s+(?:Stack|Tech)\b[^\n]*\n([\s\S]*?)(?=\n##|$)/i)
  if (sectionMatch) {
    const sectionContent = sectionMatch[1]
    const keywords: string[] = []
    for (const match of sectionContent.matchAll(/^[-*]\s+([^\n|]+)/gm)) {
      const kw = match[1].trim().toLowerCase()
      if (kw) keywords.push(kw)
    }
    for (const match of sectionContent.matchAll(/^\|\s*([^|\n-][^|\n]*?)\s*\|/gm)) {
      const kw = match[1].trim().toLowerCase()
      if (kw && !['layer', 'technologie', 'tech', 'stack'].includes(kw)) keywords.push(kw)
    }
    if (keywords.length > 0) return [...new Set(keywords)].slice(0, 10)
  }
  const lower = content.toLowerCase()
  return TECH_KEYWORDS.filter(kw => lower.includes(kw)).slice(0, 10)
}
```

- [ ] **Step 2: Create github.ts**

```typescript
// apps/web/supabase/functions/sync-github/github.ts

const GITHUB_API = 'https://api.github.com'

async function githubFetch(path: string, token: string): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries - 1) throw err
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
  throw new Error('Max retries exceeded')
}

export interface GithubRepo {
  name: string
  full_name: string
}

export interface GithubCommit {
  sha: string
  commit: {
    author: { name: string; email: string; date: string } | null
    message: string
  }
}

export async function listOrgRepos(githubOrg: string, token: string): Promise<GithubRepo[]> {
  const res = await withRetry(() => githubFetch(`/orgs/${githubOrg}/repos?per_page=100`, token))
  if (res.status === 401) throw new Error('GITHUB_401')
  if (!res.ok) return []
  return res.json()
}

export async function fetchClaudeMd(fullName: string, token: string): Promise<string | null> {
  const res = await withRetry(() =>
    githubFetch(`/repos/${fullName}/contents/CLAUDE.md`, token)
  )
  if (res.status === 404 || res.status === 403) return null
  if (!res.ok) return null
  const data = await res.json() as { content?: string; encoding?: string }
  if (!data.content || data.encoding !== 'base64') return null
  return atob(data.content.replace(/\n/g, ''))
}

export async function fetchCommits(
  fullName: string,
  token: string,
  since: string
): Promise<GithubCommit[]> {
  const url = `/repos/${fullName}/commits?since=${since}&per_page=100`
  const res = await withRetry(() => githubFetch(url, token))
  if (!res.ok) return []
  return res.json()
}
```

- [ ] **Step 3: Create embeddings.ts**

```typescript
// apps/web/supabase/functions/sync-github/embeddings.ts

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return null

  // Truncate to roughly 8192 tokens (approx 4 chars/token)
  const truncated = text.length > 32768 ? text.slice(0, 32768) : text

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: truncated,
      }),
    })

    if (res.status === 429) {
      console.warn('OpenAI rate limit — skipping embedding')
      return null
    }
    if (!res.ok) {
      console.warn(`OpenAI error ${res.status} — skipping embedding`)
      return null
    }

    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0]?.embedding ?? null
  } catch (err) {
    console.warn('OpenAI fetch failed:', err)
    return null
  }
}
```

- [ ] **Step 4: Create index.ts**

```typescript
// apps/web/supabase/functions/sync-github/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { listOrgRepos, fetchClaudeMd, fetchCommits } from './github.ts'
import { extractContext, extractStack } from './parse.ts'
import { generateEmbedding } from './embeddings.ts'

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, github_org, github_access_token, synced_repos(synced_at)')
    .not('github_access_token', 'is', null)

  if (error) {
    console.error('Failed to load orgs:', error)
    return new Response('error', { status: 500 })
  }

  for (const org of orgs ?? []) {
    const token = org.github_access_token as string
    const githubOrg = org.github_org as string
    if (!token || !githubOrg) continue

    let repos
    try {
      repos = await listOrgRepos(githubOrg, token)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'GITHUB_401') {
        console.warn(`Token expired for org ${org.id}, clearing`)
        await supabase
          .from('organizations')
          .update({ github_access_token: null })
          .eq('id', org.id)
      }
      continue
    }

    for (const repo of repos) {
      const slug = repo.name.toLowerCase()

      // Fetch CLAUDE.md
      const claudeMdContent = await fetchClaudeMd(repo.full_name, token)
      const hasClaudeMd = claudeMdContent !== null
      const context = claudeMdContent ? extractContext(claudeMdContent) : null
      const stack = claudeMdContent ? extractStack(claudeMdContent) : []

      // Upsert repo
      const { data: repoRow, error: repoErr } = await supabase
        .from('synced_repos')
        .upsert(
          {
            organization_id: org.id,
            name: repo.name,
            slug,
            full_name: repo.full_name,
            has_claude_md: hasClaudeMd,
            context,
            stack,
          },
          { onConflict: 'organization_id,slug' }
        )
        .select('id, synced_at, context')
        .single()

      if (repoErr || !repoRow) {
        console.warn(`Failed to upsert repo ${repo.full_name}:`, repoErr)
        continue
      }

      // Determine since date for commits
      const nintyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const since = repoRow.synced_at ?? nintyDaysAgo

      // Fetch + upsert commits
      const commits = await fetchCommits(repo.full_name, token, since)
      if (commits.length > 0) {
        const commitRows = commits.map(c => ({
          repo_id: repoRow.id,
          commit_sha: c.sha,
          author_name: c.commit.author?.name ?? null,
          author_email: c.commit.author?.email ?? null,
          message: c.commit.message,
          files_changed: 0,
          committed_at: c.commit.author?.date ?? new Date().toISOString(),
        }))

        await supabase
          .from('repo_commits')
          .upsert(commitRows, { onConflict: 'repo_id,commit_sha', ignoreDuplicates: true })

        // Update last_commit_at
        const latestDate = commits[0].commit.author?.date
        if (latestDate) {
          await supabase
            .from('synced_repos')
            .update({ last_commit_at: latestDate })
            .eq('id', repoRow.id)
        }
      }

      // Update synced_at after successful commit upsert
      await supabase
        .from('synced_repos')
        .update({ synced_at: new Date().toISOString() })
        .eq('id', repoRow.id)

      // Generate embedding if context changed
      if (context && context !== repoRow.context) {
        const embedding = await generateEmbedding(context)
        if (embedding) {
          await supabase
            .from('repo_embeddings')
            .upsert(
              { repo_id: repoRow.id, content: context, embedding, updated_at: new Date().toISOString() },
              { onConflict: 'repo_id' }
            )
        }
      }
    }
  }

  return new Response('ok', { status: 200 })
})
```

- [ ] **Step 5: Deploy edge function**

```bash
cd apps/web
npx supabase functions deploy sync-github
```

Set secret:
```bash
npx supabase secrets set OPENAI_API_KEY=<your-key>
```

- [ ] **Step 6: Test edge function manually**

```bash
npx supabase functions invoke sync-github --no-verify-jwt
```

Expected: `ok` response. Check Supabase Studio: `synced_repos` and `repo_commits` tables should have data.

- [ ] **Step 7: Commit**

```bash
git add apps/web/supabase/functions/
git commit -m "feat: add sync-github Edge Function"
```

---

## Task 10: Cron Job Setup

This task sets up the automated 30-minute trigger. Run these SQL statements in the Supabase SQL Editor.

**Files:** No code files — only SQL commands and documentation.

- [ ] **Step 1: Enable required extensions**

Run in Supabase SQL Editor:

```sql
-- Enable pg_net (for HTTP calls from cron)
CREATE EXTENSION IF NOT EXISTS pg_net;
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

- [ ] **Step 2: Store service role key as DB setting**

Run in Supabase SQL Editor (replace `<SERVICE_ROLE_KEY>` with value from Supabase Dashboard → Settings → API):

```sql
ALTER DATABASE postgres
  SET app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
```

- [ ] **Step 3: Create cron job**

Run in Supabase SQL Editor (replace `<PROJECT-REF>` with your Supabase project ref):

```sql
SELECT cron.schedule(
  'sync-github-every-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/sync-github',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 4: Verify cron job**

```sql
SELECT * FROM cron.job;
```

Expected: One row with `jobname = 'sync-github-every-30min'`, schedule `*/30 * * * *`.

- [ ] **Step 5: Run all tests one final time**

```bash
cd apps/web && npx vitest run
```

Expected: All tests pass

- [ ] **Step 6: Build check**

```bash
cd apps/web && npm run build
```

Expected: Build succeeds with no errors

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete Subsystem 3 — GitHub integration with auto-sync"
```
