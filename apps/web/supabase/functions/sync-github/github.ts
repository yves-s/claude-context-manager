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
  return res.json() as Promise<GithubRepo[]>
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
  return res.json() as Promise<GithubCommit[]>
}
