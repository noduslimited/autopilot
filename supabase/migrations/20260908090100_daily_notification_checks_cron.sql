-- Source: Sessions.md Session 12 steps 9-11. Runs the daily checks
-- (training expiry, DBS expiry, invoice overdue, unassigned visit) once
-- a day. Reuses the service_role_key already stored in Supabase Vault
-- (see the pre-Session-12 push-notification migration's comment for why
-- it's never written into a committed migration file).
select
  cron.schedule(
    'daily-notification-checks',
    '0 6 * * *', -- daily at 06:00 UTC
    $$
    select net.http_post(
      url := 'https://funxjlzethccqmteidca.supabase.co/functions/v1/daily-notification-checks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    )
    $$
  );
