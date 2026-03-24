import { describe, it, expect } from 'vitest'
import { repoStatus } from './status'

describe('repoStatus', () => {
  const now = new Date('2026-03-23T12:00:00Z')

  it('returns kein-kontext when hasClaudeMd is false', () => {
    expect(repoStatus({ hasClaudeMd: false, lastSyncAt: now }, now)).toBe('kein-kontext')
  })

  it('returns aktiv when last sync within 7 days', () => {
    const d = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    expect(repoStatus({ hasClaudeMd: true, lastSyncAt: d }, now)).toBe('aktiv')
  })

  it('returns ruhig when last sync 7–30 days ago', () => {
    const d = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
    expect(repoStatus({ hasClaudeMd: true, lastSyncAt: d }, now)).toBe('ruhig')
  })

  it('returns inaktiv when last sync older than 30 days', () => {
    const d = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
    expect(repoStatus({ hasClaudeMd: true, lastSyncAt: d }, now)).toBe('inaktiv')
  })

  it('returns inaktiv when no lastSyncAt', () => {
    expect(repoStatus({ hasClaudeMd: true, lastSyncAt: undefined }, now)).toBe('inaktiv')
  })
})
