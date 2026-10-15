-- A carer covering a visit for a client who is not permanently assigned to
-- them (shift swap, sick-leave cover, AI cover suggestion, ad-hoc rota) could
-- already read the client (carers_covering_visit_clients, 2026-09-15) but NOT
-- the client's medications or care plan. The eMAR screen therefore showed
-- "No active medications recorded" and the medication task could be ticked
-- off without anything being recorded (found 2026-10-15 while producing the
-- user guides). These additive, read-only policies mirror the covering-client
-- rule: access only while the carer has a non-cancelled visit for that client.

create policy "carers_covering_visit_medications" on medications
  for select using (
    org_id = get_user_org_id()
    and get_user_role() = 'carer'
    and exists (
      select 1 from visits
      where visits.client_id = medications.client_id
        and visits.assigned_carer_id = auth.uid()
        and visits.status <> 'cancelled'
    )
  );

create policy "carers_covering_visit_care_plans" on care_plans
  for select using (
    org_id = get_user_org_id()
    and get_user_role() = 'carer'
    and exists (
      select 1 from visits
      where visits.client_id = care_plans.client_id
        and visits.assigned_carer_id = auth.uid()
        and visits.status <> 'cancelled'
    )
  );
