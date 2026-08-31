-- staff-documents Storage bucket, per TRD section 5.5 pattern (mirrors
-- Session 5's client-documents bucket exactly). Object path convention:
-- {org_id}/{staff_id}/{filename}. Also used by the training log form's
-- optional certificate upload (same bucket, same path convention).

insert into storage.buckets (id, name, public)
values ('staff-documents', 'staff-documents', false)
on conflict (id) do nothing;

create policy "managers_manage_staff_documents"
on storage.objects for all
using (
  bucket_id = 'staff-documents'
  and get_user_role() = 'manager'
  and (storage.foldername(name))[1] = get_user_org_id()::text
)
with check (
  bucket_id = 'staff-documents'
  and get_user_role() = 'manager'
  and (storage.foldername(name))[1] = get_user_org_id()::text
);
