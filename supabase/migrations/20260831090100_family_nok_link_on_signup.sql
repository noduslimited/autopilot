-- Extends handle_new_auth_user() (Session 1/2) to also create the
-- family_nok link row when an invited user's role is family_nok. Session
-- 2's staff invitation flow never needed this (staff don't need a linking
-- table), but Session 5's NOK invitation does: family_nok.user_id only
-- exists once the invitee actually completes registration, so the link
-- can't be created at invite-send time (no user_id yet) — it has to happen
-- here, in the same trigger that creates the users row on signup.

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

  return new;
end;
$$ language plpgsql security definer set search_path = public;
