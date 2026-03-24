// apps/web/src/components/repos/context-block.tsx
import { Badge } from '@/components/ui/badge'
import type { Repo } from '@/lib/data/types'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

interface Props {
  repo: Repo
  githubConnected: boolean
}

export function ContextBlock({ repo, githubConnected }: Props) {
  if (!githubConnected) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        GitHub verbinden um den Kontext dieses Repos zu sehen.
      </div>
    )
  }

  if (!repo.hasClaudeMd) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <p>Diese Repository hat noch keine CLAUDE.md.</p>
        <p className="mt-1 font-mono text-xs">ccm add</p>
        <p className="text-xs mt-0.5">im Projektordner ausführen um CCM einzurichten.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <pre className="rounded-lg border bg-muted/50 p-4 text-xs font-mono overflow-auto whitespace-pre-wrap">
        {repo.context}
      </pre>
      <div className="flex flex-wrap gap-2">
        {repo.stack.map(tag => (
          <Badge key={tag} variant="secondary">{tag}</Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Zuletzt gesynct:{' '}
        {repo.lastSyncAt
          ? formatDistanceToNow(repo.lastSyncAt, { addSuffix: true, locale: de })
          : '—'}{' '}
        · via GitHub Action
      </p>
    </div>
  )
}
