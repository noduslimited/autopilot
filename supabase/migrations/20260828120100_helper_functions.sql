-- RLS helper functions
-- Source: 01 Documentation/01 Product Specifications/11 Roles and Permissions Matrix.md section 4.5

create function get_user_org_id() returns uuid as $$
  select org_id from users where id = auth.uid()
$$ language sql security definer stable;

create function get_user_role() returns text as $$
  select role from users where id = auth.uid()
$$ language sql security definer stable;
