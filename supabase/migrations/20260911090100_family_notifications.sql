-- Source: Gokul, direct request 2026-09-02 (NOK portal notification bell).
-- Four family-facing notification types, generated via triggers on the
-- source tables rather than scattered API-route/client-component changes
-- — same pattern this project already uses for id-ref generation and
-- audit_logs, and more robust here since it fires regardless of which
-- application code path creates/updates the underlying row (including
-- the AI care-plan-suggestion accept flow, which doesn't go through a
-- single obvious call site). All four are security definer, matching
-- log_audit()'s established precedent for writing into a table that has
-- no direct INSERT policy for regular roles.
--
-- notifications.type gets three new values; the existing 'incident_filed'
-- type is reused as-is for the family-facing incident notification
-- (same event, just an additional recipient — no need for a new type).
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'incident_filed', 'shift_swap', 'family_message', 'training_expiry',
    'dbs_expiry', 'invoice_overdue', 'unassigned_visit',
    'care_plan_updated', 'message_from_care_team', 'visit_wellbeing_concern'
  ));

create or replace function notify_family_on_incident() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_client_name text;
begin
  select first_name into v_client_name from clients where id = new.client_id;
  insert into notifications (org_id, user_id, type, title, body, link)
  select new.org_id, fn.user_id, 'incident_filed',
    'Incident reported',
    'A ' || new.incident_type || ' incident has been reported for ' || coalesce(v_client_name, 'your family member') || '.',
    '/family/overview'
  from family_nok fn where fn.client_id = new.client_id;
  return new;
end;
$$;

create trigger notify_family_on_incident_trigger
  after insert on incidents
  for each row execute function notify_family_on_incident();

create or replace function notify_family_on_care_plan_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_client_name text;
begin
  select first_name into v_client_name from clients where id = new.client_id;
  insert into notifications (org_id, user_id, type, title, body, link)
  select new.org_id, fn.user_id, 'care_plan_updated',
    'Care plan updated',
    coalesce(v_client_name, 'Your family member') || '''s care plan has been reviewed and updated.',
    '/family/care-plan'
  from family_nok fn where fn.client_id = new.client_id;
  return new;
end;
$$;

create trigger notify_family_on_care_plan_update_trigger
  after update on care_plans
  for each row execute function notify_family_on_care_plan_update();

-- Insert-only, and gated to manager/carer senders — a family member's own
-- message already notifies the manager via app code (Session 12); this is
-- specifically the reverse direction. Naturally respects the messaging
-- toggle above with no extra logic needed: if messaging is disabled for a
-- client, the RESTRICTIVE policy blocks the insert before this trigger
-- would ever fire.
create or replace function notify_family_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sender_role in ('manager', 'carer') then
    insert into notifications (org_id, user_id, type, title, body, link)
    select new.org_id, fn.user_id, 'message_from_care_team',
      'New message from the care team',
      left(new.body, 140),
      '/family/messages'
    from family_nok fn where fn.client_id = new.client_id;
  end if;
  return new;
end;
$$;

create trigger notify_family_on_message_trigger
  after insert on messages
  for each row execute function notify_family_on_message();

create or replace function notify_family_on_poor_wellbeing() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_client_name text;
begin
  if new.wellbeing_rating = 'poor' and (old.wellbeing_rating is distinct from 'poor') then
    select first_name into v_client_name from clients where id = new.client_id;
    insert into notifications (org_id, user_id, type, title, body, link)
    select new.org_id, fn.user_id, 'visit_wellbeing_concern',
      'Wellbeing check',
      coalesce(v_client_name, 'Your family member') || '''s wellbeing was rated as poor during a recent visit. Please contact the care team if you have any concerns.',
      '/family/overview'
    from family_nok fn where fn.client_id = new.client_id;
  end if;
  return new;
end;
$$;

create trigger notify_family_on_poor_wellbeing_trigger
  after update on visits
  for each row execute function notify_family_on_poor_wellbeing();
