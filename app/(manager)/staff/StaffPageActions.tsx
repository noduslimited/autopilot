"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select, FieldLabel } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

// PRD section 4.5: "Add staff" and "Invite staff" are explicitly documented
// as aliases opening the same modal (section 4.5's own wording), even
// though the mockup shows them as two visually distinct buttons — built
// exactly as the mockup shows, both wired to the one modal here.
export function StaffPageActions() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", role: "carer" });

  function close() {
    setOpen(false);
    setError(null);
    setForm({ firstName: "", lastName: "", email: "", role: "carer" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const response = await fetch("/api/staff/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);

    setSaving(false);

    if (!response || !response.ok) {
      setError("Could not send the invitation. Please try again.");
      return;
    }

    // PRD section 3.2's exact confirmation copy.
    setConfirmation(
      `${form.firstName} ${form.lastName} will receive an email with a secure link to set up their account and join. The link expires in 72 hours.`,
    );
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Invite staff
        </Button>
        <Button onClick={() => setOpen(true)}>Add staff</Button>
      </div>

      <Modal open={open} onClose={close}>
        {confirmation ? (
          <div className="space-y-4">
            <h2 className="text-section-heading text-text-primary">Invitation sent</h2>
            <p className="text-body text-text-secondary">{confirmation}</p>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setConfirmation(null);
                  close();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <h2 className="text-section-heading text-text-primary">Invite staff member</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>First name</FieldLabel>
                <Input
                  required
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel required>Last name</FieldLabel>
                <Input
                  required
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <FieldLabel required>Email address</FieldLabel>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel required>Role</FieldLabel>
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="carer">Carer</option>
                <option value="senior_carer">Senior carer</option>
                <option value="manager">Manager</option>
              </Select>
            </div>
            {error ? <p className="text-body text-nhs-red">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {saving ? "Sending…" : "Send invitation"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
