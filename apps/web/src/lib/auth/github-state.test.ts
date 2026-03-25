import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateGithubState, verifyGithubState } from './github-state'

// GITHUB_CLIENT_SECRET must be set for HMAC
beforeEach(() => {
  process.env.GITHUB_CLIENT_SECRET = 'test-secret'
})

describe('generateGithubState + verifyGithubState', () => {
  it('round-trips successfully', () => {
    const state = generateGithubState('org-id-123')
    const result = verifyGithubState(state)
    expect(result).not.toBeNull()
    expect(result?.orgId).toBe('org-id-123')
  })

  it('returns null for tampered state', () => {
    const state = generateGithubState('org-id-123')
    const tampered = state.slice(0, -4) + 'xxxx'
    expect(verifyGithubState(tampered)).toBeNull()
  })

  it('returns null for expired state', () => {
    // Generate state with timestamp in the past
    const state = generateGithubState('org-id-123')
    // maxAgeMs=0 → always expired
    expect(verifyGithubState(state, 0)).toBeNull()
  })

  it('returns null for malformed state', () => {
    expect(verifyGithubState('not-valid-base64url!')).toBeNull()
  })
})
