-- Source: Gokul, direct request 2026-09-04 — carer mobile portal fixes,
-- items 1 and 5. New carer-facing notification types (real shift
-- assignment/change/cancellation/reminder/request-response events, none
-- of which previously wrote to the in-app notifications table at all),
-- plus a real shift_requests table backing the "Manage my shifts"
-- self-service panel (time off / swap / sick / holiday / issue report).

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'incident_filed', 'shift_swap', 'family_message', 'training_expiry',
    'dbs_expiry', 'invoice_overdue', 'unassigned_visit',
    'care_plan_updated', 'message_from_care_team', 'visit_wellbeing_concern',
    'shift_assigned', 'shift_changed', 'shift_cancelled', 'shift_reminder',
    'shift_request_created', 'shift_request_response'
  ));

-- =========================================================================
-- Real shift-lifecycle notifications for carers. rota_shifts has never had
-- any trigger writing to `notifications` at all — a carer assigned a new
-- shift, or an existing one changed/removed, previously had no in-app
-- record of it whatsoever (only the push-reminder mechanism, separately,
-- for shifts already on the books). shift_type transitions TO
-- sick_leave/annual_leave are deliberately excluded here — those are
-- always driven by the new shift_requests approval flow below, which
-- fires its own, more specific "your request was approved" notification;
-- generating a second, generic "your shift changed" notification for the
-- same event would just be noise.
-- =========================================================================
create or replace function notify_carer_on_shift_assigned() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.shift_type in ('weekday', 'weekend') then
    insert into notifications (org_id, user_id, type, title, body, link)
    values (
      new.org_id, new.staff_id, 'shift_assigned',
      'New shift assigned',
      'You''ve been assigned a shift on ' || to_char(new.shift_date, 'DD Mon YYYY') ||
        case when new.start_time is not null then ' at ' || to_char(new.start_time, 'HH24:MI') else '' end || '.',
      '/schedule?date=' || new.shift_date::text
    );
  end if;
  return new;
end;
$$;

create trigger notify_carer_on_shift_assigned_trigger
  after insert on rota_shifts
  for each row execute function notify_carer_on_shift_assigned();

create or replace function notify_carer_on_shift_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- A working shift's own time/date moved.
  if new.shift_type in ('weekday', 'weekend') and old.shift_type in ('weekday', 'weekend')
     and (new.shift_date is distinct from old.shift_date or new.start_time is distinct from old.start_time or new.end_time is distinct from old.end_time) then
    insert into notifications (org_id, user_id, type, title, body, link)
    values (
      new.org_id, new.staff_id, 'shift_changed',
      'Shift changed',
      'Your shift on ' || to_char(new.shift_date, 'DD Mon YYYY') || ' has been updated by your manager.',
      '/schedule?date=' || new.shift_date::text
    );
  -- A working shift was turned into a plain "off" day by the manager
  -- directly (not via an approved sick/leave request, which has its own
  -- notification — see below).
  elsif old.shift_type in ('weekday', 'weekend') and new.shift_type = 'off' then
    insert into notifications (org_id, user_id, type, title, body, link)
    values (
      new.org_id, new.staff_id, 'shift_cancelled',
      'Shift cancelled',
      'Your shift on ' || to_char(old.shift_date, 'DD Mon YYYY') || ' has been cancelled by your manager.',
      '/schedule?date=' || old.shift_date::text
    );
  end if;
  return new;
end;
$$;

create trigger notify_carer_on_shift_changed_trigger
  after update on rota_shifts
  for each row execute function notify_carer_on_shift_changed();

-- =========================================================================
-- shift_requests — the carer self-service panel's backing table (item 5).
-- Column set matches Gokul's own spec exactly, plus one small documented
-- addition: `category`, reused across two request types for their own
-- short dropdown value (time_off's Holiday/Personal/Medical/Family/Other
-- reason; shift_issue's Wrong time/Wrong client/etc issue type) — both are
-- structurally the same "short classifying label" concept, so one column
-- covers both rather than adding two near-identical ones outside the
-- listed column set.
-- =========================================================================
create table shift_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations (id) on delete cascade,
  staff_id uuid not null references staff (id) on delete cascade,
  request_type text not null check (request_type in ('time_off', 'holiday', 'sick', 'shift_swap', 'shift_issue')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  date_from date not null,
  date_to date,
  category text,
  notes text,
  swap_with_staff_id uuid references staff (id),
  shift_id uuid references rota_shifts (id) on delete set null,
  requested_at timestamptz not null default now(),
  actioned_by uuid references users (id),
  actioned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shift_requests_org_id_idx on shift_requests (org_id);
create index shift_requests_staff_id_idx on shift_requests (staff_id);
create index shift_requests_org_status_idx on shift_requests (org_id, status);

create trigger shift_requests_set_updated_at
  before update on shift_requests
  for each row execute function set_updated_at();

alter table shift_requests enable row level security;

-- Carers: see and create only their own requests.
create policy "carers_view_own_requests" on shift_requests
  for select using (staff_id = auth.uid());

create policy "carers_create_own_requests" on shift_requests
  for insert with check (staff_id = auth.uid() and org_id = get_user_org_id());

-- Managers: see and action every request in their org.
create policy "managers_view_org_requests" on shift_requests
  for select using (org_id = get_user_org_id() and get_user_role() = 'manager');

create policy "managers_update_org_requests" on shift_requests
  for update using (org_id = get_user_org_id() and get_user_role() = 'manager');

-- Notify the carer (and, for an approved swap, the colleague too) the
-- moment a manager actions their request. The actual rota_shifts/visits
-- side-effects (moving a swapped shift, marking sick-leave days, etc.)
-- happen in application code (app/api/shift-requests/[id]/action/
-- route.ts) rather than here — those need real conflict-checking and
-- user-facing error handling a trigger can't give, matching this
-- project's existing split between "trigger for a simple notification"
-- and "application code for anything with real business logic."
create or replace function notify_on_shift_request_response() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_staff_name text;
  v_decision text;
begin
  if new.status in ('approved', 'declined') and old.status = 'pending' then
    v_decision := case when new.status = 'approved' then 'approved' else 'declined' end;

    insert into notifications (org_id, user_id, type, title, body, link)
    values (
      new.org_id, new.staff_id, 'shift_request_response',
      'Request ' || v_decision,
      'Your ' || replace(new.request_type, '_', ' ') || ' request has been ' || v_decision || '.',
      '/schedule'
    );

    if new.request_type = 'shift_swap' and new.status = 'approved' and new.swap_with_staff_id is not null then
      select coalesce(u.first_name, '') into v_staff_name from users u where u.id = new.staff_id;
      insert into notifications (org_id, user_id, type, title, body, link)
      values (
        new.org_id, new.swap_with_staff_id, 'shift_request_response',
        'Shift swap confirmed',
        'A shift on ' || to_char(new.date_from, 'DD Mon YYYY') || ' has been added to your schedule as part of a swap with ' || coalesce(v_staff_name, 'a colleague') || '.',
        '/schedule?date=' || new.date_from::text
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger notify_on_shift_request_response_trigger
  after update on shift_requests
  for each row execute function notify_on_shift_request_response();
