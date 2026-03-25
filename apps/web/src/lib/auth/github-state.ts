import { createHmac } from 'crypto'

function getSecret(): string {
  const secret = process.env.GITHUB_CLIENT_SECRET
  if (!secret) throw new Error('GITHUB_CLIENT_SECRET not set')
  return secret
}

export function generateGithubState(orgId: string): string {
  const timestamp = Date.now().toString()
  const hmac = createHmac('sha256', getSecret())
  hmac.update(`${orgId}:${timestamp}`)
  const sig = hmac.digest('hex')
  const payload = JSON.stringify({ orgId, timestamp, sig })
  return Buffer.from(payload).toString('base64url')
}

export function verifyGithubState(
  state: string,
  maxAgeMs = 10 * 60 * 1000
): { orgId: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(state, 'base64url').toString())
    const { orgId, timestamp, sig } = payload
    if (typeof orgId !== 'string' || typeof timestamp !== 'string' || typeof sig !== 'string') {
      return null
    }
    if (Date.now() - Number(timestamp) >= maxAgeMs) return null
    const hmac = createHmac('sha256', getSecret())
    hmac.update(`${orgId}:${timestamp}`)
    const expected = hmac.digest('hex')
    if (sig !== expected) return null
    return { orgId }
  } catch {
    return null
  }
}
