# Design: CCM Web App — Subsystem 3: GitHub Integration

**Datum:** 2026-03-25
**Status:** Approved for implementation
**Produkt:** CCM SaaS Web App

## Kontext

Subsystem 2 (Dashboard + Repo Detail) ist implementiert und läuft mit Fixture-Daten. Dieses Spec beschreibt Subsystem 3: GitHub OAuth-Verbindung, automatischer Daten-Sync in Supabase (inkl. pgvector-Embeddings), und Ablösung der Fixture-Daten durch echte GitHub-Daten.

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

Neue Sektion unterhalb Team/Members. Nur sichtbar für owner/admin — enforced client-seitig (conditional render) UND server-seitig (Route Handler prüft `x-org-role` Header).

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

**Implementierung:** GitHub OAuth App (nicht GitHub App). Kein App-Install nötig — User autorisiert einmalig. Scope: `repo read:org`.

**Einschränkung:** Das gespeicherte Token ist an den verbindenden User gebunden. Wenn dieser User sein GitHub-Token widerruft, schlägt der nächste Sync mit 401 fehl → Token wird automatisch invalidiert. Ein anderer Admin muss dann neu verbinden.

### Verbinden

1. User klickt "Mit GitHub verbinden →" auf Settings-Seite
2. `GET /api/github/connect` (Route Handler) — prüft `x-org-role` (nur owner/admin), generiert einen unguessable `state`-Token (HMAC von orgId + Timestamp, gespeichert in einem kurzlebigen Cookie), dann redirect zu `https://github.com/login/oauth/authorize` mit `client_id`, `scope=repo read:org`, `state`
3. GitHub redirectet zu `GET /api/github/callback?code=...&state=...`
4. Server verifiziert `state` gegen Cookie (CSRF-Schutz), dann: Code → `access_token` via `POST https://github.com/login/oauth/access_token`
5. `GET /user/orgs` → erste GitHub Org des Users = `github_org`
6. `access_token` + `github_org` in `organizations` speichern (Supabase Service Role Client)
7. Redirect zu `/{orgSlug}/settings`

**Fehlerfall** (verweigerte Auth, ungültiger State, Token-Exchange-Fehler): Redirect zu `/{orgSlug}/settings?github_error=true` — Settings-Seite zeigt Toast.

### Trennen

Server Action `disconnectGitHub(orgId)` — Supabase **Service Role Client**:
1. Prüft Rolle des aufrufenden Users (owner/admin)
2. Löscht explizit alle `synced_repos` WHERE `organization_id = orgId` (cascadiert `repo_commits` + `repo_embeddings`)
3. Setzt `github_access_token = null`, `github_org = null` in `organizations`

### Token-Sicherheit

`github_access_token` als `text` in `organizations`. RLS schützt die Tabelle; Token wird ausschließlich serverseitig via Service Role Client oder Route Handler gelesen/geschrieben — nie via PostgREST vom Browser.

> **Hinweis zur Credential-Policy:** Das CLAUDE.md-Prinzip "Keine Secrets in Dateien speichern" bezieht sich auf Konfigurations-Dateien im Repository. OAuth-Tokens in einer PostgreSQL-Datenbank mit RLS-Schutz zu speichern ist Standard-SaaS-Praxis und kein Verstoß gegen diese Policy. Token-Verschlüsselung via Supabase Vault als weiteres Security-Hardening vor Production-Launch.

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
  name            text NOT NULL,      -- GitHub repo name (z.B. "dashboard")
  slug            text NOT NULL,      -- = name, lowercase (z.B. "dashboard"), URL-Segment
  full_name       text NOT NULL,      -- "org/repo" (z.B. "liebscher-bracht/dashboard")
  has_claude_md   boolean DEFAULT false, -- true wenn CLAUDE.md im Repo existiert (HTTP 200)
  context         text,               -- text: Inhalt unterhalb <!-- PROJECT CONTEXT BELOW --> wenn Marker vorhanden; sonst gesamter CLAUDE.md-Inhalt; null wenn has_claude_md=false
  stack           text[],             -- text[]: extrahierte Tech-Keywords, lowercase, max 10 Einträge
  last_commit_at  timestamptz,
  synced_at       timestamptz DEFAULT now(),
  UNIQUE(organization_id, slug)
);
```

`slug` = GitHub `name` des Repos, lowercase. GitHub repo names enthalten keine Leerzeichen, daher keine weitere Transformation nötig.

### Neue Tabelle: `repo_commits`

```sql
CREATE TABLE repo_commits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id       uuid REFERENCES synced_repos(id) ON DELETE CASCADE,
  commit_sha    text NOT NULL,
  author_name   text,
  author_email  text,
  message       text,
  files_changed integer DEFAULT 0,  -- Anzahl geänderter Dateien; MVP: immer 0 (Detail-API-Call zu teuer), spätere Iteration
  committed_at  timestamptz NOT NULL,
  UNIQUE(repo_id, commit_sha)
);

