-- Incidents: one record per reported incident. Never deleted — only closed.
-- Source: Database Schema Document section 3.9

create table incidents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  incident_ref text not null,
  client_id uuid not null references clients (id) on delete cascade,
  visit_id uuid references visits (id) on delete set null,
  reported_by uuid not null references users (id),
  incident_type text not null check (incident_type in ('fall', 'medication', 'behaviour', 'other')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  description text not null,
  gp_contacted boolean not null default false,
  gp_notes text,
  status text not null default 'open' check (status in ('open', 'closed')),
  manager_notes text,
  signed_off_by uuid references users (id),
  signed_off_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index incidents_org_id_idx on incidents (org_id);
create index incidents_client_id_idx on incidents (client_id);
create index incidents_org_status_idx on incidents (org_id, status);
create unique index incidents_incident_ref_key on incidents (incident_ref);
create index incidents_reported_by_idx on incidents (reported_by);
