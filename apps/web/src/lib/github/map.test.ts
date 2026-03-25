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

  it('falls back to author_name when no member match', () => {
    const entry = mapCommitToActivityEntry(commit, 'dashboard', 'Dashboard', new Map())
    expect(entry.userId).toBe('')
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
    expect(contributors[0].name).toBe('Alice')
    expect(contributors[0].sessionCount).toBe(2)
    expect(contributors[1].name).toBe('Bob')
    expect(contributors[1].sessionCount).toBe(1)
  })

  it('groups commit with null email by author name', () => {
    const nullEmailCommit = { ...commit, id: '4', author_email: null, author_name: 'Charlie' }
    const contributors = buildContributors([nullEmailCommit], new Map())
    expect(contributors[0].name).toBe('Charlie')
    expect(contributors[0].sessionCount).toBe(1)
  })

  it('groups commit with null email and null name under unknown', () => {
    const anonymousCommit = { ...commit, id: '5', author_email: null, author_name: null }
    const contributors = buildContributors([anonymousCommit], new Map())
    expect(contributors[0].name).toBe('Unknown')
  })
})
