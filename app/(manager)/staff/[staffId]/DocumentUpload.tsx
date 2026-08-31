"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function DocumentUpload({ staffId, orgId }: { staffId: string; orgId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = `${orgId}/${staffId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("staff-documents").upload(path, file);

    if (uploadError) {
      setError("Could not upload the file. Please try again.");
      setUploading(false);
      return;
    }

    await supabase.from("documents").insert({
      org_id: orgId,
      entity_type: "staff",
      entity_id: staffId,
      name: file.name,
      file_url: path,
      file_type: file.type || null,
      uploaded_by: user!.id,
    });

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <input ref={inputRef} type="file" onChange={handleFileChange} className="hidden" id="staff-doc-upload" />
      <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? "Uploading…" : "Upload document"}
      </Button>
      {error ? <p className="mt-2 text-secondary text-nhs-red">{error}</p> : null}
    </div>
  );
}
