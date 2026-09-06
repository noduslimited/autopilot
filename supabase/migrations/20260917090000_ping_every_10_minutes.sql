-- Perf pass, 2026-09-06, Gokul's direct request: bump the daily-ping
-- Edge Function from once-daily to every 10 minutes.
--
-- Worth recording honestly what this does and doesn't address: the
-- original job (Session 14, CLAUDE.md section 13) exists solely to stop
-- Supabase's free-tier project from auto-pausing after a week of total
-- inactivity — it is not, and cannot be, a way to "keep a database
-- connection warm" for actual user requests. Netlify's Next.js runtime
-- opens a fresh connection (via Supabase's own pooler) per function
-- invocation regardless of how recently this unrelated Edge Function last
-- ran; there is no shared, reusable connection for a background ping to
-- pre-warm. Implemented as requested regardless — it's cheap (a bare HTTP
-- call, ~144/day instead of 1) and harmless — but the real latency fixes
-- from this pass are the loading-state/N+1-query/parallelisation work
-- documented in CLAUDE.md, not this change.
select cron.unschedule('daily-ping');

select
  cron.schedule(
    'daily-ping',
    '*/10 * * * *', -- every 10 minutes
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
