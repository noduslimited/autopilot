"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Toggle } from "@/components/ui/Toggle";

const TOGGLES: { key: string; label: string }[] = [
  { key: "unassigned_visit_alerts", label: "Unassigned visit alerts" },
  { key: "incident_filed_by_carer", label: "Incident filed by carer" },
  { key: "training_expiry_alerts", label: "Training expiry alerts" },
  { key: "dbs_expiry_alerts", label: "DBS expiry alerts" },
  { key: "invoice_overdue", label: "Invoice overdue" },
];

// Real gap found: no visible way for a manager to see whether browser
// push notifications are actually enabled for this site, or an easy path
// to turn them on if not. Purely informational for the standard
// Notification permission state — this page doesn't itself send push
// notifications (that's the carer shift-notification flow, CLAUDE.md
// section 16a); this banner is about the underlying browser permission
// generally being on, since a manager with it denied/default would also
// miss any future browser-level prompts.
function NotificationPermissionBanner() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  async function handleEnable() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  if (permission === null || permission === "unsupported" || permission === "granted") return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-input border border-amber-text/20 bg-amber-light px-4 py-2.5">
      <p className="text-body text-amber-text">
        {permission === "denied"
          ? "Browser notifications are blocked for this site. Enable them in your browser's site settings to receive alerts."
          : "Browser notifications aren't enabled yet — turn them on to receive alerts as they happen."}
      </p>
      {permission === "default" ? (
        <button
          type="button"
          onClick={handleEnable}
          className="shrink-0 rounded-btn bg-nhs-blue px-3.5 py-[7px] text-[12px] font-medium text-white"
        >
          Enable notifications
        </button>
      ) : null}
    </div>
  );
}

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

      <div className="mt-4">
        <NotificationPermissionBanner />
      </div>

      <div className="divide-y divide-border-default">
        {TOGGLES.map((toggle) => (
          <div key={toggle.key} className="flex items-center justify-between py-3">
            <span className="text-body text-text-primary">{toggle.label}</span>
            <Toggle checked={settings[toggle.key]} onChange={() => handleToggle(toggle.key)} disabled={savingKey === toggle.key} />
          </div>
        ))}
      </div>
    </div>
  );
}
