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
    const entry = map.get(key)
    if (entry) entry.count++
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
