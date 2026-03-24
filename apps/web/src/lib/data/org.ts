import type { OrgData, Repo } from './types'
import { fixtureOrgData } from '@/lib/fixtures/org-data'

// Subsystem 3 replaces these implementations with GitHub API calls.
// The function signatures MUST NOT change.

export async function getOrgData(_orgSlug: string): Promise<OrgData> {
  return fixtureOrgData
}

export async function getRepoData(_orgSlug: string, repoSlug: string): Promise<Repo | null> {
  return fixtureOrgData.repos.find(r => r.slug === repoSlug) ?? null
}
