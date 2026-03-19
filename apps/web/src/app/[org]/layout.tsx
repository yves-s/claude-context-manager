// apps/web/src/app/[org]/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { OrgProvider } from '@/providers/org-provider'
import { OrgSwitcher } from '@/components/org/org-switcher'

interface Props {
  children: React.ReactNode
  params: Promise<{ org: string }>
}

export default async function OrgLayout({ children, params }: Props) {
  await params  // params must be awaited in Next.js 15+ even if unused

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Middleware already validated membership and set these headers
  const headersList = await headers()
  const orgId = headersList.get('x-org-id')
  const orgRole = headersList.get('x-org-role')
  if (!orgId || !orgRole) redirect('/select-org')

  // Fetch org name (id already known from header — one lightweight query)
  const { data: org } = await supabase
    .from('organizations')
    .select('name, slug')
    .eq('id', orgId)
    .single()

  if (!org) redirect('/select-org')

  return (
    <OrgProvider value={{ orgId, orgSlug: org.slug, orgName: org.name, role: orgRole }}>
      <div className="min-h-screen flex flex-col">
        <header className="border-b px-4 py-3 flex items-center gap-4">
          <span className="font-semibold text-sm">CCM</span>
          <OrgSwitcher currentOrg={{ name: org.name, slug: org.slug }} userId={user.id} />
          <span className="ml-auto text-xs text-muted-foreground capitalize">{orgRole}</span>
        </header>
        <main className="flex-1 p-4">{children}</main>
      </div>
    </OrgProvider>
  )
}
