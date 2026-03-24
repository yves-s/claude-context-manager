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
