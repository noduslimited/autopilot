-- Source: CLAUDE.md section 16a. pg_cron invokes the shift-notifications
-- Edge Function every 15 minutes over HTTP via pg_net. The service-role
-- key pg_net needs to authenticate that call is deliberately NOT in this
-- file — it's stored in Supabase Vault out-of-band (via `supabase db
-- query --linked`, not a committed migration) precisely so it never
-- enters git history, per CLAUDE.md section 15's secret-hygiene rules.
-- This migration only wires the schedule to read it from Vault at
-- execution time.
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

select
  cron.schedule(
    'shift-notifications-check',
    '*/15 * * * *',
    $$
    select net.http_post(
      url := 'https://funxjlzethccqmteidca.supabase.co/functions/v1/shift-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    )
    $$
  );
