-- Source: Sessions.md Session 12 steps 9-11 (training/DBS/invoice
-- scheduled checks). Generalises the shift_notification_log pattern
-- (built pre-Session-12 for push notifications) to every scheduled-check
-- notification type, so a daily Edge Function run never creates a
-- duplicate notification for the same underlying record + stage.
create table notification_dedup_log (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null check (notification_type in ('training_expiry', 'dbs_expiry', 'invoice_overdue', 'unassigned_visit')),
  record_id uuid not null,
  stage text not null,
  sent_at timestamptz not null default now(),
  unique (notification_type, record_id, stage)
);

-- No RLS policies — service-role-only, same as shift_notification_log
-- and ai_usage_logs.
alter table notification_dedup_log enable row level security;

-- Source: Sessions.md steps 9-11. security definer SQL functions (same
-- pattern as get_shift_notification_candidates) so the daily Edge
-- Function does one RPC call per check type rather than reimplementing
-- date/join logic in Deno.

create or replace function get_training_expiry_candidates()
returns table (
  record_id uuid,
  org_id uuid,
  staff_id uuid,
  module_label text,
  expiry_date date,
  days_until_expiry integer
)
language sql
security definer
set search_path = public
as $$
  select
    tr.id,
    tr.org_id,
    tr.staff_id,
    coalesce(nullif(tr.module_label, ''), tr.module_name),
    tr.expiry_date,
    (tr.expiry_date - (now() at time zone 'Europe/London')::date)::integer
  from training_records tr
  where (tr.expiry_date - (now() at time zone 'Europe/London')::date) in (60, 30, 0)
$$;

create or replace function get_dbs_expiry_candidates()
returns table (
  record_id uuid,
  org_id uuid,
  staff_id uuid,
  days_until_expiry integer
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.org_id,
    s.id,
    (s.dbs_expiry - (now() at time zone 'Europe/London')::date)::integer
  from staff s
  where s.dbs_expiry is not null
    and (s.dbs_expiry - (now() at time zone 'Europe/London')::date) in (30, 0)
$$;

create or replace function get_overdue_invoice_candidates()
returns table (
  record_id uuid,
  org_id uuid,
  client_id uuid,
  invoice_ref text,
  total_amount numeric
)
language sql
security definer
set search_path = public
as $$
  select i.id, i.org_id, i.client_id, i.invoice_ref, i.total_amount
  from invoices i
  where i.status = 'sent'
    and i.due_date is not null
    and i.due_date < (now() at time zone 'Europe/London')::date
$$;

create or replace function get_unassigned_visit_candidates()
returns table (
  record_id uuid,
  org_id uuid,
  client_id uuid,
  scheduled_start timestamptz
)
language sql
security definer
set search_path = public
as $$
  select v.id, v.org_id, v.client_id, v.scheduled_start
  from visits v
  where v.status = 'scheduled'
    and v.assigned_carer_id is null
    and v.scheduled_start between now() and now() + interval '48 hours'
$$;
