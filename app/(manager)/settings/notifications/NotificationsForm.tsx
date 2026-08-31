"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TOGGLES: { key: string; label: string }[] = [
  { key: "unassigned_visit_alerts", label: "Unassigned visit alerts" },
  { key: "incident_filed_by_carer", label: "Incident filed by carer" },
  { key: "training_expiry_alerts", label: "Training expiry alerts" },
  { key: "dbs_expiry_alerts", label: "DBS expiry alerts" },
  { key: "invoice_overdue", label: "Invoice overdue" },
];

// Toggles save immediately on change (no separate "Save" step) — matches
// the mockup's plain on/off switches with no adjacent save button for
// this specific section.
export function NotificationsForm({ orgId, initialSettings }: { orgId: string; initialSettings: Record<string, boolean> }) {
  const [settings, setSettings] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    for (const t of TOGGLES) defaults[t.key] = initialSettings[t.key] ?? true;
    return defaults;
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function handleToggle(key: string) {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSavingKey(key);
    const supabase = createClient();
    await supabase.from("organisations").update({ notification_settings: next }).eq("id", orgId);
    setSavingKey(null);
  }

  return (
    <div className="rounded-card border border-border-default bg-card-bg py-4 px-5">
      <h1 className="text-page-heading text-text-primary">Notifications</h1>
      <p className="mt-1 text-secondary text-text-secondary">Email notifications</p>

      <div className="mt-4 divide-y divide-border-default">
        {TOGGLES.map((toggle) => (
          <div key={toggle.key} className="flex items-center justify-between py-3">
            <span className="text-body text-text-primary">{toggle.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings[toggle.key]}
              onClick={() => handleToggle(toggle.key)}
              disabled={savingKey === toggle.key}
              className={[
                "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
                settings[toggle.key] ? "bg-nhs-blue" : "bg-border-default",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                  settings[toggle.key] ? "translate-x-[22px]" : "translate-x-0.5",
                ].join(" ")}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
