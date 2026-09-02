"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Source: Gokul, direct request 2026-09-02. Same immediate-save toggle
// pattern already established in Settings → Notifications
// (NotificationsForm.tsx) — no separate "Save" step for a single boolean.
// When off: the family portal's Messages tab and "Message the care team"
// button both disappear (BottomNav.tsx / family/overview/page.tsx), and
// the underlying insert is additionally blocked at the RLS level for
// family_nok senders regardless of what the UI shows (migration
// 20260911090000_nok_messaging_toggle.sql) — this toggle is the single
// source of truth both layers read from.
export function NokMessagingToggle({ clientId, initialEnabled }: { clientId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    const supabase = createClient();
    await supabase.from("clients").update({ nok_messaging_enabled: next }).eq("id", clientId);
    setSaving(false);
  }

  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <p className="text-body text-text-primary">Allow NOK to message the care team</p>
        <p className="text-secondary text-text-secondary">
          When off, the family portal&apos;s Messages tab and message button are hidden for this client.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={handleToggle}
        disabled={saving}
        className={[
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
          enabled ? "bg-nhs-blue" : "bg-border-default",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
            enabled ? "translate-x-[22px]" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
