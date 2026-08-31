-- saved_reports: not one of the Database Schema Document's original 19
-- tables — that document predates this session's AI Report Generation
-- feature. AI Feature Specification section 4.6 fully specifies the shape
-- ("Save stores report text in a saved_reports JSONB field (or separate
-- table)"); a dedicated table was chosen over a JSONB column, matching
-- the "table: report name | type | date | download button" list PRD
-- section 4.8 describes. Same precedent as Session 4's ai_usage_logs.
create table saved_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  name text not null,
  report_type text not null default 'ai' check (report_type in ('ai', 'manual')),
  content text not null,
  generated_by uuid not null references users (id),
  created_at timestamptz not null default now()
);

create index saved_reports_org_id_idx on saved_reports (org_id);
create index saved_reports_created_at_idx on saved_reports (org_id, created_at);

alter table saved_reports enable row level security;

create policy "managers_all_saved_reports" on saved_reports
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );
