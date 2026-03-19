// apps/web/src/providers/org-provider.tsx
'use client'

import { createContext, useContext } from 'react'

interface OrgContextValue {
  orgId: string
  orgSlug: string
  orgName: string
  role: string
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: OrgContextValue
}) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside OrgProvider')
  return ctx
}
