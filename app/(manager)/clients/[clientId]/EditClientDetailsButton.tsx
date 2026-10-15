"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, FieldLabel } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

// Edit a client's personal / contact / package details after creation
// (Sessions.md Session 5: "Edit functionality working on personal
// details"). Care-plan and risk fields are edited from the Care Plan tab.
export interface EditableClient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nhs_number: string | null;
  address: string;
  care_type: string;
  assigned_carer_id: string | null;
  visit_frequency: string | null;
  visit_duration_minutes: number | null;
  nok_name: string | null;
  nok_relationship: string | null;
  nok_email: string | null;
  nok_phone: string | null;
  gp_name: string | null;
  gp_practice: string | null;
  gp_phone: string | null;
  status: string;
}

type Form = Record<keyof Omit<EditableClient, "id" | "visit_duration_minutes">, string> & { visit_duration_minutes: string };

function toForm(c: EditableClient): Form {
  return {
    first_name: c.first_name, last_name: c.last_name, date_of_birth: c.date_of_birth, nhs_number: c.nhs_number ?? "",
    address: c.address, care_type: c.care_type, assigned_carer_id: c.assigned_carer_id ?? "", visit_frequency: c.visit_frequency ?? "",
    visit_duration_minutes: c.visit_duration_minutes ? String(c.visit_duration_minutes) : "", nok_name: c.nok_name ?? "",
    nok_relationship: c.nok_relationship ?? "", nok_email: c.nok_email ?? "", nok_phone: c.nok_phone ?? "", gp_name: c.gp_name ?? "",
    gp_practice: c.gp_practice ?? "", gp_phone: c.gp_phone ?? "", status: c.status,
  };
}

export function EditClientDetailsButton({
  client,
  carers,
  autoOpen = false,
}: {
  client: EditableClient;
  carers: { id: string; name: string }[];
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [form, setForm] = useState<Form>(toForm(client));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function close() {
    setOpen(false);
    setError(null);
    setForm(toForm(client));
    // Drop ?edit=1 so a refresh doesn't reopen the modal.
    if (autoOpen) router.replace(window.location.pathname + window.location.search.replace(/[?&]edit=1/, "").replace(/^&/, "?"));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.date_of_birth || !form.address.trim()) {
      setError("First name, last name, date of birth and address are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("clients")
      .update({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth,
        nhs_number: form.nhs_number.trim() || null,
        address: form.address.trim(),
        care_type: form.care_type,
        assigned_carer_id: form.assigned_carer_id || null,
        visit_frequency: form.visit_frequency || null,
        visit_duration_minutes: form.visit_duration_minutes ? Number(form.visit_duration_minutes) : null,
        nok_name: form.nok_name.trim() || null,
        nok_relationship: form.nok_relationship || null,
        nok_email: form.nok_email.trim() || null,
        nok_phone: form.nok_phone.trim() || null,
        gp_name: form.gp_name.trim() || null,
        gp_practice: form.gp_practice.trim() || null,
        gp_phone: form.gp_phone.trim() || null,
        status: form.status,
      })
      .eq("id", client.id);
    setSaving(false);
    if (updateError) {
      setError("Could not save these changes. Please try again.");
      return;
    }
    setOpen(false);
    router.replace(`/clients/${client.id}`);
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Modal open={open} onClose={close}>
        <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-3 overflow-y-auto pr-1">
          <h2 className="text-section-heading text-text-primary">Edit client details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel required>First name</FieldLabel><Input value={form.first_name} onChange={set("first_name")} /></div>
            <div><FieldLabel required>Last name</FieldLabel><Input value={form.last_name} onChange={set("last_name")} /></div>
            <div><FieldLabel required>Date of birth</FieldLabel><Input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} /></div>
            <div><FieldLabel>NHS number</FieldLabel><Input value={form.nhs_number} onChange={set("nhs_number")} /></div>
          </div>
          <div><FieldLabel required>Home address</FieldLabel><Input value={form.address} onChange={set("address")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Care type</FieldLabel>
              <Select value={form.care_type} onChange={set("care_type")}>
                <option value="domiciliary">Domiciliary</option>
                <option value="residential">Residential</option>
                <option value="supported_living">Supported living</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Assigned carer</FieldLabel>
              <Select value={form.assigned_carer_id} onChange={set("assigned_carer_id")}>
                <option value="">No carer assigned</option>
                {carers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel>Visit frequency</FieldLabel>
              <Select value={form.visit_frequency} onChange={set("visit_frequency")}>
                <option value="">Select…</option>
                <option value="daily">Daily</option>
                <option value="twice_daily">Twice daily</option>
                <option value="three_times_daily">Three times daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Visit duration</FieldLabel>
              <Select value={form.visit_duration_minutes} onChange={set("visit_duration_minutes")}>
                <option value="">Select…</option>
                <option value="30">30 mins</option>
                <option value="45">45 mins</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </Select>
            </div>
          </div>
          <p className="pt-1 text-label font-medium text-text-secondary">Next of kin</p>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel>NOK name</FieldLabel><Input value={form.nok_name} onChange={set("nok_name")} /></div>
            <div>
              <FieldLabel>NOK relationship</FieldLabel>
              <Select value={form.nok_relationship} onChange={set("nok_relationship")}>
                <option value="">Select…</option>
                {["Son", "Daughter", "Spouse", "Partner", "Sibling", "Other"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </div>
            <div><FieldLabel>NOK email</FieldLabel><Input type="email" value={form.nok_email} onChange={set("nok_email")} /></div>
            <div><FieldLabel>NOK phone number</FieldLabel><Input value={form.nok_phone} onChange={set("nok_phone")} /></div>
          </div>
          <p className="pt-1 text-label font-medium text-text-secondary">GP</p>
          <div className="grid grid-cols-3 gap-3">
            <div><FieldLabel>GP name</FieldLabel><Input value={form.gp_name} onChange={set("gp_name")} /></div>
            <div><FieldLabel>GP practice name</FieldLabel><Input value={form.gp_practice} onChange={set("gp_practice")} /></div>
            <div><FieldLabel>GP phone number</FieldLabel><Input value={form.gp_phone} onChange={set("gp_phone")} /></div>
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <Select value={form.status} onChange={set("status")}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          {error ? <p className="text-body text-nhs-red">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
