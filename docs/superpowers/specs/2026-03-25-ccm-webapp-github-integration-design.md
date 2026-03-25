# Design: CCM Web App — Subsystem 3: GitHub Integration

**Datum:** 2026-03-25
**Status:** Approved for implementation
**Produkt:** CCM SaaS Web App

## Kontext

Subsystem 2 (Dashboard + Repo Detail) ist implementiert und läuft mit Fixture-Daten. Dieses Spec beschreibt Subsystem 3: GitHub OAuth-Verbindung, automatischer Daten-Sync in Supabase (inkl. pgvector-Embeddings), und Ablösung der Fixture-Daten durch echte GitHub-Daten.

### Kernvision

CCM löst zwei fundamentale Probleme:

1. **Shared Context** — Claude Chat und Code können keine Dateien teilen. GitHub ist die Brücke.
2. **Inselwissen in Unternehmen** — Wenn Mitarbeiter gehen, geht das Wissen mit. CCM macht Claude zum Standard-Arbeitswerkzeug und bündelt Wissen automatisch. Man kann Claude fragen wer etwas weiß, wer etwas gemacht hat — ohne vorher zu wissen, an wen man sich wenden müsste.

**Kernprinzip:** Ease of Use. Non-Tech-People müssen CCM verstehen und einrichten können. Alles läuft automatisch im Hintergrund.

---

## Was sich ändert

| Bereich | Vorher | Nachher |
|---------|--------|---------|
| `getOrgData()` | Fixture-Daten | Liest aus Supabase |
| `getRepoData()` | Fixture-Daten | Liest aus Supabase |
| Settings-Seite | Members + Invite | + GitHub-Sektion |
| Supabase Schema | — | 3 neue Tabellen + pgvector |
| Sync | — | Edge Function, alle 30 Min |

---

## Settings-Seite: GitHub-Sektion

Neue Sektion unterhalb Team/Members. Nur sichtbar für owner/admin.

### Nicht verbunden

```
GitHub
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│  [GitHub Icon]                              │
│  GitHub noch nicht verbunden                │
│  Verbinde deine GitHub Organisation um      │
│  Repositories und Aktivität automatisch     │
│  zu synchronisieren.                        │
│                                             │
│  [    Mit GitHub verbinden →    ]           │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

### Verbunden

```
GitHub
┌─────────────────────────────────────────────┐
│ ● liebscher-bracht    GitHub Organisation   │
│─────────────────────────────────────────────│
│ 6 Repos synchronisiert  ·  Sync in 18 Min. │
│─────────────────────────────────────────────│
│ GitHub trennen                              │
└─────────────────────────────────────────────┘
```

Design: Mobile-first, single column.

---

## GitHub OAuth Flow

### Verbinden

1. User klickt "Mit GitHub verbinden →" auf Settings-Seite
2. `GET /api/github/connect` — redirect zu `https://github.com/login/oauth/authorize`
   - `client_id`, `scope=repo read:org`, `state=<orgId>`
3. GitHub redirectet zu `GET /api/github/callback?code=...&state=...`
4. Server exchanged Code gegen `access_token` via GitHub API
5. `access_token` und `github_org` werden in `organizations` gespeichert
6. Redirect zu `/{orgSlug}/settings`

### Trennen

Server Action `disconnectGitHub(orgId)`:
- Setzt `github_access_token = null`, `github_org = null` in `organizations`
- Löscht alle `synced_repos` (cascade löscht `repo_commits` + `repo_embeddings`)

### Berechtigungen

Nur `owner` und `admin` können GitHub verbinden/trennen.

---

## Datenbank-Schema

### Bestehende Tabelle: `organizations`

```sql
ALTER TABLE organizations ADD COLUMN github_access_token text;
-- github_org (text) existiert bereits
```

### Neue Tabelle: `synced_repos`

