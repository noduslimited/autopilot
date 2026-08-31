-- Source: CLAUDE.md section 13 / Sessions.md Session 14 step 11. Schedules
-- the daily-ping Edge Function at 03:00 UTC, a quiet hour distinct from
-- the existing 06:00 UTC daily-notification-checks job. Reuses the
-- service_role_key already stored in Supabase Vault (see the
-- pre-Session-12 push-notification migration's comment for why it's
-- never written into a committed migration file).
select
  cron.schedule(
    'daily-ping',
    '0 3 * * *', -- daily at 03:00 UTC
    $$
    select net.http_post(
      url := 'https://funxjlzethccqmteidca.supabase.co/functions/v1/daily-ping',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    )
    $$
  );
