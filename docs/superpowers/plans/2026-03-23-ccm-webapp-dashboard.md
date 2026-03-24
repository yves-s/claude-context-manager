# CCM Web App — Subsystem 2: Dashboard + Repo Detail

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the read-only Dashboard and Repo Detail views with Sidebar navigation, KPI cards, repo table, activity feed, and all defined empty/loading states — powered by fixture data.

**Architecture:** Replace the existing flat `[org]/layout.tsx` header with a shadcn Sidebar. Define TypeScript interfaces and a fixture-backed data layer (`getOrgData`/`getRepoData`) that Subsystem 3 will swap for real GitHub data. All UI components are pure Server Components reading from the data layer; no client state needed.

**Tech Stack:** Next.js 15 App Router (async params), shadcn/ui (Sidebar, Table, Badge, Avatar, Card, Skeleton, Sheet, ScrollArea), Tailwind CSS v4, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-23-ccm-webapp-dashboard-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/data/types.ts` | Create | All shared TypeScript interfaces (OrgData, Repo, Member, etc.) |
| `src/lib/data/org.ts` | Create | `getOrgData()` / `getRepoData()` — returns fixture data; Subsystem 3 replaces body |
| `src/lib/fixtures/org-data.ts` | Create | Fixture OrgData instance (4–6 repos, 3–4 members, 8–10 activity entries) |
| `src/lib/data/status.ts` | Create | `repoStatus()` pure function: `lastSyncAt + hasClaudeMd → StatusLevel` |
| `src/lib/data/status.test.ts` | Create | Vitest unit tests for `repoStatus()` |
| `src/components/layout/app-sidebar.tsx` | Create | Sidebar with CCM header, org name, repo list (with status dots), nav links |
| `src/components/shared/status-dot.tsx` | Create | Coloured dot `<span>` for sidebar repo list |
| `src/components/shared/status-badge.tsx` | Create | shadcn Badge wrapper for table/header status |
| `src/components/dashboard/kpi-cards.tsx` | Create | Four KPI Card components (Sub-Repos, Sessions/Woche, Team Members, Letztes Update) |
| `src/components/dashboard/repo-table.tsx` | Create | shadcn Table: Name+dot, Stack, Sessions 7d, Last sync, Status badge; row click → detail |
| `src/components/dashboard/activity-feed.tsx` | Create | Chronological activity list with Avatar, name, repo, files, timestamp |
| `src/components/dashboard/team-panel.tsx` | Create | Member list with Avatar, name, role badge |
| `src/components/repos/repo-header.tsx` | Create | h1, stack badges, status badge, session count + lastSyncAt |
| `src/components/repos/context-block.tsx` | Create | Monospace CLAUDE.md context block + stack tag-chips + sync subtext |
| `src/components/repos/sessions-table.tsx` | Create | shadcn Table: User, Dateien, Zusammenfassung, Zeit |
| `src/components/repos/contributors-panel.tsx` | Create | Avatar, name, session count, role badge |
| `src/components/repos/meta-repo-info.tsx` | Create | Info card: GitHub Org, Meta-Repo, Sync-Status badge |
| `src/app/[org]/layout.tsx` | Modify | Replace `<header>+<main>` with `SidebarProvider + AppSidebar + SidebarInset` |
| `src/app/[org]/dashboard/page.tsx` | Modify | Full dashboard: KPI cards, repo table, activity feed, team panel |
| `src/app/[org]/repos/[slug]/page.tsx` | Create | Repo detail page: header, context block, sessions table, contributors panel |

---

## Task 1: TypeScript Interfaces + Status Logic (TDD)

**Files:**
- Create: `apps/web/src/lib/data/types.ts`
- Create: `apps/web/src/lib/data/status.ts`
- Create: `apps/web/src/lib/data/status.test.ts`

- [ ] **Step 1.1: Create types file**

```typescript
// apps/web/src/lib/data/types.ts

export type StatusLevel = 'aktiv' | 'ruhig' | 'inaktiv' | 'kein-kontext'

export interface OrgData {
  repos: Repo[]
  members: Member[]
  recentActivity: ActivityEntry[]
  githubConnected: boolean
}

export interface Repo {
  slug: string
  name: string
  stack: string[]
  lastSyncAt?: Date
  sessionCount7d: number
  sessionCount7dPrevious: number
  totalSessions: number
  hasClaudeMd: boolean
  context?: string
  contributors: Contributor[]
  sessions: Session[]
}

export interface Member {
  userId: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member'
  avatarUrl?: string
}

export interface Contributor {
  userId: string
  name: string
  avatarUrl?: string
  sessionCount: number
  role?: 'owner' | 'admin' | 'member'
}

export interface Session {
  id: string
  userId: string
  userName: string
  avatarUrl?: string
  filesChanged: number
  summary: string
  createdAt: Date
}

