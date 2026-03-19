// apps/web/src/app/auth/signup/page.tsx
import { SignupForm } from '@/components/auth/signup-form'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ invite?: string }>
}

export default async function SignupPage({ searchParams }: Props) {
  const { invite } = await searchParams
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="underline">Sign in</Link>
        </p>
      </div>
      <SignupForm invite={invite} />
    </main>
  )
}
