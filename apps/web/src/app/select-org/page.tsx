// apps/web/src/app/select-org/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SelectOrgList } from './select-org-list'

export default async function SelectOrgPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('role, organizations(id, name, slug)')
    .eq('user_id', user.id)

  if (!memberships?.length) redirect('/auth/create-org')
  if (memberships.length === 1) {
    const orgData = memberships[0].organizations
    const org = (Array.isArray(orgData) ? orgData[0] : orgData) as { slug: string }
    redirect(`/${org.slug}/dashboard`)
  }

  const orgs = memberships.map(m => {
    const orgData = m.organizations
    const o = (Array.isArray(orgData) ? orgData[0] : orgData) as { name: string; slug: string }
    return { name: o.name, slug: o.slug, role: m.role }
  })

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-2xl font-semibold">Select organisation</h1>
      <SelectOrgList orgs={orgs} />
    </main>
  )
}
