-- Core tables: organisations, users, id_sequences
-- Source: 01 Documentation/02 Technical Documentation/10_Database_Schema_Document.md sections 3.1, 3.2, 3.19

create extension if not exists pgcrypto;

-- organisations: one record per care provider registered on Autopilot
create table organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_code varchar(4) not null,
  cqc_number text,
  care_types text[] not null default '{}',
  address text,
  phone text,
  email text not null,
  logo_url text,
  -- 'trial_expired' is used by the trial-to-paid conversion flow
  -- (Data Flow & Architecture Diagram section 8.1) in addition to the
  -- four statuses listed in the Database Schema Document table.
  status text not null default 'trial'
    check (status in ('trial', 'trial_expired', 'active', 'suspended', 'payment_failed')),
  trial_start_date timestamptz,
  trial_end_date timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_plan_tier text check (stripe_plan_tier in ('essential', 'growth', 'professional', 'enterprise')),
  active_user_count integer not null default 0,
  invoice_bank_name text,
  invoice_sort_code text,
  invoice_account_number text,
  invoice_payment_terms integer not null default 30,
  invoice_company_number text,
  invoice_vat_number text,
  notification_settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organisations_org_code_key on organisations (org_code);
create index organisations_stripe_customer_id_idx on organisations (stripe_customer_id);

-- users: one record per authenticated user, extends auth.users
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  role text not null check (role in ('manager', 'carer', 'family_nok', 'service_user')),
  status text not null default 'active' check (status in ('active', 'invited', 'deactivated')),
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_org_id_idx on users (org_id);
create index users_email_idx on users (email);
create index users_org_role_idx on users (org_id, role);

-- id_sequences: tracks the auto-incrementing sequence number per org per record type
create table id_sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  record_type text not null check (record_type in ('client', 'staff', 'incident', 'invoice')),
  next_sequence integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index id_sequences_org_type_key on id_sequences (org_id, record_type);
