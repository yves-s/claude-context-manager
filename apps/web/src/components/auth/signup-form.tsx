// apps/web/src/components/auth/signup-form.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  invite?: string  // invite token from ?invite= URL param
}

export function SignupForm({ invite }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  // Build callback URL: if invite present, pass token so callback can accept it after email verify
  function callbackUrl(next?: string) {
    const params = new URLSearchParams()
    if (invite) params.set('invite', invite)
    if (next) params.set('next', next)
    const qs = params.toString()
    return `${location.origin}/auth/callback${qs ? '?' + qs : ''}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // emailRedirectTo carries the invite token so it survives the email verification click
        emailRedirectTo: callbackUrl(invite ? undefined : '/auth/create-org'),
      },
    })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
  }

  async function handleSSO(provider: 'google' | 'azure') {
    await supabase.auth.signInWithOAuth({
      provider: provider === 'azure' ? 'azure' : 'google',
      options: { redirectTo: callbackUrl(invite ? undefined : '/auth/create-org') },
    })
  }

  if (done) {
    return (
      <p className="text-sm text-center text-muted-foreground">
        Check your email — we sent a confirmation link.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="password">Password (min 8 chars)</Label>
        <Input id="password" type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>
      <Button type="button" variant="outline" onClick={() => handleSSO('google')}>Google</Button>
      <Button type="button" variant="outline" onClick={() => handleSSO('azure')}>Microsoft</Button>
    </form>
  )
}
