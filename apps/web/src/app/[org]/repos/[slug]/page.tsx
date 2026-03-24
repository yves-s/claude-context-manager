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
              {/* syncStatus hardcoded to 'synced' — real value comes from Subsystem 3 */}
              <MetaRepoInfo orgSlug={orgSlug} syncStatus="synced" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
