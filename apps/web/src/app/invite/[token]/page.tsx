// apps/web/src/app/invite/[token]/page.tsx
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { acceptInvite } from '@/lib/auth/actions'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const service = createServiceClient()

  // Validate token (service role bypasses RLS — user may not be authenticated yet)
  const { data: invite } = await service
    .from('invitations')
    .select('id, email, role, expires_at, accepted_at, organizations(name, slug)')
    .eq('id', token)
    .single()

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">This invite link is invalid or has expired.</p>
      </main>
    )
  }

  if (invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">This invite link has already been used or expired.</p>
      </main>
    )
  }

  const orgData = invite.organizations
  const org = (Array.isArray(orgData) ? orgData[0] : orgData) as { name: string; slug: string } | null

  // Check if user is already logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Auto-accept and redirect
    const result = await acceptInvite(token, user.id)
    if (!result.error && result.orgSlug) {
      redirect(`/${result.orgSlug}/dashboard`)
    }
  }

  // Not logged in — show invite info and login/signup links
  const signupHref = `/auth/signup?invite=${token}${invite.email ? `&email=${encodeURIComponent(invite.email)}` : ''}`
  const loginHref = `/auth/login?invite=${token}`

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">You&apos;re invited!</h1>
        <p className="text-muted-foreground">
          Join <strong>{org?.name}</strong> on CCM as <strong>{invite.role}</strong>
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild><Link href={signupHref}>Create account</Link></Button>
        <Button variant="outline" asChild><Link href={loginHref}>Sign in</Link></Button>
      </div>
    </main>
  )
}
