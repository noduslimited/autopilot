-- Wires generate_client_ref() to fire automatically on insert. Session 1
-- built the function itself but never attached it to a trigger — it was
-- only ever a plain callable function, unlike initialise_org_sequences
-- which already established the "trigger calls a generation function"
-- pattern for organisations. Sessions.md's Session 5 step 5 explicitly
-- says "via database function on insert", matching that established
-- pattern rather than requiring application code to replicate the ID
-- format itself.

create or replace function set_client_ref()
returns trigger as $$
begin
  if new.client_ref is null then
    new.client_ref := generate_client_ref(new.org_id, new.first_name, new.last_name);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger set_client_ref_before_insert
  before insert on clients
  for each row execute function set_client_ref();
