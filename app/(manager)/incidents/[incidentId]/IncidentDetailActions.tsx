"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Modal";

export function IncidentDetailActions({
  incidentId,
  incidentRef,
  status,
  managerNotes,
  autoOpenSignOff = false,
}: {
  incidentId: string;
  incidentRef: string;
  status: "open" | "closed";
  managerNotes: string | null;
  autoOpenSignOff?: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(managerNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirmSignOff, setConfirmSignOff] = useState(autoOpenSignOff && status === "open");
  const [signingOff, setSigningOff] = useState(false);

  async function handleSaveNotes() {
    setSavingNotes(true);
    const supabase = createClient();
    await supabase.from("incidents").update({ manager_notes: notes.trim() || null }).eq("id", incidentId);
    setSavingNotes(false);
    router.refresh();
  }

  async function handleSignOff() {
    setSigningOff(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase
      .from("incidents")
      .update({ status: "closed", signed_off_by: user!.id, signed_off_at: new Date().toISOString() })
      .eq("id", incidentId);

    setSigningOff(false);
    setConfirmSignOff(false);
    router.refresh();
  }

  return (
    <>
      <div className="mt-4 rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Manager notes</h2>
        <Textarea
          className="mt-2"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={status === "closed"}
          placeholder={status === "closed" ? undefined : "Add notes on follow-up actions, conversations with family, etc."}
        />
        {status === "open" ? (
          <div className="mt-2 flex justify-end">
            <Button variant="secondary" onClick={handleSaveNotes} disabled={savingNotes}>
              {savingNotes ? "Saving…" : "Save notes"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <Button variant="secondary" onClick={() => window.print()}>
          Download report
        </Button>
        {status === "open" ? (
          <Button onClick={() => setConfirmSignOff(true)}>Sign off and close incident</Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmSignOff}
        title="Sign off and close incident?"
        message={`This will close incident ${incidentRef} and record your sign-off. This cannot be undone.`}
        confirmLabel={signingOff ? "Signing off…" : "Sign off"}
        onConfirm={handleSignOff}
        onCancel={() => setConfirmSignOff(false)}
      />
    </>
  );
}
