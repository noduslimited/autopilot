-- Item 6, Gokul's direct request 2026-09-06: optional photo attachments on
-- carer-filed incident reports. New private Storage bucket, RLS-scoped to
-- org, plus the destination column on incidents itself.
--
-- Object path convention: {org_id}/{carer_id}/{timestamp}-{filename} — no
-- incident_id segment, since photos are uploaded (via the carer's own
-- RLS-scoped session, same pattern as client-documents/DocumentUpload.tsx)
-- BEFORE the incident row exists (the report-incident API route creates
-- the incident on submit, after the photos are already in Storage). The
-- resulting object paths are passed to /api/report-incident and stored
-- verbatim in incidents.photo_urls.

alter table incidents add column if not exists photo_urls text[];

insert into storage.buckets (id, name, public)
values ('incident-photos', 'incident-photos', false)
on conflict (id) do nothing;

create policy "carers_upload_incident_photos"
on storage.objects for insert
with check (
  bucket_id = 'incident-photos'
  and get_user_role() = 'carer'
  and (storage.foldername(name))[1] = get_user_org_id()::text
);

create policy "org_members_view_incident_photos"
on storage.objects for select
using (
  bucket_id = 'incident-photos'
  and (storage.foldername(name))[1] = get_user_org_id()::text
);
