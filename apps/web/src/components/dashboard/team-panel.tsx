// apps/web/src/components/dashboard/team-panel.tsx
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Member } from '@/lib/data/types'
import { initials } from '@/lib/utils/initials'

const roleVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
}

interface Props {
  members: Member[]
  githubConnected: boolean
}

export function TeamPanel({ members, githubConnected }: Props) {
  if (!githubConnected) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3 w-28 flex-1" />
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {members.map(member => (
        <div key={member.userId} className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
          </Avatar>
          <span className="text-sm flex-1 truncate">{member.name}</span>
          <Badge variant={roleVariant[member.role] ?? 'outline'} className="text-xs capitalize">
            {member.role}
          </Badge>
        </div>
      ))}
    </div>
  )
}