export interface ActivityEntry {
  sessionId: string
  userId: string
  userName: string
  avatarUrl?: string
  repoSlug: string
  repoName: string
  filesChanged: number
  createdAt: Date
}
```

- [ ] **Step 1.2: Write failing tests for `repoStatus()`**

```typescript
// apps/web/src/lib/data/status.test.ts
import { describe, it, expect } from 'vitest'
import { repoStatus } from './status'

describe('repoStatus', () => {
  const now = new Date('2026-03-23T12:00:00Z')

  it('returns kein-kontext when hasClaudeMd is false', () => {
    expect(repoStatus({ hasClaudeMd: false, lastSyncAt: now }, now)).toBe('kein-kontext')
  })

  it('returns aktiv when last sync within 7 days', () => {
    const d = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    expect(repoStatus({ hasClaudeMd: true, lastSyncAt: d }, now)).toBe('aktiv')
  })

  it('returns ruhig when last sync 7–30 days ago', () => {
    const d = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
    expect(repoStatus({ hasClaudeMd: true, lastSyncAt: d }, now)).toBe('ruhig')
  })

  it('returns inaktiv when last sync older than 30 days', () => {
    const d = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
    expect(repoStatus({ hasClaudeMd: true, lastSyncAt: d }, now)).toBe('inaktiv')
  })

  it('returns inaktiv when no lastSyncAt', () => {
    expect(repoStatus({ hasClaudeMd: true, lastSyncAt: undefined }, now)).toBe('inaktiv')
  })
})
```

- [ ] **Step 1.3: Run test — verify it fails**

```bash
cd apps/web && npx vitest run src/lib/data/status.test.ts
```
Expected: FAIL — `Cannot find module './status'`

- [ ] **Step 1.4: Implement `repoStatus()`**

```typescript
// apps/web/src/lib/data/status.ts
import type { StatusLevel } from './types'

const DAY = 24 * 60 * 60 * 1000

export function repoStatus(
  repo: { hasClaudeMd: boolean; lastSyncAt?: Date },
  now = new Date()
): StatusLevel {
  if (!repo.hasClaudeMd) return 'kein-kontext'
  if (!repo.lastSyncAt) return 'inaktiv'
  const ageDays = (now.getTime() - repo.lastSyncAt.getTime()) / DAY
  if (ageDays <= 7) return 'aktiv'
  if (ageDays <= 30) return 'ruhig'
  return 'inaktiv'
}
```

- [ ] **Step 1.5: Run test — verify it passes**

```bash
cd apps/web && npx vitest run src/lib/data/status.test.ts
```
Expected: 5 tests PASS

- [ ] **Step 1.6: Commit**

```bash
git add apps/web/src/lib/data/
git commit -m "feat(web): add data types and repoStatus() with tests"
```

---

## Task 2: Fixture Data

**Files:**
- Create: `apps/web/src/lib/fixtures/org-data.ts`
- Create: `apps/web/src/lib/data/org.ts`

- [ ] **Step 2.1: Create fixture file**

```typescript
// apps/web/src/lib/fixtures/org-data.ts
import type { OrgData } from '@/lib/data/types'

const now = new Date('2026-03-23T10:00:00Z')
const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)

