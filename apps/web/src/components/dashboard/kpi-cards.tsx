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
