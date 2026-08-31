-- Fixes a gap discovered in Session 2 testing: this project is missing the
-- schema-level GRANTs that Supabase normally provisions automatically for
-- anon/authenticated/service_role on a dashboard-created project. Without
-- them, PostgreSQL denies every query at the grant layer (error 42501)
-- before RLS is ever evaluated — RLS is the real access-control layer in
-- this app (see the policies migration); these grants are the standard
-- Supabase prerequisite that RLS then narrows. service_role also needs
-- this despite bypassing RLS, since BYPASSRLS only skips policy
-- evaluation, not the base table grant.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Applies the same grants automatically to any table/sequence/function
-- created by future migrations, so this doesn't need repeating.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
