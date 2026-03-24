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
