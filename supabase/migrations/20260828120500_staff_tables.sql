-- Staff, training, and rota tables
-- Source: Database Schema Document sections 3.10, 3.11, 3.12

-- staff: extends users with care-sector specific compliance data
create table staff (
  id uuid primary key references users (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  staff_ref text not null,
  role text not null check (role in ('carer', 'senior_carer', 'manager')),
  dbs_number text,
  dbs_expiry date,
  dbs_certificate_url text,
  start_date date,
  emergency_contact_name text,
  emergency_contact_phone text,
  contract_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_org_id_idx on staff (org_id);
create unique index staff_ref_key on staff (staff_ref);

-- training_records: one record per training module completion per staff member
create table training_records (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  module_name text not null check (module_name in ('manual_handling', 'medication_awareness', 'fire_safety', 'safeguarding_adults', 'first_aid', 'other')),
  module_label text not null,
  completed_date date not null,
  expiry_date date not null,
  renewal_period_years integer not null check (renewal_period_years in (1, 3)),
  certificate_url text,
  logged_by uuid not null references users (id),
  created_at timestamptz not null default now()
);

create index training_records_staff_id_idx on training_records (staff_id);
create index training_records_org_id_idx on training_records (org_id);
create index training_records_expiry_idx on training_records (org_id, expiry_date);

-- rota_shifts: one record per carer per day in the rota
create table rota_shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  staff_id uuid not null references staff (id) on delete cascade,
  shift_date date not null,
  start_time time,
  end_time time,
  shift_type text not null default 'weekday' check (shift_type in ('weekday', 'weekend', 'sick_leave', 'annual_leave', 'off')),
  assigned_client_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rota_shifts_org_id_idx on rota_shifts (org_id);
create index rota_shifts_staff_id_idx on rota_shifts (staff_id);
create index rota_shifts_date_idx on rota_shifts (org_id, shift_date);
create unique index rota_shifts_staff_date_key on rota_shifts (staff_id, shift_date);
