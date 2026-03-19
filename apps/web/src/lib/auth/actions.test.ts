// apps/web/src/lib/auth/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase clients
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ getAll: () => [], setAll: () => {} })),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateSlug, createOrganization, acceptInvite, createInvite, revokeInvite } from './actions'

describe('generateSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(generateSlug('My Company')).toBe('my-company')
  })

  it('strips special characters', () => {
    expect(generateSlug('Acme & Co.')).toBe('acme-co')
  })

  it('collapses multiple hyphens', () => {
    expect(generateSlug('a  b')).toBe('a-b')
  })
})

describe('createOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error if user not authenticated', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const result = await createOrganization('My Org')
    expect(result.error).toBe('Not authenticated')
  })

  it('creates org and member on success', async () => {
    const mockInsertMember = vi.fn().mockResolvedValue({ data: null, error: null })
    // single() is called by getUniqueSlug (slug check → null = slug free) and
    // by the insert+select chain (returns created org). Use mockResolvedValueOnce
    // so the first call (uniqueness check) returns null data, the second returns the org.
    const mockSingle = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'Not found' } }) // slug free
      .mockResolvedValueOnce({ data: { id: 'org-1', slug: 'my-org' }, error: null }) // org insert
    const mockFrom = vi.fn((table: string) => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: table === 'organizations' ? mockSingle : vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
    }))
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
      from: mockFrom,
    })
    const result = await createOrganization('My Org')
    expect(result.error).toBeNull()
    expect(result.slug).toBe('my-org')
  })
})

describe('acceptInvite', () => {
  it('returns error if token not found', async () => {
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      })),
    })
    const result = await acceptInvite('bad-token', 'user-1')
    expect(result.error).toMatch(/not found/i)
  })

  it('returns error if invite expired', async () => {
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'invite-1',
            organization_id: 'org-1',
            role: 'member',
            expires_at: new Date(Date.now() - 1000).toISOString(),
            accepted_at: null,
          },
          error: null,
        }),
      })),
    })
    const result = await acceptInvite('expired-token', 'user-1')
    expect(result.error).toMatch(/expired/i)
  })
})
