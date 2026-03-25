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
    const memberRow = (membersRaw ?? []).find(m => m.user_id === user.id)
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

  // TODO: remove `as any` once Supabase types are regenerated after migration 0002
  if (!(org as any).github_access_token) {
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

  // Total counts — SCALE: this loads all commit rows; replace with per-repo COUNT aggregate before production
  const { data: allCommits } = await service
    .from('repo_commits')
    .select('repo_id')
    .in('repo_id', repoIds)

  // 20 newest commits across all repos for recentActivity
  const { data: activityCommits } = await service
    .from('repo_commits')
    .select('id, repo_id, commit_sha, author_name, author_email, message, files_changed, committed_at')
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
