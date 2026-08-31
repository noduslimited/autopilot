-- org-logos: new bucket for Settings > Organisation Profile logo upload
-- (PRD section 4.10). Public, unlike client-documents/staff-documents —
-- a logo isn't sensitive PII, and public access avoids needing signed
-- URLs everywhere a logo might be displayed (invoice PDFs, the sidebar,
-- print output). Path convention: {org_id}/{filename}, matching every
-- other Storage bucket's org-scoping pattern in this project.
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

create policy "managers_manage_org_logo"
on storage.objects for all
using (
  bucket_id = 'org-logos'
  and get_user_role() = 'manager'
  and (storage.foldername(name))[1] = get_user_org_id()::text
)
with check (
  bucket_id = 'org-logos'
  and get_user_role() = 'manager'
  and (storage.foldername(name))[1] = get_user_org_id()::text
);

create policy "public_read_org_logos"
on storage.objects for select
using (bucket_id = 'org-logos');
