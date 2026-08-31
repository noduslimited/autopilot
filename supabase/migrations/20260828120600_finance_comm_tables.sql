-- Invoices, messages, and family_nok tables
-- Source: Database Schema Document sections 3.13, 3.14, 3.15

-- invoices: one record per invoice. Never deleted — only voided.
create table invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  invoice_ref text not null,
  client_id uuid not null references clients (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'sent', 'overdue', 'paid', 'void')),
  line_items jsonb not null default '[]',
  subtotal numeric(10, 2) not null default 0,
  vat_amount numeric(10, 2) not null default 0,
  total_amount numeric(10, 2) not null default 0,
  due_date date,
  sent_at timestamptz,
  sent_to_email text,
  paid_at timestamptz,
  payment_method text check (payment_method in ('bank_transfer', 'card', 'cheque')),
  created_by uuid not null references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_org_id_idx on invoices (org_id);
create index invoices_client_id_idx on invoices (client_id);
create index invoices_org_status_idx on invoices (org_id, status);
create unique index invoices_invoice_ref_key on invoices (invoice_ref);

-- messages: between family members and the care team, threaded per client
create table messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  sender_id uuid not null references users (id),
  sender_role text not null check (sender_role in ('manager', 'carer', 'family_nok')),
  sender_name text not null,
  body text not null,
  read_by_family boolean not null default false,
  read_by_manager boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_client_id_idx on messages (client_id);
create index messages_org_id_idx on messages (org_id);
create index messages_created_at_idx on messages (created_at);

-- family_nok: links a family/NOK user account to a client
create table family_nok (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  relationship text,
  created_at timestamptz not null default now()
);

create index family_nok_user_id_idx on family_nok (user_id);
create index family_nok_client_id_idx on family_nok (client_id);
create unique index family_nok_user_client_key on family_nok (user_id, client_id);
