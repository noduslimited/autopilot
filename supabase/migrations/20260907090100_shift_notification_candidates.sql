-- Source: CLAUDE.md section 16a. rota_shifts.shift_date/start_time have
-- no timezone (they're UK wall-clock values) — doing the "seconds until
-- shift start" math in Postgres via AT TIME ZONE 'Europe/London' handles
-- BST/GMT transitions correctly for free, rather than reimplementing UK
-- daylight-saving rules in the Edge Function's Deno/TypeScript code.
create or replace function get_shift_notification_candidates()
returns table (
  shift_id uuid,
  staff_id uuid,
  org_id uuid,
  seconds_until_start numeric
)
language sql
security definer
set search_path = public
as $$
  select
    rs.id,
    rs.staff_id,
    rs.org_id,
    extract(epoch from ((rs.shift_date + rs.start_time) at time zone 'Europe/London' - now()))
  from rota_shifts rs
  where rs.start_time is not null
    and rs.shift_type in ('weekday', 'weekend')
    and rs.shift_date between ((now() at time zone 'Europe/London')::date - 1) and ((now() at time zone 'Europe/London')::date + 1)
$$;
