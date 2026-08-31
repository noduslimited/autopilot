-- Notifications, documents, and audit_logs tables
-- Source: Database Schema Document sections 3.16, 3.17, 3.18

-- notifications: in-app notifications for managers and carers
create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (type in ('incident_filed', 'shift_swap', 'family_message', 'training_expiry', 'dbs_expiry', 'invoice_overdue', 'unassigned_visit')),
  title text not null,
  body text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on notifications (user_id);
create index notifications_org_id_idx on notifications (org_id);
create index notifications_user_read_idx on notifications (user_id, read);

-- documents: file attachments for clients and staff (polymorphic entity_id — no FK)
create table documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  entity_type text not null check (entity_type in ('client', 'staff')),
  entity_id uuid not null,
  name text not null,
  file_url text not null,
  file_type text,
  uploaded_by uuid not null references users (id),
  created_at timestamptz not null default now()
);

create index documents_entity_idx on documents (entity_type, entity_id);
create index documents_org_id_idx on documents (org_id);

-- audit_logs: immutable record of all create, update, and delete operations.
-- No UPDATE or DELETE RLS policy is ever created on this table (see rls_policies migration).
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisations (id),
  user_id uuid references users (id),
  action text not null check (action in ('create', 'update', 'delete')),
  table_name text not null,
  record_id uuid not null,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index audit_logs_org_id_idx on audit_logs (org_id);
create index audit_logs_record_idx on audit_logs (table_name, record_id);
create index audit_logs_user_id_idx on audit_logs (user_id);
create index audit_logs_created_at_idx on audit_logs (created_at);
