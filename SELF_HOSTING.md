# Self-Hosting Guide

Claude Context Manager is designed to be self-hosted. Each team runs their own instance — you bring your own Supabase project and deploy the webapp wherever you like.

## Prerequisites

- [Supabase](https://supabase.com) account (free tier works)
- [Vercel](https://vercel.com) account (or any Node.js host)
- GitHub account (to create an OAuth App)
- Node.js 18+

---

## 1. Supabase Setup

### Create a project

Go to [supabase.com](https://supabase.com), create a new project, and note your:
- **Project URL** (`https://<ref>.supabase.co`)
- **Anon key** (Settings → API → Project API keys → anon)
- **Service role key** (Settings → API → Project API keys → service_role)
- **Project ref** (the `<ref>` part of your URL)

### Run migrations

In the Supabase **SQL Editor**, run the contents of these files in order:

1. `apps/web/supabase/migrations/20260320125633_auth_multitenant.sql`
2. `apps/web/supabase/migrations/20260325000000_github_integration.sql`

Or use the Supabase CLI:

```bash
cd apps/web
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### Deploy the Edge Function

```bash
cd apps/web
npx supabase functions deploy sync-github --project-ref <your-project-ref> --no-verify-jwt
```

### Set Edge Function secrets

```bash
npx supabase secrets set OPENAI_API_KEY=<your-key> --project-ref <your-project-ref>
```

> Without `OPENAI_API_KEY` the sync still works — repos and commits are stored, but no vector embeddings are generated.

### Set up the cron job (auto-sync every 30 min)

Follow the instructions in [`apps/web/supabase/cron-setup.md`](apps/web/supabase/cron-setup.md).

---

## 2. GitHub OAuth App

Go to [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**:

| Field | Value |
|-------|-------|
| Application name | Claude Context Manager |
| Homepage URL | `https://your-app-url.vercel.app` |
| Authorization callback URL | `https://your-app-url.vercel.app/api/github/callback` |

After creating the app, note the **Client ID** and generate a **Client Secret**.

---

## 3. Deploy the Webapp

### Vercel (recommended)

1. Fork or clone this repo and push to your GitHub account
2. Import the project in [vercel.com/new](https://vercel.com/new)
3. Set **Root Directory** to `apps/web`
4. Add the following environment variables:

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `GITHUB_CLIENT_ID` | GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App |
| `NEXT_PUBLIC_APP_URL` | Your Vercel deployment URL (e.g. `https://ccm.yourdomain.com`) |

5. Deploy — Vercel will build and serve the app automatically.

### Local development

```bash
cd apps/web
cp .env.local.example .env.local
# fill in .env.local
npm install
npm run dev
```

---

## 4. First Login

1. Open your deployed URL
2. Sign up with your email — you become the first user
3. Create an organization
4. Go to **Settings** → connect your GitHub org
5. The first sync runs within 30 minutes (or trigger manually via the Edge Function)

---

## Updating

Pull the latest changes and re-run any new migrations:

```bash
git pull
cd apps/web
npx supabase db push --project-ref <your-project-ref>
# redeploy on Vercel (automatic if connected to git)
```
