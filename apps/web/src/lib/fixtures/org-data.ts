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
