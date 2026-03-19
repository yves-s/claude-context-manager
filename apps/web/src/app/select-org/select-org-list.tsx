// apps/web/src/app/select-org/select-org-list.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Org { name: string; slug: string; role: string }

export function SelectOrgList({ orgs }: { orgs: Org[] }) {
  const router = useRouter()

  function selectOrg(slug: string) {
    document.cookie = `ccm_last_org=${slug}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    router.push(`/${slug}/dashboard`)
  }

  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      {orgs.map(org => (
        <Button key={org.slug} variant="outline" onClick={() => selectOrg(org.slug)}>
          <span className="flex-1 text-left">{org.name}</span>
          <span className="text-xs text-muted-foreground">{org.role}</span>
        </Button>
      ))}
    </div>
  )
}
