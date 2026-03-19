# Design: CCM Web App — Subsystem 1: Auth + Multi-Tenant

**Datum:** 2026-03-19
**Status:** Pre-implementation spec — approved for implementation
**Produkt:** CCM SaaS Web App (claude-context-manager.io o.ä.)

## Kontext

CCM wird als SaaS Web App ausgebaut. Ziel: Unternehmen können Wissen zentralisieren, Team-Mitglieder verwalten und den Knowledge-Context über ein Web-Interface pflegen — ohne Notion, direkt verbunden mit dem Meta-Repo auf GitHub.

Dieses Spec deckt **Subsystem 1** ab: Authentication + Multi-Tenant Organisation Management. Es ist die Grundlage für alle weiteren Subsysteme.

## Stack

| Layer | Technologie |
|-------|-------------|
| Frontend / Full-Stack | Next.js 14 (App Router, Server Components, Server Actions) |
| Backend / Auth / DB | Supabase (PostgreSQL + Auth + RLS) |
| Deployment | Vercel |
| UI Komponenten | shadcn/ui (Tailwind CSS) |

## Datenmodell

### `organizations` (Tenant)
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
name        text NOT NULL
slug        text UNIQUE NOT NULL  -- für URL: /[org]/dashboard
github_org  text                  -- verknüpft via GitHub OAuth (Subsystem 3)
plan        text DEFAULT 'free'   -- free / pro (für späteres Billing)
created_at  timestamptz DEFAULT now()
```

### `organization_members`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE
user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE
role            text NOT NULL CHECK (role IN ('owner', 'admin', 'member'))
joined_at       timestamptz DEFAULT now()
UNIQUE (organization_id, user_id)
```

### `invitations`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()  -- = invite token
organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE
email           text          -- optional: vorausgefüllte E-Mail
role            text NOT NULL CHECK (role IN ('admin', 'member'))
invited_by      uuid REFERENCES auth.users(id)
expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days'
accepted_at     timestamptz  -- null = pending
```

## Rollen

| Rolle | Rechte |
|-------|--------|
| `owner` | Alles + Org löschen, Plan ändern |
| `admin` | Members einladen, Knowledge bearbeiten, GitHub verbinden |
| `member` | Knowledge lesen und bearbeiten |

## Row Level Security (RLS)

Alle Tabellen haben RLS aktiviert. Kein manuelles Tenant-Filtering im App-Code.

- `organizations`: User sieht nur Orgs, in denen er `organization_members` Eintrag hat
- `organization_members`: User sieht nur Members seiner eigenen Orgs
- `invitations`: User sieht nur Invites seiner eigenen Orgs (admin/owner)

**Sonderfall Invite-Token:** Ein User der `/invite/[token]` aufruft ist noch nicht eingeloggt. Die `invitations` Zeile muss vor der Auth gelesen werden. Lösung: `acceptInvite` Server Action verwendet den Supabase **Service Role Client** (serverseitig, nie im Browser), der RLS umgeht. Die Token-Validierung (existiert, nicht abgelaufen, nicht accepted) erfolgt damit sicher serverseitig — kein anon-Policy nötig.

## Auth Provider

Supabase Auth mit drei Providern:
- **Email + Passwort** (mit E-Mail-Verification)
- **Google OAuth** (SSO)
- **Microsoft OAuth** (SSO, Azure AD)

## Routes

```
/                          Landing / Marketing (public)
/auth/login                Login-Seite (Email + SSO Buttons)
/auth/signup               Signup + Org-Name Formular
/auth/callback             Supabase OAuth Callback
/invite/[token]            Invite-Link Landing Page
/[org]/dashboard           Haupt-Dashboard (protected)
/[org]/settings            Org Settings: Members, GitHub (protected, admin+)
```

## Auth Flows

### Flow 1: Neuer User — Org erstellen
1. Signup (Email oder SSO) → `auth.users` wird erstellt
2. Org-Name eingeben → `organizations` + `organization_members` (role: owner) erstellt
3. Redirect zu `/[org]/dashboard`
4. Onboarding: GitHub verbinden (optional, kann später)

### Flow 2: Invite-Link akzeptieren
1. User öffnet `/invite/[token]`
2. Token validieren: existiert, nicht abgelaufen, noch nicht accepted
3. Wenn nicht eingeloggt: Signup/Login (mit vorausgefüllter E-Mail wenn invite.email gesetzt)
4. Nach Auth: `accepted_at` setzen, `organization_members` Eintrag erstellen (Rolle aus Invite)
5. Redirect zu `/[org]/dashboard`

### Flow 3: Bestehender User — Login
1. Login (Email oder SSO)
2. Supabase Session
3. `organization_members` laden → aktive Org bestimmen:
   - Genau 1 Org: direkt zu `/[org]/dashboard`
   - Mehrere Orgs: zu `/select-org` (Org-Auswahl-Seite) — User wählt, Wahl wird in Cookie `ccm_last_org` gespeichert
   - 0 Orgs: zu `/auth/create-org` (Sonderfall: User ohne Org)
4. Org-Switcher im Header (wenn Multi-Org) liest/schreibt `ccm_last_org` Cookie

## Architektur-Komponenten

### `middleware.ts` (Vercel Edge)
- Prüft Supabase Session auf jeder `/[org]/*` Route
- Leitet zu `/auth/login` wenn keine Session
- Prüft Org-Membership (User in der Org?)
- Setzt `x-org-id` Header für Server Components

### `AuthProvider` (Client Component)
- Supabase `onAuthStateChange` Listener
- Session im React Context
- Wird in Root Layout gewrappt

### `OrgProvider` (Client Component)
- Aktive Org + Rolle im Context
- Org-Switcher wenn Multi-Org

### Server Actions
- `createOrganization(name)` → generiert slug (lowercase, Leerzeichen → Bindestrich, Kollision → `-2`, `-3` etc.), erstellt Org + Owner Member
- `acceptInvite(token)` → Service Role Client, validiert Token, erstellt Member, setzt `accepted_at`
- `createInvite(orgId, email?, role)` → erstellt Invitation (nur admin+)
- `revokeInvite(inviteId)` → setzt `accepted_at = now()` mit Sonderwert oder löscht Zeile (nur admin+)

### Middleware-Performance
`middleware.ts` prüft Org-Membership. Um DB-Round-Trips per Request zu vermeiden: Membership wird **nicht** per Request abgefragt, sondern im JWT Custom Claim (`org_roles: {orgId: role}`) gespeichert. Wird bei Org-Join/Leave neu ausgestellt. Middleware liest nur den JWT — kein DB-Call.

## Nicht im Scope dieses Subsystems

- GitHub OAuth Verbindung → Subsystem 3
- Knowledge Editor → Subsystem 4
- Dashboard Inhalt → Subsystem 5
- Billing / Plan-Upgrade → später
- Mac App / Observer → separates Produkt
