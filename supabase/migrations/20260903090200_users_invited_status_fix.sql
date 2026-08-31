-- The previous fix (20260903090000) checked new.invited_at, assuming
-- Supabase sets it as part of the same auth.users INSERT that fires this
-- trigger. Verified empirically that it does not — invited_at is set via
-- a separate UPDATE roughly 10ms after the INSERT, so the trigger always
-- saw it as null and every invited user still landed as 'active'.
--
-- Replaced with a status key in raw_user_meta_data, set explicitly by
-- every invite-sending call site (not dependent on GoTrue's internal
-- timing at all — fully under this app's own control).
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
    coalesce(new.raw_user_meta_data ->> 'status', 'active')
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
