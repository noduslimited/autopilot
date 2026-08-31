"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, FieldLabel } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Modal";

interface OrgProfile {
  id: string;
  name: string;
  cqc_number: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function OrganisationProfileForm({ org }: { org: OrgProfile }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: org.name,
    cqcNumber: org.cqc_number ?? "",
    email: org.email,
    phone: org.phone ?? "",
    address: org.address ?? "",
  });
  const [logoUrl, setLogoUrl] = useState(org.logo_url);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedConfirmation, setSavedConfirmation] = useState(false);
  const [confirmExport, setConfirmExport] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleLogoChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Logo must be a PNG or JPG image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Logo must be 2MB or smaller.");
      return;
    }

    setError(null);
    setUploadingLogo(true);
    const supabase = createClient();
    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `${org.id}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("org-logos").upload(path, file, { upsert: true });
    if (uploadError) {
      setError("Could not upload the logo. Please try again.");
      setUploadingLogo(false);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("org-logos").getPublicUrl(path);
    await supabase.from("organisations").update({ logo_url: publicUrl.publicUrl }).eq("id", org.id);

    setLogoUrl(publicUrl.publicUrl);
    setUploadingLogo(false);
    router.refresh();
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) {
      setError("Organisation name and primary contact email are required.");
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("organisations")
      .update({
        name: form.name.trim(),
        cqc_number: form.cqcNumber.trim() || null,
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      })
      .eq("id", org.id);

    setSaving(false);
    if (updateError) {
      setError("Could not save changes. Please try again.");
      return;
    }
    setSavedConfirmation(true);
    router.refresh();
  }

  function handleCancel() {
    setForm({
      name: org.name,
      cqcNumber: org.cqc_number ?? "",
      email: org.email,
      phone: org.phone ?? "",
      address: org.address ?? "",
    });
    setError(null);
    setSavedConfirmation(false);
  }

  async function handleExport() {
    setExporting(true);
    const response = await fetch("/api/export").catch(() => null);
    setExporting(false);
    setConfirmExport(false);

    if (!response || !response.ok) {
      setError("Could not generate the data export. Please try again.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `autopilot-export-${new Date().toISOString().slice(0, 10)}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-card border border-border-default bg-card-bg py-4 px-5">
      <h1 className="text-page-heading text-text-primary">Organisation profile</h1>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-input border border-dashed border-border-default bg-page-bg text-secondary text-text-muted"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Organisation logo" className="h-full w-full object-cover" />
          ) : (
            "Logo"
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} className="hidden" />
        <div>
          <p className="text-body font-medium text-text-primary">{form.name}</p>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingLogo} className="text-secondary text-nhs-blue">
            {uploadingLogo ? "Uploading…" : "Upload logo (PNG/JPG, max 2MB)"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <FieldLabel required>Organisation name</FieldLabel>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <FieldLabel>CQC registration number</FieldLabel>
          <Input value={form.cqcNumber} onChange={(e) => setForm((f) => ({ ...f, cqcNumber: e.target.value }))} />
        </div>
        <div>
          <FieldLabel required>Primary contact email</FieldLabel>
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <FieldLabel>Phone number</FieldLabel>
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <FieldLabel>Registered address</FieldLabel>
          <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
      </div>

      {error ? <p className="mt-3 text-body text-nhs-red">{error}</p> : null}
      {savedConfirmation ? <p className="mt-3 text-body text-success-green-text">Changes saved.</p> : null}

      <div className="mt-4 flex items-center justify-between border-t border-border-default pt-4">
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
        <Button variant="danger" onClick={() => setConfirmExport(true)}>
          Export all data
        </Button>
      </div>

      <ConfirmDialog
        open={confirmExport}
        title="Export all data?"
        message="This will export all client records, visit logs, staff records, incidents, and invoices as CSV files. This may take a few minutes."
        confirmLabel={exporting ? "Exporting…" : "Export"}
        onConfirm={handleExport}
        onCancel={() => setConfirmExport(false)}
      />
    </div>
  );
}
