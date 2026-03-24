// apps/web/src/components/dashboard/repo-table.tsx
'use client'

import { useRouter } from 'next/navigation'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusDot } from '@/components/shared/status-dot'
import { StatusBadge } from '@/components/shared/status-badge'
import { repoStatus } from '@/lib/data/status'
import type { Repo } from '@/lib/data/types'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

interface Props {
  repos: Repo[]
  orgSlug: string
  githubConnected: boolean
}

export function RepoTable({ repos, orgSlug, githubConnected }: Props) {
  const router = useRouter()

  if (!githubConnected) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Stack</TableHead>
            <TableHead>Sessions (7d)</TableHead>
            <TableHead>Zuletzt</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Stack</TableHead>
          <TableHead>Sessions (7d)</TableHead>
          <TableHead>Zuletzt</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {repos.map(repo => {
          const status = repoStatus(repo)
          return (
            <TableRow
              key={repo.slug}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/${orgSlug}/repos/${repo.slug}`)}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <StatusDot status={status} />
                  <span className="font-medium">{repo.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {repo.stack.join(' / ') || '—'}
              </TableCell>
              <TableCell>
                <span className="font-medium">{repo.sessionCount7d}</span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {repo.lastSyncAt
                  ? formatDistanceToNow(repo.lastSyncAt, { addSuffix: true, locale: de })
                  : '—'}
              </TableCell>
              <TableCell>
                <StatusBadge status={status} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
