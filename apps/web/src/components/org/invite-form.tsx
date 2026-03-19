// apps/web/src/components/org/invite-form.tsx
'use client'

import { useState } from 'react'
import { createInvite } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props { orgId: string; baseUrl: string }

export function InviteForm({ orgId, baseUrl }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setLink(null)
    const result = await createInvite(orgId, role, email || undefined)
    if (result.error) { setError(result.error); setLoading(false); return }
    setLink(`${baseUrl}/invite/${result.token}`)
    setEmail('')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {link && (
        <div className="p-2 bg-muted rounded text-xs break-all">
          <span className="font-medium">Invite link: </span>{link}
        </div>
      )}
      <div className="flex gap-2 items-end">
        <div className="flex-1 grid gap-1">
          <Label htmlFor="invite-email">Email (optional)</Label>
          <Input id="invite-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@company.com" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            value={role}
            onChange={e => setRole(e.target.value as 'admin' | 'member')}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={loading}>Generate link</Button>
      </div>
    </form>
  )
}
