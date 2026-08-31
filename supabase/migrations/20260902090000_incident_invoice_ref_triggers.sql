-- Wires generate_incident_ref() and generate_invoice_ref() (built in
-- Session 1, never called until now — the same gap Sessions 5 and 6 found
-- and fixed for generate_client_ref()/generate_staff_ref()). Both are
-- sequential-only (no name code, per ID & Reference System Specification
-- section 7.5), so unlike the client/staff triggers these don't need any
-- lookup — just the org_id already on the row being inserted.
create or replace function set_incident_ref()
returns trigger as $$
begin
  if new.incident_ref is null or new.incident_ref = '' then
    new.incident_ref := generate_incident_ref(new.org_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger set_incident_ref_before_insert
  before insert on incidents
  for each row execute function set_incident_ref();

create or replace function set_invoice_ref()
returns trigger as $$
begin
  if new.invoice_ref is null or new.invoice_ref = '' then
    new.invoice_ref := generate_invoice_ref(new.org_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger set_invoice_ref_before_insert
  before insert on invoices
  for each row execute function set_invoice_ref();
