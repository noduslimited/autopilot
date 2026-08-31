-- Client and care plan tables
-- Source: Database Schema Document sections 3.3, 3.4

create table clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  client_ref text not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  nhs_number text,
  address text not null,
  postcode text,
  care_type text not null check (care_type in ('domiciliary', 'residential', 'supported_living')),
  assigned_carer_id uuid references users (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  biography text,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  allergies text[] not null default '{}',
  dietary_requirements text,
  dnacpr boolean not null default false,
  falls_risk boolean not null default false,
  choking_risk boolean not null default false,
  mobility_aids text,
  additional_risk_notes text,
  visit_frequency text check (visit_frequency in ('daily', 'twice_daily', 'three_times_daily', 'weekly', 'custom')),
  visit_duration_minutes integer,
  gp_name text,
  gp_practice text,
  gp_phone text,
  nok_name text,
  nok_relationship text,
  nok_email text,
  nok_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index clients_org_id_idx on clients (org_id);
create index clients_org_id_status_idx on clients (org_id, status);
create index clients_assigned_carer_id_idx on clients (assigned_carer_id);
create unique index clients_client_ref_key on clients (client_ref);
create index clients_nhs_number_idx on clients (nhs_number);

-- care_plans: one care plan per client
create table care_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  care_needs jsonb not null default '[]',
  what_we_help_with text[] not null default '{}',
  last_reviewed_at timestamptz,
  reviewed_by uuid references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index care_plans_client_id_key on care_plans (client_id);
create index care_plans_org_id_idx on care_plans (org_id);