export const fixtureOrgData: OrgData = {
  githubConnected: process.env.FIXTURE_GITHUB_CONNECTED === 'true',
  repos: [
    {
      slug: 'dashboard',
      name: 'dashboard',
      stack: ['Next.js', 'Supabase', 'Tailwind'],
      lastSyncAt: d(0.08), // 2h ago
      sessionCount7d: 12,
      sessionCount7dPrevious: 8,
      totalSessions: 47,
      hasClaudeMd: true,
      context: `# Dashboard\n\nNext.js 15 SaaS app with Supabase auth and multi-tenant org model.\n\n## Stack\n- Next.js 15 App Router\n- Supabase (auth + DB)\n- Tailwind CSS v4 + shadcn/ui`,
      contributors: [
        { userId: 'u1', name: 'Yves Liebscher', sessionCount: 30, role: 'owner' },
        { userId: 'u2', name: 'Max Müller', sessionCount: 17, role: 'admin' },
      ],
      sessions: [
        { id: 's1', userId: 'u1', userName: 'Yves Liebscher', filesChanged: 8, summary: 'Implement sidebar layout and KPI cards', createdAt: d(0.08) },
        { id: 's2', userId: 'u2', userName: 'Max Müller', filesChanged: 3, summary: 'Fix auth redirect loop after org creation', createdAt: d(1.2) },
        { id: 's3', userId: 'u1', userName: 'Yves Liebscher', filesChanged: 5, summary: 'Add repo detail page with sessions table', createdAt: d(2.5) },
      ],
    },
    {
      slug: 'crm',
      name: 'crm',
      stack: ['React', 'FastAPI', 'PostgreSQL'],
      lastSyncAt: d(3),
      sessionCount7d: 5,
      sessionCount7dPrevious: 7,
      totalSessions: 23,
      hasClaudeMd: true,
      context: `# CRM\n\nInternal CRM system built with React frontend and FastAPI backend.\n\n## Stack\n- React 18\n- FastAPI\n- PostgreSQL`,
      contributors: [
        { userId: 'u2', name: 'Max Müller', sessionCount: 15, role: 'admin' },
        { userId: 'u3', name: 'Sarah Weber', sessionCount: 8, role: 'member' },
      ],
      sessions: [
        { id: 's4', userId: 'u2', userName: 'Max Müller', filesChanged: 4, summary: 'Add contact import via CSV', createdAt: d(3) },
        { id: 's5', userId: 'u3', userName: 'Sarah Weber', filesChanged: 2, summary: 'Fix deal stage filter', createdAt: d(4.5) },
      ],
    },
    {
      slug: 'website',
      name: 'website',
      stack: ['Astro', 'Tailwind'],
      lastSyncAt: d(18),
      sessionCount7d: 0,
      sessionCount7dPrevious: 2,
      totalSessions: 11,
      hasClaudeMd: true,
      context: `# Website\n\nMarketing website built with Astro.\n\n## Stack\n- Astro 4\n- Tailwind CSS`,
      contributors: [
        { userId: 'u1', name: 'Yves Liebscher', sessionCount: 7, role: 'owner' },
        { userId: 'u4', name: 'Julia Bauer', sessionCount: 4, role: 'member' },
      ],
      sessions: [
        { id: 's6', userId: 'u4', userName: 'Julia Bauer', filesChanged: 6, summary: 'Update pricing page copy', createdAt: d(18) },
      ],
    },
    {
      slug: 'ops',
      name: 'ops',
      stack: ['Bash', 'Docker'],
      lastSyncAt: d(45),
      sessionCount7d: 0,
      sessionCount7dPrevious: 0,
      totalSessions: 5,
      hasClaudeMd: true,
      context: `# Ops\n\nInfrastructure scripts and Docker configs.`,
      contributors: [
        { userId: 'u1', name: 'Yves Liebscher', sessionCount: 5, role: 'owner' },
      ],
      sessions: [
        { id: 's7', userId: 'u1', userName: 'Yves Liebscher', filesChanged: 1, summary: 'Update deploy script for staging', createdAt: d(45) },
      ],
    },
    {
      slug: 'mobile',
      name: 'mobile',
      stack: [],
      sessionCount7d: 0,
      sessionCount7dPrevious: 0,
      totalSessions: 0,
      hasClaudeMd: false,
      contributors: [],
      sessions: [],
    },
    {
      slug: 'data-pipeline',
      name: 'data-pipeline',
      stack: [],
      sessionCount7d: 0,
      sessionCount7dPrevious: 0,
      totalSessions: 0,
      hasClaudeMd: false,
      contributors: [],
      sessions: [],
    },
  ],
  members: [
    { userId: 'u1', name: 'Yves Liebscher', email: 'yves@example.com', role: 'owner' },
    { userId: 'u2', name: 'Max Müller', email: 'max@example.com', role: 'admin' },
    { userId: 'u3', name: 'Sarah Weber', email: 'sarah@example.com', role: 'member' },
    { userId: 'u4', name: 'Julia Bauer', email: 'julia@example.com', role: 'member' },
  ],
  recentActivity: [
    { sessionId: 's1', userId: 'u1', userName: 'Yves Liebscher', repoSlug: 'dashboard', repoName: 'dashboard', filesChanged: 8, createdAt: d(0.08) },
    { sessionId: 's2', userId: 'u2', userName: 'Max Müller', repoSlug: 'dashboard', repoName: 'dashboard', filesChanged: 3, createdAt: d(1.2) },
    { sessionId: 's3', userId: 'u1', userName: 'Yves Liebscher', repoSlug: 'dashboard', repoName: 'dashboard', filesChanged: 5, createdAt: d(2.5) },
    { sessionId: 's4', userId: 'u2', userName: 'Max Müller', repoSlug: 'crm', repoName: 'crm', filesChanged: 4, createdAt: d(3) },
    { sessionId: 's5', userId: 'u3', userName: 'Sarah Weber', repoSlug: 'crm', repoName: 'crm', filesChanged: 2, createdAt: d(4.5) },
    { sessionId: 's6', userId: 'u4', userName: 'Julia Bauer', repoSlug: 'website', repoName: 'website', filesChanged: 6, createdAt: d(18) },
    { sessionId: 's7', userId: 'u1', userName: 'Yves Liebscher', repoSlug: 'ops', repoName: 'ops', filesChanged: 1, createdAt: d(45) },
  ],
}
```

- [ ] **Step 2.2: Create data access layer**

```typescript
// apps/web/src/lib/data/org.ts
import type { OrgData, Repo } from './types'
import { fixtureOrgData } from '@/lib/fixtures/org-data'

// Subsystem 3 replaces these implementations with GitHub API calls.
// The function signatures MUST NOT change.

export async function getOrgData(_orgSlug: string): Promise<OrgData> {
  return fixtureOrgData
}

