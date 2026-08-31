"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, FieldLabel } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

// PRD's Staff Profile mockup shows an "Edit" action but no field-level
// spec exists anywhere for it. Built as the minimum needed to make the
// Overview tab's compliance fields actually enterable — there is no other
// documented way to record a DBS number/expiry, start date, or emergency
// contact for a staff member (they aren't collected at invite time, per
// PRD section 3.2's Staff Invitation Flow field list).
export function EditStaffDetailsButton({
  staffId,
  phone,
  dbsNumber,
  dbsExpiry,
  startDate,
  emergencyContactName,
  emergencyContactPhone,
}: {
  staffId: string;
  phone: string | null;
  dbsNumber: string | null;
  dbsExpiry: string | null;
  startDate: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone: phone ?? "",
    dbsNumber: dbsNumber ?? "",
    dbsExpiry: dbsExpiry ?? "",
    startDate: startDate ?? "",
    emergencyContactName: emergencyContactName ?? "",
    emergencyContactPhone: emergencyContactPhone ?? "",
  });

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const supabase = createClient();
    await supabase
      .from("staff")
      .update({
        dbs_number: form.dbsNumber.trim() || null,
        dbs_expiry: form.dbsExpiry || null,
        start_date: form.startDate || null,
        emergency_contact_name: form.emergencyContactName.trim() || null,
        emergency_contact_phone: form.emergencyContactPhone.trim() || null,
      })
      .eq("id", staffId);

    await supabase.from("users").update({ phone: form.phone.trim() || null }).eq("id", staffId);

    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSave} className="space-y-3">
          <h2 className="text-section-heading text-text-primary">Edit staff details</h2>
          <div>
            <FieldLabel>Phone</FieldLabel>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>DBS number</FieldLabel>
            <Input value={form.dbsNumber} onChange={(e) => setForm((f) => ({ ...f, dbsNumber: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>DBS expiry</FieldLabel>
            <Input type="date" value={form.dbsExpiry} onChange={(e) => setForm((f) => ({ ...f, dbsExpiry: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>Start date</FieldLabel>
            <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>Emergency contact name</FieldLabel>
            <Input
              value={form.emergencyContactName}
              onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel>Emergency contact phone</FieldLabel>
            <Input
              value={form.emergencyContactPhone}
              onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
