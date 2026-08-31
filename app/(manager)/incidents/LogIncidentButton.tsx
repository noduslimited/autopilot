"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select, FieldLabel } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { IncidentClientOption } from "./IncidentsListClient";

// PRD section 4.6 shows a fully-styled "Log incident" button on the page
// header but doesn't spell out a manager-side logging form (incidents are
// normally filed by carers via the mobile "Report Incident" screen,
// Session 9) — built as a minimal version of the same fields the incident
// detail page displays, consistent with every other primary action button
// in the app having real functionality rather than being a visual stub.
export function LogIncidentButton({ clients }: { clients: IncidentClientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    incidentType: "fall",
    severity: "low",
    description: "",
    gpContacted: false,
    gpNotes: "",
    actionsTaken: "",
  });

  function close() {
    setOpen(false);
    setError(null);
    setForm({ clientId: "", incidentType: "fall", severity: "low", description: "", gpContacted: false, gpNotes: "", actionsTaken: "" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.clientId || !form.description.trim()) {
      setError("Please select a client and describe what happened.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: managerRow } = await supabase.from("users").select("org_id").eq("id", user!.id).single();

    const description = form.actionsTaken.trim()
      ? `${form.description.trim()}\n\nActions taken: ${form.actionsTaken.trim()}`
      : form.description.trim();

    const { error: insertError } = await supabase.from("incidents").insert({
      org_id: managerRow!.org_id,
      incident_ref: "",
      client_id: form.clientId,
      reported_by: user!.id,
      incident_type: form.incidentType,
      severity: form.severity,
      description,
      gp_contacted: form.gpContacted,
      gp_notes: form.gpContacted ? form.gpNotes.trim() || null : null,
      status: "open",
    });

    setSaving(false);

    if (insertError) {
      setError("Could not log this incident. Please try again.");
      return;
    }

    close();
    router.refresh();
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Log incident
      </Button>

      <Modal open={open} onClose={close}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <h2 className="text-section-heading text-text-primary">Log incident</h2>
          <div>
            <FieldLabel required>Client</FieldLabel>
            <Select required value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}>
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Incident type</FieldLabel>
              <Select value={form.incidentType} onChange={(e) => setForm((f) => ({ ...f, incidentType: e.target.value }))}>
                <option value="fall">Fall</option>
                <option value="medication">Medication</option>
                <option value="behaviour">Behaviour</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <FieldLabel required>Severity</FieldLabel>
              <Select value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>
          </div>
          <div>
            <FieldLabel required>What happened</FieldLabel>
            <Textarea required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>Actions taken</FieldLabel>
            <Textarea value={form.actionsTaken} onChange={(e) => setForm((f) => ({ ...f, actionsTaken: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-body text-text-primary">
            <input
              type="checkbox"
              checked={form.gpContacted}
              onChange={(e) => setForm((f) => ({ ...f, gpContacted: e.target.checked }))}
              className="h-4 w-4 accent-nhs-blue"
            />
            GP or emergency services contacted
          </label>
          {form.gpContacted ? (
            <div>
              <FieldLabel>GP / emergency notes</FieldLabel>
              <Textarea value={form.gpNotes} onChange={(e) => setForm((f) => ({ ...f, gpNotes: e.target.value }))} />
            </div>
          ) : null}
          {error ? <p className="text-body text-nhs-red">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={saving}>
              {saving ? "Logging…" : "Log incident"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
