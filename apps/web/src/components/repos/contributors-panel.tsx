// apps/web/src/components/repos/contributors-panel.tsx
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Contributor } from '@/lib/data/types'
import { initials } from '@/lib/utils/initials'

interface Props {
  contributors: Contributor[]
  githubConnected: boolean
}

export function ContributorsPanel({ contributors, githubConnected }: Props) {
  if (!githubConnected) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3 w-28 flex-1" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
    )
  }

  if (contributors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">Keine Contributors.</p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {contributors.map(c => (
        <div key={c.userId} className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials(c.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.sessionCount} Sessions</p>
          </div>
          {c.role && (
            <Badge variant="outline" className="text-xs capitalize shrink-0">{c.role}</Badge>
          )}
        </div>
      ))}
    </div>
  )
}
