-- Source: TRD section 10.2 (trial management), Sessions.md Session 11
-- step 7 ("Build trial expiry Edge Function (pg_cron daily check)").
--
-- Middleware already enforces the actual redirect by comparing
-- trial_end_date directly at request time (see proxy.ts, built Session
-- 2) — it doesn't depend on this job. This job's only purpose is keeping
-- organisations.status accurate for everything ELSE that reads status
-- (the billing page, any future reporting), flipping trial -> trial_expired
-- once trial_end_date has passed. A plain pg_cron-scheduled SQL statement
-- achieves this identically to a full Edge Function, without the added
-- complexity of deploying and authenticating an HTTP function for what is
-- fundamentally a single UPDATE query.
create extension if not exists pg_cron with schema extensions;

select
  cron.schedule(
    'trial-expiry-check',
    '0 1 * * *', -- daily at 01:00 UTC
    $$
    update organisations
    set status = 'trial_expired'
    where status = 'trial'
      and trial_end_date is not null
      and trial_end_date < now()
    $$
  );
