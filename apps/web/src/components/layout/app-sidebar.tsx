'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { StatusDot } from '@/components/shared/status-dot'
import { repoStatus } from '@/lib/data/status'
import type { Repo } from '@/lib/data/types'

interface Props {
  orgSlug: string
  orgName: string
  role: string
  repos: Repo[]
}

export function AppSidebar({ orgSlug, orgName, role, repos }: Props) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">CCM</span>
            <span className="text-muted-foreground text-sm">·</span>
            <span className="font-medium text-sm truncate max-w-32">{orgName}</span>
          </div>
          <Badge variant="outline" className="text-xs capitalize shrink-0">{role}</Badge>
        </div>
      </SidebarHeader>

      <Separator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Übersicht</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === `/${orgSlug}/dashboard`}>
                <Link href={`/${orgSlug}/dashboard`}>Dashboard</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Repos</SidebarGroupLabel>
          <ScrollArea className={repos.length > 10 ? 'h-64' : undefined}>
            <SidebarMenu>
              {repos.map(repo => {
                const status = repoStatus(repo)
                return (
                  <SidebarMenuItem key={repo.slug}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/${orgSlug}/repos/${repo.slug}`}
                    >
                      <Link href={`/${orgSlug}/repos/${repo.slug}`} className="flex items-center gap-2">
                        <StatusDot status={status} />
                        <span>{repo.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </ScrollArea>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Team</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href={`/${orgSlug}/settings`}>Members</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Einstellungen</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === `/${orgSlug}/settings`}>
                <Link href={`/${orgSlug}/settings`}>Settings</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
