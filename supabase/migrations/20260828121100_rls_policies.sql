-- Row Level Security — enabled on all 19 tables, per CLAUDE.md rule 2 and
-- Roles & Permissions Matrix section 2 ("Org isolation is absolute").
--
-- Policies explicitly specified in Roles & Permissions Matrix section 4
-- (clients, visits, incidents, audit_logs) are reproduced verbatim.
-- Policies for tables not given explicit SQL there are derived from the
-- full permissions matrix in section 3 of the same document, following the
-- same org-isolation + role-scoping pattern.

-- =========================================================================
-- organisations
-- =========================================================================
alter table organisations enable row level security;

-- Org creation happens server-side (service role) during registration,
-- before a users row with org_id exists — no authenticated INSERT policy.
create policy "managers_view_own_org" on organisations
  for select using (id = get_user_org_id());

create policy "managers_update_own_org" on organisations
  for update using (id = get_user_org_id() and get_user_role() = 'manager');

-- =========================================================================
-- users
-- =========================================================================
alter table users enable row level security;

-- Row creation handled by the handle_new_auth_user trigger (security definer) — no INSERT policy.
create policy "users_view_own_record" on users
  for select using (id = auth.uid());

create policy "managers_view_org_users" on users
  for select using (org_id = get_user_org_id() and get_user_role() = 'manager');

create policy "users_update_own_record" on users
  for update using (id = auth.uid());

create policy "managers_update_org_users" on users
  for update using (org_id = get_user_org_id() and get_user_role() = 'manager');

-- =========================================================================
-- id_sequences — internal counter table, no direct UI access by any role.
-- RLS enabled with no policies: only the security definer ID generation
-- functions (which run as table owner) can read or write it.
-- =========================================================================
alter table id_sequences enable row level security;

-- =========================================================================
-- clients
-- Source: Roles & Permissions Matrix section 4.1 (reproduced verbatim)
-- =========================================================================
alter table clients enable row level security;

create policy "managers_all_clients" on clients
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

create policy "carers_assigned_clients" on clients
  for select using (
    org_id = get_user_org_id()
    and get_user_role() = 'carer'
    and assigned_carer_id = auth.uid()
  );

create policy "family_linked_client" on clients
  for select using (
    id in (
      select client_id from family_nok where user_id = auth.uid()
    )
  );

-- =========================================================================
-- care_plans — same access shape as clients
-- =========================================================================
alter table care_plans enable row level security;

create policy "managers_all_care_plans" on care_plans
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

create policy "carers_assigned_care_plans" on care_plans
  for select using (
    org_id = get_user_org_id()
    and get_user_role() = 'carer'
    and client_id in (select id from clients where assigned_carer_id = auth.uid())
  );

create policy "family_linked_care_plan" on care_plans
  for select using (
    client_id in (select client_id from family_nok where user_id = auth.uid())
  );

-- =========================================================================
-- visits
-- Source: Roles & Permissions Matrix section 4.2 (reproduced verbatim)
-- =========================================================================
alter table visits enable row level security;

create policy "managers_all_visits" on visits
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

create policy "carers_own_visits" on visits
  for all using (
    org_id = get_user_org_id()
    and get_user_role() = 'carer'
    and assigned_carer_id = auth.uid()
  );

create policy "family_client_visits" on visits
  for select using (
    client_id in (
      select client_id from family_nok where user_id = auth.uid()
    )
  );

-- =========================================================================
-- visit_tasks — carers read/write tasks on their own visits
-- =========================================================================
alter table visit_tasks enable row level security;

create policy "managers_all_visit_tasks" on visit_tasks
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

create policy "carers_own_visit_tasks" on visit_tasks
  for all using (
    org_id = get_user_org_id()
    and get_user_role() = 'carer'
    and visit_id in (select id from visits where assigned_carer_id = auth.uid())
  );

-- =========================================================================
-- medications — manager full access; carer read-only for assigned clients
-- =========================================================================
alter table medications enable row level security;

