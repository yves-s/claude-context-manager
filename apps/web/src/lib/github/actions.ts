'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

export async function disconnectGitHub(
  orgId: string,
  orgSlug: string
): Promise<{ error: string | null }> {
  // Verify authenticated user is owner/admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const service = createServiceClient()

  const { data: member } = await service
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!member || !['owner', 'admin'].includes(member.role as string)) {
    return { error: 'Forbidden' }
  }

  // Delete synced repos first (cascades to repo_commits + repo_embeddings)
  await service.from('synced_repos').delete().eq('organization_id', orgId)

  // Clear token
  // TODO: remove `as any` once Supabase types are regenerated after migration 0002
  const { error } = await service
    .from('organizations')
    .update({ github_access_token: null, github_org: null } as any)
    .eq('id', orgId)

  if (error) return { error: error.message }

  revalidatePath(`/${orgSlug}/settings`)
  return { error: null }
}
