-- Wires generate_staff_ref() (built in Session 1, never called until now —
-- same gap Session 5 found and fixed for generate_client_ref()). staff has
-- no first_name/last_name of its own (it "extends users"), so the trigger
-- looks them up from public.users via new.id, which must already exist by
-- the time a staff row is inserted (handle_new_auth_user() creates users
-- first, then staff, in that order within the same trigger execution).
create or replace function set_staff_ref()
returns trigger as $$
declare
  v_first_name text;
  v_last_name text;
begin
  if new.staff_ref is null or new.staff_ref = '' then
    select first_name, last_name into v_first_name, v_last_name
    from public.users where id = new.id;

    new.staff_ref := generate_staff_ref(new.org_id, v_first_name, v_last_name);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger set_staff_ref_before_insert
  before insert on staff
  for each row execute function set_staff_ref();
