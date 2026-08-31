-- Fixes a gap noted (but not fixed, since nothing needed it yet) in
-- Sessions 5 and 6: handle_new_auth_user() has always hardcoded
-- status = 'active' for every new users row, even though the Database
-- Schema Document's own notes define status = 'invited' as meaning
-- exactly "the invitation email has been sent but not accepted" — and
-- Session 8's Team Members list (PRD 4.10: Active / Pending invitation /
-- Deactivated) needs this distinction to actually work.
--
-- auth.users.invited_at is set by Supabase specifically for admin
-- inviteUserByEmail() calls (staff and family_nok invites) and is null
-- for direct signups (org registration's own manager account, created via
-- admin.createUser()) — so it cleanly distinguishes "this row exists
-- because someone was invited" from "this row exists because someone
-- registered directly", without needing new metadata.
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
    case when new.invited_at is not null then 'invited' else 'active' end
  );

  if (new.raw_user_meta_data ->> 'role') = 'family_nok'
     and (new.raw_user_meta_data ->> 'client_id') is not null then
    insert into public.family_nok (user_id, client_id, org_id, relationship)
    values (
      new.id,
      (new.raw_user_meta_data ->> 'client_id')::uuid,
      (new.raw_user_meta_data ->> 'org_id')::uuid,
      new.raw_user_meta_data ->> 'relationship'
    );
  end if;

  if (new.raw_user_meta_data ->> 'staff_role') is not null then
    insert into public.staff (id, org_id, role)
    values (
      new.id,
      (new.raw_user_meta_data ->> 'org_id')::uuid,
      new.raw_user_meta_data ->> 'staff_role'
    );
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
