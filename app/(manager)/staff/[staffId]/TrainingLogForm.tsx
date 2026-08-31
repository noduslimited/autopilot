"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, FieldLabel } from "@/components/ui/Input";

// Source: PRD section 4.5 ("Log completed training"); Database Schema
// Document section 3.11 for renewal periods by module.
const RENEWAL_YEARS: Record<string, number> = {
  manual_handling: 1,
  medication_awareness: 1,
  fire_safety: 1,
  safeguarding_adults: 3,
  first_aid: 3,
  other: 1,
};

const MODULE_OPTIONS = [
  { value: "manual_handling", label: "Manual handling" },
  { value: "medication_awareness", label: "Medication awareness" },
  { value: "fire_safety", label: "Fire safety" },
  { value: "safeguarding_adults", label: "Safeguarding adults" },
  { value: "first_aid", label: "First aid" },
  { value: "other", label: "Other" },
];

function calculateExpiry(completedDate: string, moduleName: string): string {
  const years = RENEWAL_YEARS[moduleName] ?? 1;
  const d = new Date(`${completedDate}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function TrainingLogForm({ staffId, orgId }: { staffId: string; orgId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [moduleName, setModuleName] = useState("manual_handling");
  const [otherLabel, setOtherLabel] = useState("");
  const [completedDate, setCompletedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completedDate) return;
    if (moduleName === "other" && !otherLabel.trim()) {
      setError("Please name the training module.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let certificateUrl: string | null = null;
    const file = fileRef.current?.files?.[0];
    if (file) {
      const path = `${orgId}/${staffId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("staff-documents").upload(path, file);
      if (!uploadError) certificateUrl = path;
    }

    const { error: insertError } = await supabase.from("training_records").insert({
      staff_id: staffId,
      org_id: orgId,
      module_name: moduleName,
      module_label: moduleName === "other" ? otherLabel.trim() : MODULE_OPTIONS.find((m) => m.value === moduleName)!.label,
      completed_date: completedDate,
      expiry_date: calculateExpiry(completedDate, moduleName),
      renewal_period_years: RENEWAL_YEARS[moduleName] ?? 1,
      certificate_url: certificateUrl,
      logged_by: user!.id,
    });

    setSaving(false);

    if (insertError) {
      setError("Could not log this training record. Please try again.");
      return;
    }

    setCompletedDate("");
    setOtherLabel("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
      <h2 className="text-subsection-heading text-text-primary">Log completed training</h2>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <FieldLabel required>Training module</FieldLabel>
          <Select value={moduleName} onChange={(e) => setModuleName(e.target.value)}>
            {MODULE_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        {moduleName === "other" ? (
          <div>
            <FieldLabel required>Module name</FieldLabel>
            <Input value={otherLabel} onChange={(e) => setOtherLabel(e.target.value)} />
          </div>
        ) : null}
        <div>
          <FieldLabel required>Date completed</FieldLabel>
          <Input type="date" required value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Certificate (optional)</FieldLabel>
          <input ref={fileRef} type="file" accept="application/pdf" className="text-body text-text-secondary" />
        </div>
        {completedDate ? (
          <p className="text-secondary text-text-secondary">
            Expiry date is calculated automatically: {calculateExpiry(completedDate, moduleName)} ({RENEWAL_YEARS[moduleName]} year
            {RENEWAL_YEARS[moduleName] === 1 ? "" : "s"}).
          </p>
        ) : null}
        {error ? <p className="text-body text-nhs-red">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Logging…" : "Log training"}
          </Button>
        </div>
      </form>
    </div>
  );
}
