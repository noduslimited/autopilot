-- Visit lifecycle tables: visits, visit_tasks, medications, emar_records
-- Source: Database Schema Document sections 3.5, 3.6, 3.7, 3.8

-- timezone(text, timestamptz) is STABLE, not IMMUTABLE, so it cannot be used
-- directly in an index expression. This wrapper pins the zone to UTC (fixed
-- offset, no DST) and is safe to mark IMMUTABLE for the "today's visits" index.
create or replace function visit_date_utc(timestamptz) returns date as $$
  select ($1 at time zone 'UTC')::date
$$ language sql immutable;

create table visits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  assigned_carer_id uuid references users (id) on delete set null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  check_in_time timestamptz,
  check_out_time timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'missed', 'cancelled')),
  visit_notes text,
  wellbeing_rating text check (wellbeing_rating in ('good', 'fair', 'poor')),
  tasks_total integer not null default 0,
  tasks_completed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visits_org_id_idx on visits (org_id);
create index visits_client_id_idx on visits (client_id);
create index visits_assigned_carer_id_idx on visits (assigned_carer_id);
create index visits_scheduled_start_idx on visits (scheduled_start);
create index visits_org_status_idx on visits (org_id, status);
-- "today's visits" query — UTC date bucket
create index visits_org_date_idx on visits (org_id, visit_date_utc(scheduled_start));

-- visit_tasks: individual tasks within a visit, derived from the care plan at visit creation
create table visit_tasks (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  task_type text not null check (task_type in ('meal_prep', 'medication', 'moving', 'personal_care', 'log_notes', 'custom')),
  task_label text not null,
  task_order integer not null,
  requires_emar boolean not null default false,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references users (id),
  created_at timestamptz not null default now()
);

create index visit_tasks_visit_id_idx on visit_tasks (visit_id);
create index visit_tasks_org_id_idx on visit_tasks (org_id);

-- medications: active medications for a client, referenced by eMAR records
create table medications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  medication_name text not null,
  dose text not null,
  frequency text not null,
  prescribed_by text,
  route text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medications_client_id_idx on medications (client_id);
create index medications_org_id_idx on medications (org_id);
create index medications_active_idx on medications (client_id, active);

-- emar_records: Electronic Medication Administration Record — one per medication per visit
create table emar_records (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits (id) on delete cascade,
  visit_task_id uuid not null references visit_tasks (id) on delete cascade,
  medication_id uuid not null references medications (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  administered boolean not null,
  reason_not_administered text check (reason_not_administered in ('client_refused', 'asleep', 'not_available', 'other')),
  reason_detail text,
  administered_at timestamptz,
  administered_by uuid not null references users (id),
  created_at timestamptz not null default now()
);

create index emar_records_visit_id_idx on emar_records (visit_id);
create index emar_records_client_id_idx on emar_records (client_id);
create index emar_records_medication_id_idx on emar_records (medication_id);
create index emar_records_org_id_idx on emar_records (org_id);
