import { Badge } from '@/components/ui/badge'
import type { StatusLevel } from '@/lib/data/types'

const variants: Record<StatusLevel, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  'aktiv': 'default',
  'ruhig': 'secondary',
  'inaktiv': 'outline',
  'kein-kontext': 'destructive',
}

const labels: Record<StatusLevel, string> = {
  'aktiv': 'aktiv',
  'ruhig': 'ruhig',
  'inaktiv': 'inaktiv',
  'kein-kontext': 'kein Kontext',
}

export function StatusBadge({ status }: { status: StatusLevel }) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>
}
