-- Audit logging trigger and updated_at trigger
-- Source: Database Schema Document section 5.1, 5.2
-- Audited tables per Database Schema Document 5.1 plus User Stories AUD-01,
-- which explicitly adds messages and rota shifts to the audited set.

create or replace function log_audit()
returns trigger as $$
begin
  insert into audit_logs (org_id, user_id, action, table_name, record_id, old_values, new_values)
  values (
    coalesce(new.org_id, old.org_id),
    auth.uid(),
    case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' when 'DELETE' then 'delete' end,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then null else row_to_json(old) end,
    case when tg_op = 'DELETE' then null else row_to_json(new) end
  );
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger audit_clients after insert or update or delete on clients
  for each row execute function log_audit();
create trigger audit_care_plans after insert or update or delete on care_plans
  for each row execute function log_audit();
create trigger audit_visits after insert or update or delete on visits
  for each row execute function log_audit();
create trigger audit_visit_tasks after insert or update or delete on visit_tasks
  for each row execute function log_audit();
create trigger audit_emar_records after insert or update or delete on emar_records
  for each row execute function log_audit();
create trigger audit_incidents after insert or update or delete on incidents
  for each row execute function log_audit();
create trigger audit_staff after insert or update or delete on staff
  for each row execute function log_audit();
create trigger audit_training_records after insert or update or delete on training_records
  for each row execute function log_audit();
create trigger audit_rota_shifts after insert or update or delete on rota_shifts
  for each row execute function log_audit();
create trigger audit_invoices after insert or update or delete on invoices
  for each row execute function log_audit();
create trigger audit_medications after insert or update or delete on medications
  for each row execute function log_audit();
create trigger audit_messages after insert or update or delete on messages
  for each row execute function log_audit();

-- updated_at trigger — applied to every table that has an updated_at column

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on organisations
  for each row execute function set_updated_at();
create trigger set_updated_at before update on users
  for each row execute function set_updated_at();
create trigger set_updated_at before update on clients
  for each row execute function set_updated_at();
create trigger set_updated_at before update on care_plans
  for each row execute function set_updated_at();
create trigger set_updated_at before update on visits
  for each row execute function set_updated_at();
create trigger set_updated_at before update on medications
  for each row execute function set_updated_at();
create trigger set_updated_at before update on incidents
  for each row execute function set_updated_at();
create trigger set_updated_at before update on staff
  for each row execute function set_updated_at();
create trigger set_updated_at before update on rota_shifts
  for each row execute function set_updated_at();
create trigger set_updated_at before update on invoices
  for each row execute function set_updated_at();
create trigger set_updated_at before update on id_sequences
  for each row execute function set_updated_at();
