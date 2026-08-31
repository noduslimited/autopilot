-- Extends handle_new_auth_user() (Session 1/2, extended for family_nok in
-- Session 5) to also create the staff row when an invited user's metadata
-- carries a staff_role key. Mirrors the family_nok pattern exactly:
--
-- users.role is the portal-access level (manager/carer/family_nok/
-- service_user — no senior_carer, since a senior carer uses the same /my-day
-- carer portal as any other carer). staff.role is the care-sector job title
-- (carer/senior_carer/manager per Database Schema Document 3.10) used for
-- compliance-list display. The invite-staff route sets both: users.role
-- from the PRD 3.2 dropdown collapsed to carer/manager, and staff_role
-- carrying the literal dropdown value (carer/senior_carer/manager) so this
-- trigger knows which one to store on staff.role — and, by its mere
-- presence, that this signup came through the staff-invite flow at all
-- (org registration also creates a users row with role='manager', but must
-- NOT get a stray staff row).
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