-- Performance: Email-Lookup für Sessions-Mapping
CREATE INDEX repo_commits_author_email_idx ON repo_commits (author_email);
```

### Neue Tabelle: `repo_embeddings`

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE repo_embeddings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id    uuid REFERENCES synced_repos(id) ON DELETE CASCADE,
  content    text NOT NULL,     -- = synced_repos.context zum Zeitpunkt des Embeddings
  embedding  vector(1536),      -- OpenAI text-embedding-3-small
  updated_at timestamptz DEFAULT now(),
  UNIQUE(repo_id)               -- ein Embedding pro Repo
);

-- hnsw statt ivfflat: kein Mindest-Rowcount, besser für kleine Datasets
CREATE INDEX ON repo_embeddings USING hnsw (embedding vector_cosine_ops);
```

`content` ist eine Kopie von `synced_repos.context` — gespeichert damit das Embedding seinen Ursprungstext bei sich hat. Wird immer gemeinsam mit dem Embedding aktualisiert (kein Inkonsistenz-Risiko im Sync-Pfad).

**Embedding-Einheit:** 1 Embedding pro Repo. Text > 8192 Tokens → auf 8192 Tokens kürzen (Limit von `text-embedding-3-small`).

---

## Sync: Edge Function

**Name:** `sync-github`

**Trigger:** `pg_cron` + `pg_net` — wird in der Supabase SQL-Konsole eingerichtet:

```sql
-- pg_cron job erstellen (einmalig via SQL Editor)
SELECT cron.schedule(
  'sync-github-every-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/sync-github',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

`SERVICE_ROLE_KEY` wird als Supabase Database Secret (`app.settings.service_role_key`) gespeichert und im SQL via `current_setting('app.settings.service_role_key')` referenziert. Die Edge Function URL und der Key werden nicht hardcodiert.

### Ablauf

```
1. Alle organizations mit github_access_token IS NOT NULL laden
2. Pro Org:
   a. GET /orgs/{github_org}/repos → repos listen
   b. Pro Repo:
      - GET /repos/{full_name}/contents/CLAUDE.md
        → 200: has_claude_md=true, context extrahieren
        → 404: has_claude_md=false, context=null
      - stack extrahieren (s.u.)
      - synced_repos UPSERT (ON CONFLICT organization_id, slug → UPDATE)
   c. Pro Repo:
      - Erster Sync: since = 90 Tage zurück
      - Folge-Sync: since = synced_repos.synced_at (letzter Sync-Zeitpunkt)
      - GET /repos/{full_name}/commits?since=<timestamp>
      - repo_commits UPSERT (ON CONFLICT repo_id, commit_sha → NOTHING)
      - last_commit_at = neuester committed_at
      - `synced_at` wird erst nach erfolgreichem UPSERT gesetzt (verhindert verlorene Commits bei Teilfehler)
   d. Pro Repo wo context sich geändert hat:
      - Embedding via OpenAI text-embedding-3-small generieren
      - repo_embeddings UPSERT (ON CONFLICT repo_id → UPDATE)
```

### Stack-Extraktion

Quelle: ausschließlich CLAUDE.md-Text. Kein LLM-Call, keine `package.json`-Analyse.

1. Suche `## Stack` oder `## Tech` Section in CLAUDE.md → extrahiere Werte aus Bullet-Points (`- Next.js`) oder Tabellen-Zeilen (`| Next.js | ...`)
2. Fallback (keine solche Section): Keyword-Match auf gesamten CLAUDE.md-Text gegen feste Begriffsliste (Next.js, React, Vue, Angular, Svelte, Supabase, PostgreSQL, MySQL, TypeScript, JavaScript, Python, Go, Rust, Swift, Kotlin, Docker, etc.)
3. Ergebnis: `string[]`, lowercase, max 10 Einträge, Duplikate entfernt

### Fehlerbehandlung

| Fehler | Verhalten |
|--------|-----------|
| GitHub 429 | Exponential backoff, max 3 Versuche |
| GitHub 404/403 (Repo) | Skip Repo, weiter mit nächstem |
| GitHub 401 (Org) | `github_access_token = null` setzen → `githubConnected: false` |
| OpenAI 429 | Skip Embedding für diesen Zyklus, retry beim nächsten Sync |
| OpenAI Error | Skip Embedding für diesen Zyklus, context bleibt ohne Embedding |

