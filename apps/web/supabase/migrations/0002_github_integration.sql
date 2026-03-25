-- apps/web/supabase/migrations/0002_github_integration.sql

-- Add GitHub token to organizations
ALTER TABLE organizations ADD COLUMN github_access_token text;
-- Note: github_org column already exists from migration 0001

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Repos synced from GitHub
CREATE TABLE synced_repos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text NOT NULL,
  full_name       text NOT NULL,
  has_claude_md   boolean NOT NULL DEFAULT false,
  context         text,
  stack           text[],
  last_commit_at  timestamptz,
  synced_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- Commits (= Sessions in UI)
CREATE TABLE repo_commits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id       uuid NOT NULL REFERENCES synced_repos(id) ON DELETE CASCADE,
  commit_sha    text NOT NULL,
  author_name   text,
  author_email  text,
  message       text,
  files_changed integer NOT NULL DEFAULT 0,
  committed_at  timestamptz NOT NULL,
  UNIQUE(repo_id, commit_sha)
);

CREATE INDEX repo_commits_author_email_idx ON repo_commits (author_email);
CREATE INDEX repo_commits_committed_at_idx ON repo_commits (committed_at DESC);

-- Embeddings (pgvector)
CREATE TABLE repo_embeddings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id    uuid NOT NULL REFERENCES synced_repos(id) ON DELETE CASCADE,
  content    text NOT NULL,
  embedding  vector(1536),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(repo_id)
);

CREATE INDEX repo_embeddings_vector_idx ON repo_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX synced_repos_org_idx ON synced_repos (organization_id);

-- RLS: activate but no policies = deny all non-service-role access
ALTER TABLE synced_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_embeddings ENABLE ROW LEVEL SECURITY;
