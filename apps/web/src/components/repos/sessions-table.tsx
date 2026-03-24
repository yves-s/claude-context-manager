// apps/web/src/components/repos/sessions-table.tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import type { Session } from '@/lib/data/types'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { initials } from '@/lib/utils/initials'

interface Props {
  sessions: Session[]
  githubConnected: boolean
}

export function SessionsTable({ sessions, githubConnected }: Props) {
  if (!githubConnected) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Dateien</TableHead>
            <TableHead>Zusammenfassung</TableHead>
            <TableHead>Zeit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
              <TableCell><Skeleton className="h-4 w-48" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-4 py-6 text-center">Noch keine Sessions.</p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Dateien</TableHead>
          <TableHead>Zusammenfassung</TableHead>
          <TableHead>Zeit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map(session => (
          <TableRow key={session.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{initials(session.userName)}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{session.userName}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm">{session.filesChanged}</TableCell>
            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
              {session.summary}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDistanceToNow(session.createdAt, { addSuffix: true, locale: de })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
