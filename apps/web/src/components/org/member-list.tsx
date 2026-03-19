// apps/web/src/components/org/member-list.tsx
'use client'

import { Button } from '@/components/ui/button'
import { revokeInvite } from '@/lib/auth/actions'

interface Member {
  id: string
  email: string
  role: string
  joined_at: string
}

interface PendingInvite {
  id: string
  email: string | null
  role: string
  expires_at: string
}

interface Props {
  members: Member[]
  pendingInvites: PendingInvite[]
  canManage: boolean
}

export function MemberList({ members, pendingInvites, canManage }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="text-sm font-medium mb-2">Members ({members.length})</h3>
        <div className="border rounded divide-y">
          {members.map(m => (
            <div key={m.id} className="flex items-center px-3 py-2 gap-3">
              <span className="flex-1 text-sm">{m.email}</span>
              <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
            </div>
          ))}
        </div>
      </section>

      {canManage && pendingInvites.length > 0 && (
        <section>
          <h3 className="text-sm font-medium mb-2">Pending invites</h3>
          <div className="border rounded divide-y">
            {pendingInvites.map(inv => (
              <div key={inv.id} className="flex items-center px-3 py-2 gap-3">
                <span className="flex-1 text-sm text-muted-foreground">{inv.email ?? 'Any email'}</span>
                <span className="text-xs text-muted-foreground capitalize">{inv.role}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => { await revokeInvite(inv.id); location.reload() }}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
