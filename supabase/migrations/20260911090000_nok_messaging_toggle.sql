-- Source: Gokul, direct request 2026-09-02. A manager-controlled per-client
-- toggle for whether the NOK/family portal can message the care team at
-- all for that client. Enforced at the database level (not just hidden in
-- the UI) via a RESTRICTIVE policy layered on top of the existing
-- permissive family_own_message_thread policy — RESTRICTIVE policies AND
-- with permissive ones rather than OR, so this narrows access without
-- needing to touch that already-deployed policy. Scoped to family_nok
-- senders only via get_user_role() — a manager can still message a client
-- internally even when the family-facing toggle is off, since the toggle
-- is specifically "can the family use messaging", not "freeze this
-- client's whole thread".
alter table clients
  add column nok_messaging_enabled boolean not null default true;

create policy "family_messaging_requires_enabled" on messages
  as restrictive
  for insert
  with check (
    get_user_role() != 'family_nok'
    or client_id in (select id from clients where nok_messaging_enabled = true)
  );
