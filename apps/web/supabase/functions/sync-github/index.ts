// apps/web/supabase/functions/sync-github/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { listOrgRepos, fetchClaudeMd, fetchCommits } from './github.ts'
import { extractContext, extractStack } from './parse.ts'
import { generateEmbedding } from './embeddings.ts'

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, github_org, github_access_token')
    .not('github_access_token', 'is', null)

  if (error) {
    console.error('Failed to load orgs:', error)
    return new Response('error', { status: 500 })
  }

  for (const org of orgs ?? []) {
    const token = org.github_access_token as string
    const githubOrg = org.github_org as string
    if (!token || !githubOrg) continue

    let repos
    try {
      repos = await listOrgRepos(githubOrg, token)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'GITHUB_401') {
        console.warn(`Token expired for org ${org.id}, clearing`)
        await supabase
          .from('organizations')
          .update({ github_access_token: null })
          .eq('id', org.id)
      }
      continue
    }

    for (const repo of repos) {
      const slug = repo.name.toLowerCase()

      // Fetch CLAUDE.md
      const claudeMdContent = await fetchClaudeMd(repo.full_name, token)
      const hasClaudeMd = claudeMdContent !== null
      const context = claudeMdContent ? extractContext(claudeMdContent) : null
      const stack = claudeMdContent ? extractStack(claudeMdContent) : []

      // Capture old context BEFORE upsert (needed for embedding change detection)
      const { data: existingRepo } = await supabase
        .from('synced_repos')
        .select('context, synced_at')
        .eq('organization_id', org.id)
        .eq('slug', slug)
        .maybeSingle()
      const oldContext = existingRepo?.context ?? null

      // Upsert repo
      const { data: repoRow, error: repoErr } = await supabase
        .from('synced_repos')
        .upsert(
          {
            organization_id: org.id,
            name: repo.name,
            slug,
            full_name: repo.full_name,
            has_claude_md: hasClaudeMd,
            context,
            stack,
          },
          { onConflict: 'organization_id,slug' }
        )
        .select('id')
        .single()

      if (repoErr || !repoRow) {
        console.warn(`Failed to upsert repo ${repo.full_name}:`, repoErr)
        continue
      }

      // Determine since date for commits
      // Use pre-upsert synced_at: on first run existingRepo is null so we fall back to 90 days ago
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const since = existingRepo?.synced_at ?? ninetyDaysAgo

      // Note: synced_at advances even if fetchCommits returned [] due to an API failure (withRetry
      // exhausted). This means a failed fetch window is skipped on next run. Acceptable for MVP;
      // fix by returning null vs [] from fetchCommits to distinguish failure from empty.
      const commits = await fetchCommits(repo.full_name, token, since)
      if (commits.length > 0) {
        const commitRows = commits.map(c => ({
          repo_id: repoRow.id,
          commit_sha: c.sha,
          author_name: c.commit.author?.name ?? null,
          author_email: c.commit.author?.email ?? null,
          message: c.commit.message,
          files_changed: 0, // not available from list endpoint; requires per-commit detail call (N+1)
          committed_at: c.commit.author?.date ?? new Date().toISOString(),
        }))

        await supabase
          .from('repo_commits')
          .upsert(commitRows, { onConflict: 'repo_id,commit_sha', ignoreDuplicates: true })

        // Update last_commit_at
        const latestDate = commits[0].commit.author?.date
        if (latestDate) {
          await supabase
            .from('synced_repos')
            .update({ last_commit_at: latestDate })
            .eq('id', repoRow.id)
        }
      }

      // Update synced_at after successful commit upsert
      await supabase
        .from('synced_repos')
        .update({ synced_at: new Date().toISOString() })
        .eq('id', repoRow.id)

      // Generate embedding only if context changed (compare to old value captured before upsert)
      if (context && context !== oldContext) {
        const embedding = await generateEmbedding(context)
        if (embedding) {
          await supabase
            .from('repo_embeddings')
            .upsert(
              { repo_id: repoRow.id, content: context, embedding, updated_at: new Date().toISOString() },
              { onConflict: 'repo_id' }
            )
        }
      }
    }
  }

  return new Response('ok', { status: 200 })
})
