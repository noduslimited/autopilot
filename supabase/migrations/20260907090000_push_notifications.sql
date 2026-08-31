-- Source: CLAUDE.md section 16a (Product Specification Amendments) —
-- carer shift notifications via Web Push, directed by Gokul ahead of
-- Session 12, replacing the PRD's original email-based shift
-- notification.

-- push_subscriptions: one row per browser/device a user has enabled
-- push notifications on. Not carer-specific at the table level (any
-- authenticated user could subscribe in principle), but only the carer
-- portal prompts for it per this feature.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on push_subscriptions (user_id);
create index push_subscriptions_org_id_idx on push_subscriptions (org_id);

alter table push_subscriptions enable row level security;

-- Users manage only their own subscriptions (subscribe/unsubscribe from
-- their own browser). The shift-notifications Edge Function reads across
-- all users via the service-role key, which bypasses RLS entirely.
create policy "users_own_push_subscriptions" on push_subscriptions
  for all using (user_id = auth.uid());

-- shift_notification_log: dedup record so the Edge Function (which runs
-- every 15 minutes and could in principle see the same shift fall in the
-- same window across two runs if execution timing drifts) never sends
-- the same (shift, stage) notification twice. The Edge Function inserts
-- with ON CONFLICT DO NOTHING and only sends the push if the insert
-- actually happened — atomic against concurrent/overlapping runs.
create table shift_notification_log (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references rota_shifts (id) on delete cascade,
  stage text not null check (stage in ('t60', 't15', 't0')),
  sent_at timestamptz not null default now(),
  unique (shift_id, stage)
);

-- No RLS policies — this table is only ever touched by the Edge
-- Function's service-role client, same pattern as ai_usage_logs.
alter table shift_notification_log enable row level security;
