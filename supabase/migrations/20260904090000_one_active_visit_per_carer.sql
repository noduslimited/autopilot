-- Source: Sessions.md Session 9 "Must be achieved" — "Only one visit can
-- be in-progress at a time — enforced in UI and database". A partial unique
-- index is the natural Postgres idiom: at most one row per carer can have
-- status = 'in_progress' at once, regardless of what path writes the row.
create unique index one_active_visit_per_carer
  on visits (assigned_carer_id)
  where status = 'in_progress';