---

## Data Layer

### Sessions-Mapping

`Session` Interface (unverändert aus Subsystem 2) wird aus `repo_commits` befüllt:

| Session-Feld | Quelle |
|---|---|
| `id` | `repo_commits.id` |
| `summary` | `repo_commits.message` |
| `filesChanged` | `repo_commits.files_changed` |
| `createdAt` | `repo_commits.committed_at` |
| `userId` | `organization_members.user_id` via `author_email` Matching — `null` wenn kein Match |
| `userName` | `organization_members` via Match, Fallback: `repo_commits.author_name` |
| `avatarUrl` | `organization_members.avatarUrl` via Match, Fallback: `null` |

**Session-Definition:** 1 Commit = 1 Session. Keine Gruppierung nach Zeitfenster oder Autor.

`sessionCount7d` = Anzahl `repo_commits` mit `committed_at > now() - 7 days`
`sessionCount7dPrevious` = Anzahl mit `committed_at BETWEEN now()-14d AND now()-7d`
`totalSessions` = Gesamtanzahl `repo_commits`

### ActivityEntry-Mapping

`ActivityEntry` Interface (unverändert aus Subsystem 2) wird aus den neuesten `repo_commits` über alle Repos einer Org befüllt:

| ActivityEntry-Feld | Quelle |
|---|---|
| `sessionId` | `repo_commits.id` |
| `userId` | via `author_email` Matching, Fallback: `null` |
| `userName` | via Match, Fallback: `repo_commits.author_name` |
| `avatarUrl` | via Match, Fallback: `null` |
| `repoSlug` | `synced_repos.slug` |
| `repoName` | `synced_repos.name` |
| `filesChanged` | `repo_commits.files_changed` |
| `createdAt` | `repo_commits.committed_at` |

`getOrgData` lädt die 20 neuesten Commits über alle Repos als `recentActivity`.

### `getOrgData(orgSlug): Promise<OrgData>`

```typescript
// 1. Org aus DB laden (inkl. github_access_token check)
// 2. Wenn kein Token: { repos: [], members: [...], recentActivity: [], githubConnected: false }
// 3. Sonst:
//    - synced_repos + repo_commits (letzte 14d) aus Supabase
//    - organization_members für Member-Liste + email-Mapping
//    - 20 neueste commits über alle repos für recentActivity
// 4. Auf OrgData Interface mappen
// Funktions-Signatur unverändert aus Subsystem 2
```

### `getRepoData(orgSlug, repoSlug): Promise<Repo | null>`

```typescript
// 1. synced_repo für org + slug laden
// 2. null zurückgeben wenn nicht gefunden
// 3. repo_commits für sessions[] laden (neueste 50)
// 4. Auf Repo Interface mappen
// Funktions-Signatur unverändert aus Subsystem 2
```

---

## RLS Policies (neue Tabellen)

`synced_repos`, `repo_commits`, `repo_embeddings` sind nur über den **Service Role Client** zugänglich — kein direkter PostgREST-Zugriff von Browser-Code. Alle Lese-Operationen laufen über Server Components via Service Role.

```sql
-- Keine anon/authenticated Policies auf diesen Tabellen
-- (Row-Level Security aktiviert, aber keine SELECT-Policy → implizit deny für alle Rollen außer service_role)
ALTER TABLE synced_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_embeddings ENABLE ROW LEVEL SECURITY;
```

## Setup-Schritte (einmalig)

1. GitHub OAuth App registrieren: `https://github.com/settings/developers` → Callback URL: `https://<domain>/api/github/callback` (+ `http://localhost:3000/api/github/callback` für local dev)
2. Env vars setzen: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
3. Supabase: `pg_net` Extension aktivieren, `pg_cron` Extension aktivieren
4. DB Secret für Service Role Key: `ALTER DATABASE postgres SET app.settings.service_role_key = '...'`
5. Cron-Job SQL ausführen (s. Sync-Sektion)
6. Edge Function `sync-github` deployen mit Secret `OPENAI_API_KEY`

## Nicht im Scope

- Semantic Search UI (pgvector-Suche über Embeddings) → Subsystem 4
- CLAUDE.md bearbeiten → Subsystem 4
- GitHub Webhooks (Real-time Sync) → späteres Subsystem
- Token-Verschlüsselung via Supabase Vault → Security-Hardening vor Production
- Billing / Plan → später
