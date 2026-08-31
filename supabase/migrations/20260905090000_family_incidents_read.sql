-- Source: PRD section 6.4 (Visit History — "Red dot: visit with incident
-- filed", full incident-styled card with description). No RLS policy
-- anywhere grants family_nok read access to `incidents` — the Roles &
-- Permissions Matrix's own example SQL for this table only covers
-- managers and carers, and section 3.12's capability table doesn't list
-- an incidents row either, but the family Visit History feature this
-- session builds cannot show incident-flagged visits without it. Follows
-- the same client_id-scoping pattern already used for every other
-- family-facing table (clients, visits, care_plans, messages).
create policy "family_client_incidents" on incidents
  for select using (
    client_id in (select client_id from family_nok where user_id = auth.uid())
  );
