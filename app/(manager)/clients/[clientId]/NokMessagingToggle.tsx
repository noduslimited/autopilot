"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Toggle } from "@/components/ui/Toggle";

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
      <Toggle checked={enabled} onChange={handleToggle} disabled={saving} />
    </div>
  );
}