```sql
CREATE TABLE synced_repos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text NOT NULL,        -- lowercase repo name, = URL-Segment
  full_name       text NOT NULL,        -- "org/repo"
  has_claude_md   boolean DEFAULT false,
  context         text,                 -- CLAUDE.md Inhalt unterhalb <!-- PROJECT CONTEXT BELOW -->
  stack           text[],               -- extrahierte Tech-Keywords
  last_commit_at  timestamptz,
  synced_at       timestamptz DEFAULT now(),
  UNIQUE(organization_id, slug)
);
```

### Neue Tabelle: `repo_commits`

```sql
CREATE TABLE repo_commits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id       uuid REFERENCES synced_repos(id) ON DELETE CASCADE,
  commit_sha    text NOT NULL,
  author_name   text,
  author_email  text,
  message       text,
  files_changed int DEFAULT 0,
  committed_at  timestamptz NOT NULL,
  UNIQUE(repo_id, commit_sha)
);
```

Sessions in der UI = Commits. `sessionCount7d` = Anzahl Commits der letzten 7 Tage.

### Neue Tabelle: `repo_embeddings`

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE repo_embeddings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id    uuid REFERENCES synced_repos(id) ON DELETE CASCADE,
  content    text NOT NULL,       -- CLAUDE.md context-Abschnitt
  embedding  vector(1536),        -- OpenAI text-embedding-3-small
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX ON repo_embeddings USING ivfflat (embedding vector_cosine_ops);
```

---

## Sync: Edge Function

**Name:** `sync-github`
**Trigger:** Supabase `pg_cron` alle 30 Minuten

### Ablauf pro Org

```
1. Lade alle organizations mit github_access_token IS NOT NULL
2. Pro Org:
   a. GitHub API: repos der Org listen
   b. Pro Repo:
      - CLAUDE.md fetchen (GET /repos/{full_name}/contents/CLAUDE.md)
      - context extrahieren: Inhalt unterhalb <!-- PROJECT CONTEXT BELOW -->
      - stack extrahieren: ## Stack Sektion oder Keyword-Match
      - has_claude_md = true/false
      - synced_repos UPSERT
   c. Pro Repo: letzte 90 Tage Commits (GET /repos/{full_name}/commits)
      - repo_commits UPSERT (commit_sha als unique key)
      - last_commit_at = letzter Commit
   d. Pro Repo mit geändertem context:
      - Embedding generieren via OpenAI text-embedding-3-small
      - repo_embeddings UPSERT
```

### Stack-Extraktion

1. Suche `## Stack` oder `## Tech` Section in CLAUDE.md → extrahiere Zeilen
2. Fallback: Keyword-Match gegen bekannte Begriffe (Next.js, React, Supabase, TypeScript, etc.)

### Fehlerbehandlung

- Rate Limit GitHub API: exponential backoff, max 3 Versuche
- Repo nicht erreichbar (404/403): `synced_repos.synced_at` nicht aktualisieren, weiter mit nächstem Repo
- Kein `access_token` mehr gültig (401): `github_access_token = null` setzen (User muss neu verbinden)

---

## Data Layer

### `getOrgData(orgSlug): Promise<OrgData>`

```typescript
// Liest org aus DB
// Wenn !github_access_token → githubConnected: false, leere Arrays
// Sonst: liest synced_repos, repo_commits, organization_members aus Supabase
// Mappt auf OrgData Interface (unverändert aus Subsystem 2)
```

### `getRepoData(orgSlug, repoSlug): Promise<Repo | null>`

```typescript
// Liest einzelnen synced_repo aus DB
// Liest repo_commits für sessions[]
// Mappt auf Repo Interface (unverändert aus Subsystem 2)
// Gibt null zurück wenn nicht gefunden
```

**Wichtig:** Funktions-Signaturen sind identisch mit Subsystem 2. Nur der Body wird ersetzt.

---

## Nicht im Scope

- Semantic Search UI (pgvector-Suche über Embeddings) → Subsystem 4
- CLAUDE.md bearbeiten → Subsystem 4
- GitHub Webhooks (Real-time Sync) → späteres Subsystem
- Billing / Plan → später
