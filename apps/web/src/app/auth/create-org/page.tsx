// apps/web/src/app/auth/create-org/page.tsx
'use client'

import { useState } from 'react'
import { createOrganization } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'

export default function CreateOrgPage() {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await createOrganization(name)
    if (result.error) { setError(result.error); setLoading(false); return }
    router.push(`/${result.slug}/dashboard`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-semibold">Create your organisation</h1>
        <p className="text-sm text-muted-foreground">You can rename it later</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid gap-1">
          <Label htmlFor="name">Organisation name</Label>
          <Input id="name" value={name} onChange={e => setName(e.target.value)} required autoFocus />
        </div>
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? 'Creating…' : 'Create organisation'}
        </Button>
      </form>
    </main>
  )
}
