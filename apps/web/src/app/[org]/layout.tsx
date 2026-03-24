// apps/web/src/app/[org]/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { OrgProvider } from '@/providers/org-provider'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { getOrgData } from '@/lib/data/org'
import { Separator } from '@/components/ui/separator'

interface Props {
  children: React.ReactNode
  params: Promise<{ org: string }>
}

export default async function OrgLayout({ children, params }: Props) {
  const { org: orgSlug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const headersList = await headers()
  const orgId = headersList.get('x-org-id')
  const orgRole = headersList.get('x-org-role')
  if (!orgId || !orgRole) redirect('/select-org')

  const { data: org } = await supabase
    .from('organizations')
    .select('name, slug')
    .eq('id', orgId)
    .single()
  if (!org) redirect('/select-org')

  const orgData = await getOrgData(orgSlug)

  return (
    <OrgProvider value={{ orgId, orgSlug: org.slug, orgName: org.name, role: orgRole }}>
      <SidebarProvider>
        <AppSidebar
          orgSlug={org.slug}
          orgName={org.name}
          role={orgRole}
          repos={orgData.repos}
        />
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 px-4 border-b">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </OrgProvider>
  )
}
