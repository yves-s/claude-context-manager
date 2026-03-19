// apps/web/src/app/[org]/settings/page.tsx
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { MemberList } from '@/components/org/member-list'
import { InviteForm } from '@/components/org/invite-form'

interface Props { params: Promise<{ org: string }> }

export default async function SettingsPage({ params }: Props) {
  await params  // required in Next.js 15+

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Read org from middleware-injected headers (consistent with OrgLayout)
  const headersList = await headers()
  const orgId = headersList.get('x-org-id')
  const orgRole = headersList.get('x-org-role')
  if (!orgId || !orgRole) redirect('/select-org')

  const canManage = ['owner', 'admin'].includes(orgRole)

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single()
  if (!org) redirect('/select-org')

  // Fetch members (id, user_id, role, joined_at)
  const { data: membersRaw } = await supabase
    .from('organization_members')
    .select('id, user_id, role, joined_at')
    .eq('organization_id', orgId)

  // Resolve user emails via service client (auth.users is not accessible via PostgREST)
  const service = createServiceClient()
  const userIds = (membersRaw ?? []).map(m => m.user_id as string)
  const userResults = await Promise.all(
    userIds.map(id => service.auth.admin.getUserById(id))
  )
  const userMap = new Map(
    userResults
      .filter(r => r.data.user != null)
      .map(r => [r.data.user!.id, r.data.user!.email ?? '—'])
  )

  const members = (membersRaw ?? []).map(m => ({
    id: m.id as string,
    email: userMap.get(m.user_id as string) ?? '—',
    role: m.role as string,
    joined_at: m.joined_at as string,
  }))

  // Fetch pending invites (only for admins/owners)
  const pendingInvites = canManage
    ? await supabase
        .from('invitations')
        .select('id, email, role, expires_at')
        .eq('organization_id', orgId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .then(({ data }) => data ?? [])
    : []

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">{org.name}</p>
      </div>

      {canManage && (
        <section>
          <h2 className="text-base font-medium mb-3">Invite team members</h2>
          <InviteForm orgId={orgId} baseUrl={baseUrl} />
        </section>
      )}

      <section>
        <MemberList
          members={members}
          pendingInvites={pendingInvites}
          canManage={canManage}
        />
      </section>
    </div>
  )
}
