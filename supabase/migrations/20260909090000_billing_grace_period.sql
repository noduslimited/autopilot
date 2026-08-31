-- Source: Gokul, direct request (2026-08-31, ahead of Session 13) —
-- payment_failed/suspended orgs get 48 hours from the moment the billing
-- issue began before manager routes are restricted, not an immediate
-- lockout. `updated_at` can't be reused for this — any unrelated org
-- update (e.g. a Settings change) would silently reset the clock — so a
-- dedicated timestamp is needed, set only on the actual status
-- transition and cleared when the org returns to active.
alter table organisations add column billing_issue_started_at timestamptz;
