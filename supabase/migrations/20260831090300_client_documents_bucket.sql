-- client-documents Storage bucket, per TRD section 5.5 ("Client documents
-- (bucket: client-documents, private)"). Object path convention:
-- {org_id}/{client_id}/{filename} — RLS policies below scope access to
-- the manager's own org by checking the first path segment.

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

create policy "managers_manage_client_documents"
on storage.objects for all
using (
  bucket_id = 'client-documents'
  and get_user_role() = 'manager'
  and (storage.foldername(name))[1] = get_user_org_id()::text
)
with check (
  bucket_id = 'client-documents'
  and get_user_role() = 'manager'
  and (storage.foldername(name))[1] = get_user_org_id()::text
);
