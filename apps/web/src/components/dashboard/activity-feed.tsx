// apps/web/src/components/dashboard/activity-feed.tsx
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import type { ActivityEntry } from '@/lib/data/types'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

interface Props {
  activity: ActivityEntry[]
  githubConnected: boolean
}

export function ActivityFeed({ activity, githubConnected }: Props) {
  if (!githubConnected) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {activity.map(entry => (
        <div key={entry.sessionId} className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials(entry.userName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{entry.userName}</p>
            <p className="text-xs text-muted-foreground">
              {entry.repoName} · {entry.filesChanged} Datei{entry.filesChanged !== 1 ? 'en' : ''}
            </p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDistanceToNow(entry.createdAt, { addSuffix: true, locale: de })}
          </span>
        </div>
      ))}
    </div>
  )
}
