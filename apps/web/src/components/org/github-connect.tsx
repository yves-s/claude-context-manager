'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { disconnectGitHub } from '@/lib/github/actions'

interface Props {
  orgId: string
  orgSlug: string
  githubOrg: string | null
  repoCount?: number
}

export function GithubConnect({ orgId, orgSlug, githubOrg, repoCount = 0 }: Props) {
  const searchParams = useSearchParams()
  const hasError = searchParams.get('github_error') === 'true'
  const [isPending, startTransition] = useTransition()
  const [disconnectError, setDisconnectError] = useState<string | null>(null)

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectGitHub(orgId, orgSlug)
      if (result.error) setDisconnectError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {hasError && (
        <p className="text-sm text-destructive">
          GitHub-Verbindung fehlgeschlagen. Bitte versuche es erneut.
        </p>
      )}

      {githubOrg ? (
        <div className="border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{githubOrg}</p>
              <p className="text-xs text-muted-foreground">GitHub Organisation</p>
            </div>
          </div>
          {repoCount > 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-b">
              {repoCount} {repoCount === 1 ? 'Repository' : 'Repositories'} synchronisiert
            </div>
          )}
          <div className="px-4 py-2">
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isPending}
              className="text-xs text-destructive hover:underline disabled:opacity-50"
            >
              {isPending ? 'Wird getrennt…' : 'GitHub trennen'}
            </button>
            {disconnectError && (
              <p className="text-xs text-destructive mt-1">{disconnectError}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-xl p-6 text-center">
          <svg
            className="w-7 h-7 text-muted-foreground mx-auto mb-3"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          <p className="text-sm font-medium mb-1">GitHub noch nicht verbunden</p>
          <p className="text-xs text-muted-foreground mb-4">
            Verbinde deine GitHub Organisation um Repositories und Aktivität automatisch zu synchronisieren.
          </p>
          <a
            href={`/api/github/connect?orgId=${orgId}`}
            className="inline-flex items-center justify-center w-full rounded-lg bg-foreground text-background text-sm font-medium py-2.5 px-4 hover:opacity-90 transition-opacity"
          >
            Mit GitHub verbinden →
          </a>
        </div>
      )}
    </div>
  )
}
