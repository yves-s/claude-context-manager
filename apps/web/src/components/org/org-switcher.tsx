// apps/web/src/components/org/org-switcher.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  currentOrg: { name: string; slug: string }
  userId: string
}

export function OrgSwitcher({ currentOrg, userId }: Props) {
  const [orgs, setOrgs] = useState<{ name: string; slug: string }[]>([])
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('organization_members')
      .select('organizations(name, slug)')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (data) {
          setOrgs(
            data.flatMap(m => {
              const o = m.organizations
              return Array.isArray(o) ? o : o ? [o] : []
            }) as { name: string; slug: string }[]
          )
        }
      })
  }, [userId])

  function switchOrg(slug: string) {
    document.cookie = `ccm_last_org=${slug}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    router.push(`/${slug}/dashboard`)
  }

  if (orgs.length <= 1) {
    return <span className="text-sm font-medium">{currentOrg.name}</span>
  }

  return (
    <div className="relative group">
      <button className="text-sm font-medium hover:underline">{currentOrg.name} ▾</button>
      <div className="hidden group-hover:flex absolute top-full left-0 mt-1 flex-col bg-popover border rounded shadow-md min-w-40 z-10">
        {orgs.filter(o => o.slug !== currentOrg.slug).map(o => (
          <button
            key={o.slug}
            onClick={() => switchOrg(o.slug)}
            className="px-3 py-2 text-sm hover:bg-accent text-left"
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  )
}
