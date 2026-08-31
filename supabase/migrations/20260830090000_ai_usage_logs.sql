-- AI usage tracking, for the daily per-org/per-feature rate limits and cost
-- monitoring described in AI Feature Specification section 5 ("Rate
-- Limiting and Cost Controls"). Not one of the Database Schema Document's
-- original 19 tables — that document's table list predates this session's
-- first AI feature and never accounted for it, even though the AI Feature
-- Specification (an equally primary reference doc) fully specifies its
-- shape in section 5.3. Added now rather than silently skipping rate
-- limiting.

create table ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  feature text not null,
  tokens_used integer not null,
  cost_estimate numeric(10, 6) not null,
  created_at timestamptz not null default now()
);

create index ai_usage_logs_org_feature_idx on ai_usage_logs (org_id, feature, created_at);

alter table ai_usage_logs enable row level security;

-- Managers can view their own org's usage. Inserts happen only via the
-- service-role client from AI API routes, matching the pattern already
-- used for audit_logs/notifications — no INSERT policy for regular roles.
create policy "managers_view_ai_usage" on ai_usage_logs
  for select using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );
