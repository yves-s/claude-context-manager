# Cron Job Setup — sync-github

Run these SQL statements in the **Supabase SQL Editor** to set up the automated 30-minute trigger.

## 1. Enable required extensions

```sql
-- Enable pg_net (for HTTP calls from cron)
CREATE EXTENSION IF NOT EXISTS pg_net;
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

## 2. Store service role key as DB setting

Replace `<SERVICE_ROLE_KEY>` with the value from **Supabase Dashboard → Settings → API → service_role key**.

```sql
ALTER DATABASE postgres
  SET app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
```

## 3. Create cron job

Replace `<PROJECT-REF>` with your Supabase project reference (visible in Supabase Dashboard → Settings → General).

```sql
SELECT cron.schedule(
  'sync-github-every-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/sync-github',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## 4. Verify cron job

```sql
SELECT * FROM cron.job;
```

Expected: one row with `jobname = 'sync-github-every-30min'`, schedule `*/30 * * * *`.

## To remove the cron job

```sql
SELECT cron.unschedule('sync-github-every-30min');
```
