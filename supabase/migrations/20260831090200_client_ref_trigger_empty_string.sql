-- Follow-up to set_client_ref() (20260831090000): Supabase's generated
-- Insert type marks client_ref as required (NOT NULL, no DB-level default
-- — the type generator can't see that a trigger populates it), so
-- application code passes an empty string as a placeholder rather than
-- omitting the key entirely. Treat both null and '' as "not yet set".
-- New migration rather than editing the already-applied one, per the
-- Database Schema Document's migration strategy ("never modify a deployed
-- migration").

create or replace function set_client_ref()
returns trigger as $$
begin
  if new.client_ref is null or new.client_ref = '' then
    new.client_ref := generate_client_ref(new.org_id, new.first_name, new.last_name);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
