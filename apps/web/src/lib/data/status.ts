import type { StatusLevel } from './types'

const DAY = 24 * 60 * 60 * 1000

export function repoStatus(
  repo: { hasClaudeMd: boolean; lastSyncAt?: Date },
  now = new Date()
): StatusLevel {
  if (!repo.hasClaudeMd) return 'kein-kontext'
  if (!repo.lastSyncAt) return 'inaktiv'
  const ageDays = (now.getTime() - repo.lastSyncAt.getTime()) / DAY
  if (ageDays <= 7) return 'aktiv'
  if (ageDays <= 30) return 'ruhig'
  return 'inaktiv'
}
