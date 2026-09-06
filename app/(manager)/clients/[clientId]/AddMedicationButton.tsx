"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, FieldLabel } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export function AddMedicationButton({ clientId, orgId }: { clientId: string; orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", dose: "", frequency: "", prescribedBy: "" });

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const supabase = createClient();
    await supabase.from("medications").insert({
      org_id: orgId,
      client_id: clientId,
      medication_name: form.name.trim(),
      dose: form.dose.trim(),
      frequency: form.frequency.trim(),
      prescribed_by: form.prescribedBy.trim() || null,
    });

    setSaving(false);
    setOpen(false);
    setForm({ name: "", dose: "", frequency: "", prescribedBy: "" });
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add medication</Button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSave} className="space-y-3">
          <h2 className="text-section-heading text-text-primary">Add medication</h2>
          <div>
            <FieldLabel required>Medication name</FieldLabel>
            <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <FieldLabel required>Dose</FieldLabel>
            <Input required placeholder="e.g. 5mg" value={form.dose} onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))} />
          </div>
          <div>
            <FieldLabel required>Frequency</FieldLabel>
            <Input required placeholder="e.g. Twice daily with food" value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>Prescribed by</FieldLabel>
            <Input value={form.prescribedBy} onChange={(e) => setForm((f) => ({ ...f, prescribedBy: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? "Saving…" : "Save medication"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
