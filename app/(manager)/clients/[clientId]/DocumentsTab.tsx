import { createClient } from "@/lib/supabase/server";
import { DocumentUpload } from "./DocumentUpload";

// Source: PRD section 4.3 (Documents tab); TRD section 5.5 (private
// bucket — signed URLs generated server-side for download)
export async function DocumentsTab({ clientId }: { clientId: string }) {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: manager } = await supabase.from("users").select("org_id").eq("id", authUser!.id).single();

  const { data: documents } = await supabase
    .from("documents")
    .select("id, name, file_url, created_at, users:uploaded_by(first_name, last_name)")
    .eq("entity_type", "client")
    .eq("entity_id", clientId)
    .order("created_at", { ascending: false });

  const withSignedUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data: signed } = await supabase.storage.from("client-documents").createSignedUrl(doc.file_url, 60);
      const uploader = Array.isArray(doc.users) ? doc.users[0] : doc.users;
      return {
        id: doc.id,
        name: doc.name,
        createdAt: doc.created_at,
        uploaderName: uploader ? `${uploader.first_name} ${uploader.last_name}` : "Unknown",
        signedUrl: signed?.signedUrl ?? null,
      };
    }),
  );

  return (
    <div>
      <div className="flex justify-end">
        <DocumentUpload clientId={clientId} orgId={manager!.org_id} />
      </div>

      {withSignedUrls.length === 0 ? (
        <p className="mt-4 text-body text-text-secondary">No documents uploaded yet.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {withSignedUrls.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded-card border border-border-default bg-card-bg py-3 px-4">
              <div className="flex items-center gap-2.5">
                <i className="ti ti-file text-[18px] text-nhs-blue" aria-hidden="true" />
                <div>
                  <p className="text-body font-medium text-text-primary">{doc.name}</p>
                  <p className="text-secondary text-text-secondary">
                    {new Date(doc.createdAt).toLocaleDateString("en-GB")} · {doc.uploaderName}
                  </p>
                </div>
              </div>
              {doc.signedUrl ? (
                <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="text-body text-nhs-blue">
                  Download
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
