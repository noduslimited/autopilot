-- Creates a corresponding `users` record whenever Supabase Auth creates a new auth.users row.
-- Source: Database Schema Document section 5.3

create or replace function handle_new_auth_user()
returns trigger as $$
begin
  insert into users (id, email, first_name, last_name, org_id, role, status)
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
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