create policy "managers_all_medications" on medications
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

create policy "carers_view_assigned_medications" on medications
  for select using (
    org_id = get_user_org_id()
    and get_user_role() = 'carer'
    and client_id in (select id from clients where assigned_carer_id = auth.uid())
  );

-- =========================================================================
-- emar_records — carers log eMAR on their own visits; managers view/audit all
-- =========================================================================
alter table emar_records enable row level security;

create policy "managers_all_emar_records" on emar_records
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

create policy "carers_own_emar_records" on emar_records
  for all using (
    org_id = get_user_org_id()
    and get_user_role() = 'carer'
    and visit_id in (select id from visits where assigned_carer_id = auth.uid())
  );

-- =========================================================================
-- incidents
-- Source: Roles & Permissions Matrix section 4.3 (reproduced verbatim)
-- =========================================================================
alter table incidents enable row level security;

create policy "managers_all_incidents" on incidents
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

create policy "carers_file_incident" on incidents
  for insert with check (
    org_id = get_user_org_id() and get_user_role() = 'carer'
  );

create policy "carers_own_incidents" on incidents
  for select using (
    org_id = get_user_org_id()
    and get_user_role() = 'carer'
    and reported_by = auth.uid()
  );

-- =========================================================================
-- staff
-- =========================================================================
alter table staff enable row level security;

create policy "managers_all_staff" on staff
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

create policy "carers_own_staff_profile" on staff
  for select using (id = auth.uid());

-- =========================================================================
-- training_records
-- =========================================================================
alter table training_records enable row level security;

create policy "managers_all_training_records" on training_records
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

create policy "carers_own_training_records" on training_records
  for select using (
    org_id = get_user_org_id()
    and get_user_role() = 'carer'
    and staff_id = auth.uid()
  );

-- =========================================================================
-- rota_shifts
-- =========================================================================
alter table rota_shifts enable row level security;

create policy "managers_all_rota_shifts" on rota_shifts
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

create policy "carers_own_rota_shifts" on rota_shifts
  for select using (
    org_id = get_user_org_id()
    and get_user_role() = 'carer'
    and staff_id = auth.uid()
  );

-- =========================================================================
-- invoices — manager only, no carer or family access
-- =========================================================================
alter table invoices enable row level security;

create policy "managers_all_invoices" on invoices
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

-- =========================================================================
-- messages
-- =========================================================================
alter table messages enable row level security;

create policy "managers_all_messages" on messages
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

create policy "family_own_message_thread" on messages
  for all using (
    client_id in (select client_id from family_nok where user_id = auth.uid())
  );

-- =========================================================================
-- family_nok
-- =========================================================================
alter table family_nok enable row level security;

create policy "managers_all_family_nok" on family_nok
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

create policy "family_own_link" on family_nok
  for select using (user_id = auth.uid());

-- =========================================================================
-- notifications — each user manages only their own notifications.
-- Inserts are made by security definer triggers/functions, not directly
-- by authenticated users, so no INSERT policy is defined here.
-- =========================================================================
alter table notifications enable row level security;

create policy "users_own_notifications" on notifications
  for select using (user_id = auth.uid());

create policy "users_update_own_notifications" on notifications
  for update using (user_id = auth.uid());

-- =========================================================================
-- documents — manager only per Roles & Permissions Matrix section 3.3
-- ("View client documents" = manager only; carers have no access)
-- =========================================================================
alter table documents enable row level security;

create policy "managers_all_documents" on documents
  for all using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );

-- =========================================================================
-- audit_logs
-- Source: Roles & Permissions Matrix section 4.4 (reproduced verbatim)
-- Immutable: no UPDATE or DELETE policy is ever created on this table.
-- Inserts happen only via the log_audit() trigger (security definer).
-- =========================================================================
alter table audit_logs enable row level security;

create policy "managers_view_audit_logs" on audit_logs
  for select using (
    org_id = get_user_org_id() and get_user_role() = 'manager'
  );
