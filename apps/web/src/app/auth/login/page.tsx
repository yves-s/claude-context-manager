// apps/web/src/app/auth/login/page.tsx
import { LoginForm } from '@/components/auth/login-form'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ redirectTo?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { redirectTo } = await searchParams
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-semibold">Sign in to CCM</h1>
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="underline">Sign up</Link>
        </p>
      </div>
      <LoginForm redirectTo={redirectTo} />
    </main>
  )
}