export async function getRepoData(_orgSlug: string, repoSlug: string): Promise<Repo | null> {
  const data = await getOrgData(_orgSlug)
  return data.repos.find(r => r.slug === repoSlug) ?? null
}
```

- [ ] **Step 2.3: Commit**

```bash
git add apps/web/src/lib/fixtures/ apps/web/src/lib/data/org.ts
git commit -m "feat(web): add fixture data and getOrgData/getRepoData"
```

---

## Task 3: Shared UI Primitives — StatusDot + StatusBadge

**Files:**
- Create: `apps/web/src/components/shared/status-dot.tsx`
- Create: `apps/web/src/components/shared/status-badge.tsx`

- [ ] **Step 3.1: Create StatusDot**

```tsx
// apps/web/src/components/shared/status-dot.tsx
import type { StatusLevel } from '@/lib/data/types'

const colours: Record<StatusLevel, string> = {
  'aktiv': 'bg-green-500',
  'ruhig': 'bg-yellow-400',
  'inaktiv': 'bg-zinc-400',
  'kein-kontext': 'border-2 border-red-400 bg-transparent',
}

export function StatusDot({ status }: { status: StatusLevel }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colours[status]}`}
      aria-label={status}
    />
  )
}
```

- [ ] **Step 3.2: Create StatusBadge**

```tsx
// apps/web/src/components/shared/status-badge.tsx
import { Badge } from '@/components/ui/badge'
import type { StatusLevel } from '@/lib/data/types'

const variants: Record<StatusLevel, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  'aktiv': 'default',
  'ruhig': 'secondary',
  'inaktiv': 'outline',
  'kein-kontext': 'destructive',
}

const labels: Record<StatusLevel, string> = {
  'aktiv': 'aktiv',
  'ruhig': 'ruhig',
  'inaktiv': 'inaktiv',
  'kein-kontext': 'kein Kontext',
}

export function StatusBadge({ status }: { status: StatusLevel }) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>
}
```

- [ ] **Step 3.3: Commit**

```bash
git add apps/web/src/components/shared/
git commit -m "feat(web): add StatusDot and StatusBadge shared components"
```

---

## Task 4: AppSidebar

**Files:**
- Create: `apps/web/src/components/layout/app-sidebar.tsx`

The sidebar uses `shadcn/ui` Sidebar primitives. The OrgSwitcher currently imports the org context via props; here we also receive the repos list to show status dots.

- [ ] **Step 4.1: Create the file with an empty export (placeholder)**

Create `apps/web/src/components/layout/app-sidebar.tsx` with just a minimal export so the file exists for the commit. **Task 5, Step 5.2 replaces the entire file with the final implementation.**

```tsx
// apps/web/src/components/layout/app-sidebar.tsx
// Placeholder — replaced in Task 5, Step 5.2
export function AppSidebar(_props: object) { return null }
```

- [ ] **Step 4.2: Commit**

```bash
git add apps/web/src/components/layout/
git commit -m "feat(web): scaffold AppSidebar file (implementation in Task 5)"
```

---

## Task 5: Refactor `[org]/layout.tsx` → Sidebar Layout

**Files:**
- Modify: `apps/web/src/app/[org]/layout.tsx`

The layout needs to: (1) call `getOrgData()` to get the repos list, (2) pass repos + org info to `AppSidebar`, (3) wrap everything in `SidebarProvider`. It must also pass `currentPath` for active state highlighting. The existing `OrgProvider` stays.

- [ ] **Step 5.1: Read the Next.js docs for how to get the current pathname in a Server Component**

In Next.js 15 App Router, Server Components cannot use `usePathname()` (client hook). Instead, pass `headers().get('x-pathname')` if middleware sets it, **or** accept `pathname` doesn't exist server-side and instead mark `AppSidebar` as a client component that uses `usePathname()` internally.

The cleanest approach: keep `AppSidebar` rendering with a `'use client'` wrapper that reads pathname. Update `app-sidebar.tsx` to be a client component that uses `usePathname` from `next/navigation`.

- [ ] **Step 5.2: Update AppSidebar to be a Client Component using `usePathname`**

Replace the entire contents of `apps/web/src/components/layout/app-sidebar.tsx` with the following (adds `'use client'`, removes the `currentPath` prop, reads pathname from the hook):

