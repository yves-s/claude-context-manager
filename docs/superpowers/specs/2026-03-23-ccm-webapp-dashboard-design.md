# Design: CCM Web App — Subsystem 2: Dashboard + Repo Detail

**Datum:** 2026-03-23
**Status:** Approved for implementation
**Produkt:** CCM SaaS Web App

## Kontext

Subsystem 1 (Auth + Multi-Tenant) ist implementiert. Dieses Spec beschreibt Subsystem 2: die Dashboard- und Repo-Detail-Ansicht. Beide Views sind **read-only** — kein Editing in diesem Subsystem.

Datenbasis: GitHub API (meta-repo + sub-repos). Die tatsächliche GitHub-Anbindung (OAuth, API-Calls) ist Subsystem 3. Dieses Subsystem baut das UI mit sauberen Empty- und Loading-States via `Skeleton`-Components sowie statischen Fixture-Daten. Wenn GitHub in Subsystem 3 verbunden wird, füllen sich alle Views automatisch.

---

## Status-Level (einheitliche Definition)

Wird von Sidebar-Dots und Tabellen-Badges gleichermassen verwendet:

| Level | Farbe | Bedingung |
|-------|-------|-----------|
| `aktiv` | Grün | Session in den letzten 7 Tagen |
| `ruhig` | Gelb | Letzte Session vor 7–30 Tagen |
| `inaktiv` | Grau | Kein Sync seit > 30 Tagen |
| `kein Kontext` | Rot (outline) | Keine CLAUDE.md vorhanden |

---

## Layout-Migration

**In diesem Subsystem wird `src/app/[org]/layout.tsx` refactored.** Der bestehende einfache `<header>` wird durch die `shadcn/ui Sidebar` ersetzt. Die Sidebar wraps alle `/[org]/*`-Routen inklusive des bereits implementierten `/[org]/settings`.

---

## Routes

```
/[org]/dashboard            Übersicht (KPIs, Repo-Tabelle, Aktivität, Team)
/[org]/repos/[slug]         Repo-Detail (CLAUDE.md, Sessions, Contributors)
/[org]/settings             Unverändert (Subsystem 1)
```

---

## Navigation (Sidebar)

Verwendet `shadcn/ui Sidebar`. Gilt für alle `/[org]/*`-Routen.

```
CCM  ·  [Org-Name]                    [Owner-Badge]  [Avatar]

─ Übersicht
  Dashboard

─ Repos
  ● dashboard
  ● crm
  ○ website
  ○ ops

─ Team
  Members (→ /[org]/settings)

─ Einstellungen
  Settings (→ /[org]/settings)
```

Dot-Farben gemäss Status-Level-Tabelle oben. Aktiver Eintrag wird highlighted. Auf Mobile: Sidebar als `shadcn/ui Sheet` ausklappbar. `ScrollArea` wraps die Repo-Liste innerhalb der Sidebar für den Fall vieler Repos (> 10).

---

## Datenmodell (Frontend)

Alle Views arbeiten mit diesen Interfaces. Subsystem 3 implementiert die Datenquelle; dieses Subsystem definiert die Interfaces und beliefert sie mit Fixture-Daten.

```typescript
// Einstiegspunkt — Subsystem 3 ersetzt die Fixture-Implementierung
async function getOrgData(orgSlug: string): Promise<OrgData> { ... }
async function getRepoData(orgSlug: string, repoSlug: string): Promise<Repo> { ... }

// Fixture-Daten: src/lib/fixtures/org-data.ts

interface OrgData {
  repos: Repo[]
  members: Member[]
  recentActivity: ActivityEntry[]
  githubConnected: boolean
}

interface Repo {
  slug: string             // = GitHub-Repo-Name, lowercase (z.B. "dashboard")
  name: string             // = GitHub-Repo-Name (Anzeige)
  stack: string[]          // Technologie-Keywords aus CLAUDE.md (z.B. ["Next.js", "Supabase"])
  lastSyncAt?: Date
  sessionCount7d: number
  sessionCount7dPrevious: number   // Vorwoche — für Delta-Anzeige
  totalSessions: number
  hasClaudeMd: boolean
  context?: string         // CLAUDE.md Projektkontext-Abschnitt (unterhalb Marker)
  contributors: Contributor[]
  sessions: Session[]
}

interface Member {
  userId: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member'
  avatarUrl?: string
}

interface Contributor {
  userId: string
  name: string
  avatarUrl?: string
  sessionCount: number
  role?: 'owner' | 'admin' | 'member'
}

interface Session {
  id: string
  userId: string
  userName: string
  avatarUrl?: string
  filesChanged: number
  summary: string          // Aus Flush-Commit-Message
  createdAt: Date
}

interface ActivityEntry {
  sessionId: string
  userId: string
  userName: string
  avatarUrl?: string
  repoSlug: string
  repoName: string
  filesChanged: number
  createdAt: Date
}
```

**Slug-Ableitung:** `Repo.slug` = GitHub-Repo-Name, lowercase. Dient als URL-Segment in `/[org]/repos/[slug]`.

