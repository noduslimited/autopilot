-- Fixes a bug found in Session 2 testing: every signUp/createUser call was
-- failing with "Database error saving new user". Root cause: the
-- Database Schema Document's own example SQL for handle_new_auth_user()
-- (reproduced verbatim in Session 1) references the `users` table
-- unqualified, with no search_path set. GoTrue's internal Postgres
-- connection that fires triggers on auth.users does not reliably have
-- `public` on its search_path, so `insert into users (...)` silently
-- failed to resolve the table, aborting the entire user-creation
-- transaction. Fully qualifying the table name (the standard Supabase
-- fix for this exact, well-documented gotcha) resolves it.

create or replace function handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, email, first_name, last_name, org_id, role, status)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    (new.raw_user_meta_data ->> 'org_id')::uuid,
    new.raw_user_meta_data ->> 'role',
    'active'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
