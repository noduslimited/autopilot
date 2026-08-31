"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

const CARE_TYPE_OPTIONS = [
  { value: "domiciliary", label: "Domiciliary" },
  { value: "residential", label: "Residential" },
  { value: "supported_living", label: "Supported living" },
];

export function CareTypesForm({ orgId, initialCareTypes }: { orgId: string; initialCareTypes: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initialCareTypes);
  const [saving, setSaving] = useState(false);
  const [savedConfirmation, setSavedConfirmation] = useState(false);

  function toggle(value: string) {
    setSelected((current) => (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]));
    setSavedConfirmation(false);
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("organisations").update({ care_types: selected }).eq("id", orgId);
    setSaving(false);
    setSavedConfirmation(true);
    router.refresh();
  }

  return (
    <div className="rounded-card border border-border-default bg-card-bg py-4 px-5">
      <h1 className="text-page-heading text-text-primary">Care types</h1>
      <p className="mt-1 text-secondary text-text-secondary">Care types currently offered. Used to filter relevant features.</p>

      <div className="mt-4 space-y-2">
        {CARE_TYPE_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-body text-text-primary">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
              className="h-4 w-4 accent-nhs-blue"
            />
            {option.label}
          </label>
        ))}
      </div>

      {savedConfirmation ? <p className="mt-3 text-body text-success-green-text">Changes saved.</p> : null}

      <div className="mt-4 border-t border-border-default pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
