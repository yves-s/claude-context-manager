// apps/web/src/lib/auth/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// --- Helpers ---

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function getUniqueSlug(base: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  let slug = base
  let suffix = 2
  while (true) {
    const { data } = await supabase.from('organizations').select('id').eq('slug', slug).single()
    if (!data) return slug
    slug = `${base}-${suffix++}`
  }
}

// --- Server Actions ---

export async function createOrganization(
  name: string
): Promise<{ slug: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { slug: null, error: 'Not authenticated' }

  const baseSlug = generateSlug(name)
  const slug = await getUniqueSlug(baseSlug, supabase)

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name, slug })
    .select('id, slug')
    .single()

  if (orgError || !org) return { slug: null, error: orgError?.message ?? 'Failed to create org' }

  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({ organization_id: org.id, user_id: user.id, role: 'owner' })

  if (memberError) return { slug: null, error: memberError.message }

  return { slug: org.slug, error: null }
}

export async function acceptInvite(
  token: string,
  userId: string
): Promise<{ orgSlug: string | null; error: string | null }> {
  const service = createServiceClient()

  const { data: invite, error } = await service
    .from('invitations')
    .select('id, organization_id, role, expires_at, accepted_at, organizations(slug)')
    .eq('id', token)
    .single()

  if (error || !invite) return { orgSlug: null, error: 'Invite not found' }
  if (invite.accepted_at) return { orgSlug: null, error: 'Invite already used' }
  if (new Date(invite.expires_at) < new Date()) return { orgSlug: null, error: 'Invite expired' }

  const { error: memberError } = await service
    .from('organization_members')
    .insert({ organization_id: invite.organization_id, user_id: userId, role: invite.role })

  // If already a member (duplicate), that's fine — still mark invite accepted
  if (memberError && !memberError.message.includes('duplicate')) {
    return { orgSlug: null, error: memberError.message }
  }

  await service
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', token)

  const orgData = invite.organizations
  const org = (Array.isArray(orgData) ? orgData[0] : orgData) as { slug: string } | null
  return { orgSlug: org?.slug ?? null, error: null }
}

export async function createInvite(
  orgId: string,
  role: 'admin' | 'member',
  email?: string
): Promise<{ token: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { token: null, error: 'Not authenticated' }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { token: null, error: 'Insufficient permissions' }
  }

  const { data: invite, error } = await supabase
    .from('invitations')
    .insert({ organization_id: orgId, role, email: email ?? null, invited_by: user.id })
    .select('id')
    .single()

  if (error || !invite) return { token: null, error: error?.message ?? 'Failed to create invite' }
  return { token: invite.id, error: null }
}

export async function revokeInvite(
  inviteId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', inviteId)

  return { error: error?.message ?? null }
}
