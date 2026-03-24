// apps/web/src/components/repos/meta-repo-info.tsx
import { Badge } from '@/components/ui/badge'

interface Props {
  orgSlug: string
  syncStatus: 'synced' | 'pending' | 'error'
}

export function MetaRepoInfo({ orgSlug, syncStatus }: Props) {
  const statusVariant = syncStatus === 'synced' ? 'default' : syncStatus === 'error' ? 'destructive' : 'secondary'

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">GitHub Org</span>
        <span className="font-mono text-xs">{orgSlug}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Meta-Repo</span>
        <span className="font-mono text-xs">{orgSlug}-context</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Sync</span>
        <Badge variant={statusVariant} className="text-xs capitalize">{syncStatus}</Badge>
      </div>
    </div>
  )
}