```tsx
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { StatusDot } from '@/components/shared/status-dot'
import { repoStatus } from '@/lib/data/status'
import type { Repo } from '@/lib/data/types'

interface Props {
  orgSlug: string
  orgName: string
  role: string
  repos: Repo[]
}

export function AppSidebar({ orgSlug, orgName, role, repos }: Props) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">CCM</span>
            <span className="text-muted-foreground text-sm">·</span>
            <span className="font-medium text-sm truncate max-w-32">{orgName}</span>
          </div>
          <Badge variant="outline" className="text-xs capitalize shrink-0">{role}</Badge>
        </div>
      </SidebarHeader>

      <Separator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Übersicht</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === `/${orgSlug}/dashboard`}>
                <Link href={`/${orgSlug}/dashboard`}>Dashboard</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Repos</SidebarGroupLabel>
          <SidebarMenu>
            <ScrollArea className={repos.length > 10 ? 'h-64' : undefined}>
              {repos.map(repo => {
                const status = repoStatus(repo)
                return (
                  <SidebarMenuItem key={repo.slug}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/${orgSlug}/repos/${repo.slug}`}
                    >
                      <Link href={`/${orgSlug}/repos/${repo.slug}`} className="flex items-center gap-2">
                        <StatusDot status={status} />
                        <span>{repo.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </ScrollArea>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Team</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href={`/${orgSlug}/settings`}>Members</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Einstellungen</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === `/${orgSlug}/settings`}>
                <Link href={`/${orgSlug}/settings`}>Settings</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
```

- [ ] **Step 5.3: Rewrite `[org]/layout.tsx`**

```tsx
// apps/web/src/app/[org]/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { OrgProvider } from '@/providers/org-provider'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { getOrgData } from '@/lib/data/org'
import { Separator } from '@/components/ui/separator'

interface Props {
  children: React.ReactNode
  params: Promise<{ org: string }>
}