**Stack-Feld:** `stack` ist ein `string[]` von Technologie-Keywords die aus dem CLAUDE.md Kontext-Abschnitt extrahiert werden (durch Subsystem 3). In der Repo-Tabelle wird `stack.join(' / ')` angezeigt. Im Repo-Detail werden die Array-Einträge als einzelne Tag-Chips dargestellt. Fixture-Daten verwenden 2–4 Keywords pro Repo.

---

## Dashboard (`/[org]/dashboard`)

### KPI-Kacheln (4 Cards)

| Kachel | Wert | Subtext |
|--------|------|---------|
| Sub-Repos | `repos.length` | „via GitHub verbunden" |
| Sessions / Woche | `sum(repos[].sessionCount7d)` | „↑/↓ X ggü. Vorwoche" (aus `sessionCount7dPrevious`); `—` wenn `!githubConnected` |
| Team Members | `members.length` | „X Einladung(en) offen" (aus Supabase `invitations`) |
| Letztes Update | `recentActivity[0].createdAt` (relativ) | `recentActivity[0].repoName · recentActivity[0].userName` |

### Repo-Tabelle

`shadcn/ui Table`. Spalten: Name (mit Status-Dot), Stack, Sessions (7d), Zuletzt, Status-Badge.

Status gemäss Status-Level-Tabelle. Klick auf Tabellenzeile → navigiert zu `/[org]/repos/[slug]`.

### Aktivitäts-Feed (rechte Spalte, oben)

Chronologisch sortierte `recentActivity`-Einträge. Pro Eintrag: `Avatar` (Initiale aus `userName`), Name, Repo-Name, Anzahl `filesChanged`, relativer Zeitstempel.

### Team-Panel (rechte Spalte, unten)

`members`-Array: Avatar, Name, Rolle-Badge.

### Empty State (GitHub nicht verbunden, `!githubConnected`)

```
[Icon: GitHub]
GitHub verbinden um Repositories und Aktivität zu sehen.
[GitHub verbinden →]   (→ /[org]/settings#github)
```

KPI-Kacheln zeigen `—`. Repo-Tabelle zeigt 4 `Skeleton`-Rows. Aktivitäts-Feed und Team-Panel zeigen `Skeleton`-Einträge.

---

## Repo-Detail (`/[org]/repos/[slug]`)

### Header

`repo.name` (h1), Stack-Badges (ein Badge pro `stack[]`-Eintrag), Status-Badge, `{repo.totalSessions} Sessions · zuletzt {repo.lastSyncAt}` (rechts).

### CLAUDE.md Kontext-Block

Monospace-Block mit `repo.context`. Darunter: `repo.stack[]` als Tag-Chips.

Subtext: „Zuletzt gesynct: {repo.lastSyncAt} · via GitHub Action"

**Empty State — kein Kontext (`!repo.hasClaudeMd`):**
```
Diese Repository hat noch keine CLAUDE.md.
ccm add  im Projektordner ausführen um CCM einzurichten.
```

**Empty State — GitHub nicht verbunden:**
```
GitHub verbinden um den Kontext dieses Repos zu sehen.
[GitHub verbinden →]
```
Sessions-Tabelle und Contributors-Panel zeigen in beiden Fällen `Skeleton`-Rows.

### Sessions-Tabelle

`shadcn/ui Table`. Spalten: User (Avatar + Name), Dateien, Zusammenfassung, Zeit.

Datenquelle: `repo.sessions`, chronologisch sortiert.

### Contributors-Panel (rechte Spalte, oben)

Pro Eintrag: Avatar, Name, Session-Anzahl (`contributor.sessionCount`), Rolle-Badge.

### Meta-Repo Info (rechte Spalte, unten)

Info-Card mit: GitHub Org, Meta-Repo-Name, Sync-Status-Badge.

---

## Fixture-Daten

Datei: `src/lib/fixtures/org-data.ts`

Exportiert eine `OrgData`-Instanz mit:
- 4–6 Repos (Mix aus aktiv/ruhig, mit/ohne CLAUDE.md)
- 3–4 Members
- 8–10 ActivityEntries
- `githubConnected: false` (Standard) — per env-Flag auf `true` setzbar für Design-Reviews

---

## Komponenten

| Component | Verwendung |
|-----------|------------|
| `Sidebar` | Haupt-Navigation |
| `Table` | Repo-Liste, Sessions |
| `Badge` | Status, Rollen, Stack |
| `Avatar` | User in Feeds und Panels |
| `Skeleton` | Loading- und Empty-States |
| `Sheet` | Mobile Sidebar |
| `Card` | KPI-Kacheln |
| `Separator` | Sidebar-Sections |
| `ScrollArea` | Repo-Liste in Sidebar (> 10 Repos) |

---

## Nicht im Scope dieses Subsystems

- GitHub OAuth und tatsächliche API-Calls → Subsystem 3
- CLAUDE.md bearbeiten → Subsystem 4
- Billing / Plan → später
- Notifications / Real-time Updates → später
