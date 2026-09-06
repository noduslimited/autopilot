-- Source: real production bug, found live 2026-09-04/05 while verifying
-- the shift-swap approval flow (CLAUDE.md carer mobile portal session).
--
-- clients RLS only ever let a carer see a client whose OWN
-- assigned_carer_id points at them (carers_assigned_clients policy,
-- 20260828121100). Approving a shift swap deliberately does NOT change
-- clients.assigned_carer_id — a one-day swap is not a permanent
-- reassignment of who "owns" that client day to day — but it does move
-- the visits row's assigned_carer_id to the covering carer. That carer's
-- own visits query (Schedule, My Day) then legitimately returns the
-- covering visit, but its embedded clients(...) join gets silently
-- blocked by RLS and resolves to null, which crashed the page rendering
-- visit.client.first_name (a genuine 500, confirmed via a real console
-- error: "TypeError: Cannot read properties of null (reading
-- 'first_name')"). This is systemic, not swap-specific — any carer
-- covering any reassigned visit (including a future fix to the
-- documented drag-shift-doesn't-move-visits gap) would hit the same
-- crash the moment the covering carer isn't the client's permanent one.
--
-- Fix: an additional (not replacing) permissive SELECT policy — a carer
-- can also see a client's basic record if they have a real, non-
-- cancelled visit assigned to them for that client, regardless of the
-- client's own assigned_carer_id. Permissive policies OR together, so
-- this only ever widens access for exactly this "covering someone
-- else's client for a real visit" case, never narrows the existing rule.
create policy "carers_covering_visit_clients" on clients
  for select using (
    get_user_role() = 'carer'
    and exists (
      select 1 from visits
      where visits.client_id = clients.id
        and visits.assigned_carer_id = auth.uid()
        and visits.status != 'cancelled'
    )
  );