export default async function OrgLayout({ children, params }: Props) {
  const { org: orgSlug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const headersList = await headers()
  const orgId = headersList.get('x-org-id')
  const orgRole = headersList.get('x-org-role')
  if (!orgId || !orgRole) redirect('/select-org')

  const { data: org } = await supabase
    .from('organizations')
    .select('name, slug')
    .eq('id', orgId)
    .single()
  if (!org) redirect('/select-org')

  const orgData = await getOrgData(orgSlug)

  return (
    <OrgProvider value={{ orgId, orgSlug: org.slug, orgName: org.name, role: orgRole }}>
      <SidebarProvider>
        <AppSidebar
          orgSlug={org.slug}
          orgName={org.name}
          role={orgRole}
          repos={orgData.repos}
        />
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 px-4 border-b">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </OrgProvider>
  )
}
```

- [ ] **Step 5.4: Start dev server and verify sidebar renders**

```bash
cd apps/web && npm run dev
```

Open `http://localhost:3000/[your-org]/dashboard` — you should see the sidebar with repo list and status dots.

- [ ] **Step 5.5: Commit**

```bash
git add apps/web/src/app/[org]/layout.tsx apps/web/src/components/layout/app-sidebar.tsx
git commit -m "feat(web): replace header with shadcn Sidebar in [org] layout"
```

---

## Task 6: Dashboard — KPI Cards

**Files:**
- Create: `apps/web/src/components/dashboard/kpi-cards.tsx`

- [ ] **Step 6.1: Create KPI cards component**

```tsx
// apps/web/src/components/dashboard/kpi-cards.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OrgData } from '@/lib/data/types'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

interface Props {
  data: OrgData
  pendingInviteCount: number
}

export function KpiCards({ data, pendingInviteCount }: Props) {
  const sessions7d = data.repos.reduce((sum, r) => sum + r.sessionCount7d, 0)
  const sessions7dPrev = data.repos.reduce((sum, r) => sum + r.sessionCount7dPrevious, 0)
  const sessionsDelta = sessions7d - sessions7dPrev
  const latest = data.recentActivity[0]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sub-Repos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{data.repos.length}</p>
          <p className="text-xs text-muted-foreground mt-1">via GitHub verbunden</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sessions / Woche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {data.githubConnected ? sessions7d : '—'}
          </p>
          {data.githubConnected && (
            <p className={`text-xs mt-1 ${sessionsDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {sessionsDelta >= 0 ? '↑' : '↓'} {Math.abs(sessionsDelta)} ggü. Vorwoche
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{data.members.length}</p>
          {pendingInviteCount > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              {pendingInviteCount} Einladung{pendingInviteCount > 1 ? 'en' : ''} offen
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Letztes Update
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {latest
              ? formatDistanceToNow(latest.createdAt, { addSuffix: false, locale: de })
              : '—'}
          </p>
          {latest && (
            <p className="text-xs text-muted-foreground mt-1">
              {latest.repoName} · {latest.userName}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Note:** This requires `date-fns`. Check if it's already installed:

```bash
cd apps/web && cat package.json | grep date-fns
```

If missing, install it:

```bash
cd apps/web && npm install date-fns
```

- [ ] **Step 6.2: Commit**

```bash
git add apps/web/src/components/dashboard/
git commit -m "feat(web): add KPI cards component"
```

---

## Task 7: Dashboard — Repo Table

**Files:**
- Create: `apps/web/src/components/dashboard/repo-table.tsx`

- [ ] **Step 7.1: Create RepoTable**

```tsx
// apps/web/src/components/dashboard/repo-table.tsx
'use client'

import { useRouter } from 'next/navigation'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusDot } from '@/components/shared/status-dot'
import { StatusBadge } from '@/components/shared/status-badge'
import { repoStatus } from '@/lib/data/status'
import type { Repo } from '@/lib/data/types'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

interface Props {
  repos: Repo[]
  orgSlug: string
  githubConnected: boolean
}

export function RepoTable({ repos, orgSlug, githubConnected }: Props) {
  const router = useRouter()

  if (!githubConnected) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Stack</TableHead>
            <TableHead>Sessions (7d)</TableHead>
            <TableHead>Zuletzt</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Stack</TableHead>
          <TableHead>Sessions (7d)</TableHead>
          <TableHead>Zuletzt</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {repos.map(repo => {
          const status = repoStatus(repo)
          return (
            <TableRow
              key={repo.slug}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/${orgSlug}/repos/${repo.slug}`)}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <StatusDot status={status} />
                  <span className="font-medium">{repo.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {repo.stack.join(' / ') || '—'}
              </TableCell>
              <TableCell>
                <span className="font-medium">{repo.sessionCount7d}</span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {repo.lastSyncAt
                  ? formatDistanceToNow(repo.lastSyncAt, { addSuffix: true, locale: de })
                  : '—'}
              </TableCell>
              <TableCell>
                <StatusBadge status={status} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 7.2: Commit**

```bash
git add apps/web/src/components/dashboard/repo-table.tsx
git commit -m "feat(web): add RepoTable with status dots and row navigation"
```

---

## Task 8: Dashboard — Activity Feed + Team Panel

**Files:**
- Create: `apps/web/src/components/dashboard/activity-feed.tsx`
- Create: `apps/web/src/components/dashboard/team-panel.tsx`

- [ ] **Step 8.1: Create ActivityFeed**

```tsx
// apps/web/src/components/dashboard/activity-feed.tsx
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import type { ActivityEntry } from '@/lib/data/types'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

interface Props {
  activity: ActivityEntry[]
  githubConnected: boolean
}

export function ActivityFeed({ activity, githubConnected }: Props) {
  if (!githubConnected) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {activity.map(entry => (
        <div key={entry.sessionId} className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials(entry.userName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{entry.userName}</p>
            <p className="text-xs text-muted-foreground">
              {entry.repoName} · {entry.filesChanged} Datei{entry.filesChanged !== 1 ? 'en' : ''}
            </p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDistanceToNow(entry.createdAt, { addSuffix: true, locale: de })}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 8.2: Create TeamPanel**

```tsx
// apps/web/src/components/dashboard/team-panel.tsx
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Member } from '@/lib/data/types'

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

const roleVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
}

interface Props {
  members: Member[]
  githubConnected: boolean
}

export function TeamPanel({ members, githubConnected }: Props) {
  if (!githubConnected) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3 w-28 flex-1" />
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {members.map(member => (
        <div key={member.userId} className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
          </Avatar>
          <span className="text-sm flex-1 truncate">{member.name}</span>
          <Badge variant={roleVariant[member.role] ?? 'outline'} className="text-xs capitalize">
            {member.role}
          </Badge>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 8.3: Commit**

```bash
git add apps/web/src/components/dashboard/
git commit -m "feat(web): add ActivityFeed and TeamPanel dashboard components"
```

---

## Task 9: Dashboard Page

**Files:**
- Modify: `apps/web/src/app/[org]/dashboard/page.tsx`

- [ ] **Step 9.1: Rewrite dashboard page**

```tsx
// apps/web/src/app/[org]/dashboard/page.tsx
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgData } from '@/lib/data/org'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { RepoTable } from '@/components/dashboard/repo-table'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { TeamPanel } from '@/components/dashboard/team-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

interface Props { params: Promise<{ org: string }> }

export default async function DashboardPage({ params }: Props) {
  const { org: orgSlug } = await params

  const headersList = await headers()
  const orgId = headersList.get('x-org-id')
  if (!orgId) redirect('/select-org')

  const supabase = await createClient()

  // Pending invite count for KPI card
  const { count: pendingInviteCount } = await supabase
    .from('invitations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())

  const orgData = await getOrgData(orgSlug)

  if (!orgData.githubConnected) {
    return (
      <div className="flex flex-col gap-6">
        <KpiCards data={orgData} pendingInviteCount={pendingInviteCount ?? 0} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <svg className="w-10 h-10 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <p className="text-sm text-muted-foreground max-w-xs">
              GitHub verbinden um Repositories und Aktivität zu sehen.
            </p>
            <Link
              href={`/${orgSlug}/settings#github`}
              className="text-sm font-medium underline underline-offset-4"
            >
              GitHub verbinden →
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <KpiCards data={orgData} pendingInviteCount={pendingInviteCount ?? 0} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Repositories</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RepoTable
              repos={orgData.repos}
              orgSlug={orgSlug}
              githubConnected={orgData.githubConnected}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Letzte Aktivität</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed
                activity={orgData.recentActivity}
                githubConnected={orgData.githubConnected}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team</CardTitle>
            </CardHeader>
            <CardContent>
              <TeamPanel
                members={orgData.members}
                githubConnected={orgData.githubConnected}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 9.2: Verify in browser**

Navigate to `/[org]/dashboard`. With `FIXTURE_GITHUB_CONNECTED=false` (default) you should see: skeleton rows in the table, skeleton entries in activity/team panels, and GitHub-connect empty state card.

Set `FIXTURE_GITHUB_CONNECTED=true` in `.env.local`, restart dev server, verify the full dashboard renders with data.

- [ ] **Step 9.3: Commit**

```bash
git add apps/web/src/app/[org]/dashboard/page.tsx
git commit -m "feat(web): implement full Dashboard page with KPIs, repo table, activity, team"
```

---

## Task 10: Repo Detail — Components

**Files:**
- Create: `apps/web/src/components/repos/context-block.tsx`
- Create: `apps/web/src/components/repos/sessions-table.tsx`
- Create: `apps/web/src/components/repos/contributors-panel.tsx`
- Create: `apps/web/src/components/repos/meta-repo-info.tsx`

- [ ] **Step 10.1: Create ContextBlock**

```tsx
// apps/web/src/components/repos/context-block.tsx
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Repo } from '@/lib/data/types'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

interface Props {
  repo: Repo
  githubConnected: boolean
}

export function ContextBlock({ repo, githubConnected }: Props) {
  if (!githubConnected) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        GitHub verbinden um den Kontext dieses Repos zu sehen.
      </div>
    )
  }

  if (!repo.hasClaudeMd) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <p>Diese Repository hat noch keine CLAUDE.md.</p>
        <p className="mt-1 font-mono text-xs">ccm add</p>
        <p className="text-xs mt-0.5">im Projektordner ausführen um CCM einzurichten.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <pre className="rounded-lg border bg-muted/50 p-4 text-xs font-mono overflow-auto whitespace-pre-wrap">
        {repo.context}
      </pre>
      <div className="flex flex-wrap gap-2">
        {repo.stack.map(tag => (
          <Badge key={tag} variant="secondary">{tag}</Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Zuletzt gesynct:{' '}
        {repo.lastSyncAt
          ? formatDistanceToNow(repo.lastSyncAt, { addSuffix: true, locale: de })
          : '—'}{' '}
        · via GitHub Action
      </p>
    </div>
  )
}
```

- [ ] **Step 10.2: Create SessionsTable**

```tsx
// apps/web/src/components/repos/sessions-table.tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import type { Session } from '@/lib/data/types'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

interface Props {
  sessions: Session[]
  githubConnected: boolean
}

export function SessionsTable({ sessions, githubConnected }: Props) {
  if (!githubConnected) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Dateien</TableHead>
            <TableHead>Zusammenfassung</TableHead>
            <TableHead>Zeit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
              <TableCell><Skeleton className="h-4 w-48" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Dateien</TableHead>
          <TableHead>Zusammenfassung</TableHead>
          <TableHead>Zeit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map(session => (
          <TableRow key={session.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{initials(session.userName)}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{session.userName}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm">{session.filesChanged}</TableCell>
            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
              {session.summary}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDistanceToNow(session.createdAt, { addSuffix: true, locale: de })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 10.3: Create ContributorsPanel**

```tsx
// apps/web/src/components/repos/contributors-panel.tsx
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Contributor } from '@/lib/data/types'

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

interface Props {
  contributors: Contributor[]
  githubConnected: boolean
}

export function ContributorsPanel({ contributors, githubConnected }: Props) {
  if (!githubConnected) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3 w-28 flex-1" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {contributors.map(c => (
        <div key={c.userId} className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials(c.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.sessionCount} Sessions</p>
          </div>
          {c.role && (
            <Badge variant="outline" className="text-xs capitalize shrink-0">{c.role}</Badge>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 10.4: Create MetaRepoInfo**

```tsx
// apps/web/src/components/repos/meta-repo-info.tsx
import { Badge } from '@/components/ui/badge'

interface Props {
  orgSlug: string
  syncStatus: 'synced' | 'pending' | 'error'
}

export function MetaRepoInfo({ orgSlug, syncStatus }: Props) {
  const statusVariant = syncStatus === 'synced' ? 'default' : syncStatus === 'error' ? 'destructive' : 'secondary'

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">GitHub Org</span>
        <span className="font-mono text-xs">{orgSlug}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Meta-Repo</span>
        <span className="font-mono text-xs">{orgSlug}-context</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Sync</span>
        <Badge variant={statusVariant} className="text-xs capitalize">{syncStatus}</Badge>
      </div>
    </div>
  )
}
```

- [ ] **Step 10.5: Commit**

```bash
git add apps/web/src/components/repos/
git commit -m "feat(web): add ContextBlock, SessionsTable, ContributorsPanel, MetaRepoInfo"
```

---

## Task 11: Repo Detail Page

**Files:**
- Create: `apps/web/src/app/[org]/repos/[slug]/page.tsx`

- [ ] **Step 11.1: Create repo detail page**

```tsx
// apps/web/src/app/[org]/repos/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { repoStatus } from '@/lib/data/status'
import { getRepoData, getOrgData } from '@/lib/data/org'
import { ContextBlock } from '@/components/repos/context-block'
import { SessionsTable } from '@/components/repos/sessions-table'
import { ContributorsPanel } from '@/components/repos/contributors-panel'
import { MetaRepoInfo } from '@/components/repos/meta-repo-info'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

interface Props { params: Promise<{ org: string; slug: string }> }

export default async function RepoDetailPage({ params }: Props) {
  const { org: orgSlug, slug } = await params

  const [repo, orgData] = await Promise.all([
    getRepoData(orgSlug, slug),
    getOrgData(orgSlug),
  ])

  if (!repo) notFound()

  const status = repoStatus(repo)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{repo.name}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {repo.stack.map(tag => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground shrink-0">
          <p className="font-medium text-foreground">{repo.totalSessions} Sessions</p>
          {repo.lastSyncAt && (
            <p className="text-xs">
              zuletzt {formatDistanceToNow(repo.lastSyncAt, { addSuffix: true, locale: de })}
            </p>
          )}
        </div>
      </div>

      {/* CLAUDE.md context */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kontext (CLAUDE.md)</CardTitle>
        </CardHeader>
        <CardContent>
          <ContextBlock repo={repo} githubConnected={orgData.githubConnected} />
        </CardContent>
      </Card>

      {/* Sessions + right column */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Sessions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <SessionsTable
              sessions={repo.sessions}
              githubConnected={orgData.githubConnected}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contributors</CardTitle>
            </CardHeader>
            <CardContent>
              <ContributorsPanel
                contributors={repo.contributors}
                githubConnected={orgData.githubConnected}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meta-Repo</CardTitle>
            </CardHeader>
            <CardContent>
              <MetaRepoInfo orgSlug={orgSlug} syncStatus="synced" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 11.2: Verify in browser**

Navigate to `/[org]/repos/dashboard`. With `FIXTURE_GITHUB_CONNECTED=true` you should see: header with name + stack badges + status badge, CLAUDE.md context block, sessions table, contributors panel, and meta-repo info card.

Click a repo row in the dashboard table — confirm navigation to the detail page works.

- [ ] **Step 11.3: Commit**

```bash
git add apps/web/src/app/[org]/repos/
git commit -m "feat(web): implement Repo Detail page"
```

---

## Task 12: Mobile Sidebar (Sheet)

**Files:**
- Modify: `apps/web/src/components/layout/app-sidebar.tsx`

The `shadcn/ui Sidebar` component already handles mobile responsiveness via `useSidebar()` hook and the `SidebarTrigger` in the layout header (added in Task 5). Verify mobile behaviour:

- [ ] **Step 12.1: Verify mobile sidebar with DevTools**

Open Chrome DevTools → toggle device toolbar → set to iPhone 12. The sidebar should be hidden and the hamburger trigger in the header should open it as a Sheet overlay.

If the sidebar is not collapsing to a Sheet on mobile, add `collapsible="offcanvas"` to the `<Sidebar>` element in `app-sidebar.tsx`:

```tsx
<Sidebar collapsible="offcanvas">
```

- [ ] **Step 12.2: Commit if changed**

```bash
git add apps/web/src/components/layout/app-sidebar.tsx
git commit -m "feat(web): set sidebar to offcanvas mode for mobile"
```

---

## Task 13: Final Verification

- [ ] **Step 13.1: Run all tests**

```bash
cd apps/web && npx vitest run
```
Expected: all tests pass (at minimum the status.test.ts suite).

- [ ] **Step 13.2: Build check**

```bash
cd apps/web && npm run build
```
Expected: build completes without errors. Fix any TypeScript errors before proceeding.

- [ ] **Step 13.3: Manual verification checklist**

With `FIXTURE_GITHUB_CONNECTED=false`:
- [ ] Dashboard shows `—` for Sessions/Woche KPI
- [ ] Repo table shows 4 skeleton rows
- [ ] Activity feed shows skeleton entries
- [ ] Team panel shows skeleton entries

With `FIXTURE_GITHUB_CONNECTED=true`:
- [ ] Dashboard shows all 4 KPI cards with real values
- [ ] Repo table shows 6 repos with correct status dots (green/yellow/grey/red)
- [ ] Clicking a repo row navigates to `/[org]/repos/[slug]`
- [ ] Repo detail shows header, CLAUDE.md context, sessions, contributors
- [ ] Repo without CLAUDE.md (`mobile`, `data-pipeline`) shows "kein Kontext" badge and empty-state block
- [ ] Sidebar shows all repos with status dots, correct active highlighting

- [ ] **Step 13.4: Final commit**

```bash
git add -A
git commit -m "feat(web): Subsystem 2 — Dashboard + Repo Detail complete"
```
