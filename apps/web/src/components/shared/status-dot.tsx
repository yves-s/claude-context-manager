import type { StatusLevel } from '@/lib/data/types'

const colours: Record<StatusLevel, string> = {
  'aktiv': 'bg-green-500',
  'ruhig': 'bg-yellow-400',
  'inaktiv': 'bg-zinc-400',
  'kein-kontext': 'border-2 border-red-400 bg-transparent',
}

export function StatusDot({ status }: { status: StatusLevel }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colours[status]}`}
      aria-label={status}
    />
  )
}
