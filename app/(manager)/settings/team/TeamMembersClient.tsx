"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/Modal";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "carer" | "senior_carer" | "manager";
  status: "active" | "invited" | "deactivated";
}

const ROLE_LABELS: Record<TeamMember["role"], string> = {
  carer: "Carer",
  senior_carer: "Senior carer",
  manager: "Manager",
};

const STATUS_BADGE: Record<TeamMember["status"], { label: string; variant: BadgeVariant }> = {
  active: { label: "Active", variant: "valid" },
  invited: { label: "Pending invitation", variant: "dueSoon" },
  deactivated: { label: "Deactivated", variant: "notStarted" },
};

export function TeamMembersClient({ members }: { members: TeamMember[] }) {
  const router = useRouter();
  const [deactivateTarget, setDeactivateTarget] = useState<TeamMember | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resentId, setResentId] = useState<string | null>(null);

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    const supabase = createClient();
    await supabase.from("users").update({ status: "deactivated" }).eq("id", deactivateTarget.id);
    setDeactivating(false);
    setDeactivateTarget(null);
    router.refresh();
  }

  async function handleResend(member: TeamMember) {
    setResendingId(member.id);
    const response = await fetch("/api/settings/resend-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.id }),
    }).catch(() => null);
    setResendingId(null);
    if (response && response.ok) setResentId(member.id);
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr className="border-b border-border-default text-left text-label text-text-secondary">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Role</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4" />
          </tr>
        </thead>
        <tbody>
          {members.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center text-body text-text-secondary">
                No team members yet.
              </td>
            </tr>
          ) : (
            members.map((member) => {
              const badge = STATUS_BADGE[member.status];
              return (
                <tr key={member.id} className="border-b border-border-default last:border-b-0">
                  <td className="py-2.5 pr-4">
                    <p className="text-body font-medium text-text-primary">{member.name}</p>
                    <p className="text-secondary text-text-secondary">{member.email}</p>
                  </td>
                  <td className="py-2.5 pr-4 text-body text-text-secondary">{ROLE_LABELS[member.role]}</td>
                  <td className="py-2.5 pr-4">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      {member.status === "invited" ? (
                        <button
                          type="button"
                          onClick={() => handleResend(member)}
                          disabled={resendingId === member.id}
                          className="rounded-btn border border-border-default bg-card-bg px-3 py-[6px] text-[12px] font-medium text-text-primary"
                        >
                          {resendingId === member.id ? "Resending…" : resentId === member.id ? "Sent" : "Resend invitation"}
                        </button>
                      ) : null}
                      {member.status !== "deactivated" ? (
                        <button
                          type="button"
                          onClick={() => setDeactivateTarget(member)}
                          className="rounded-btn border border-border-default bg-card-bg px-3 py-[6px] text-[12px] font-medium text-nhs-red"
                        >
                          Deactivate
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <ConfirmDialog
        open={!!deactivateTarget}
        title="Deactivate team member?"
        message={deactivateTarget ? `${deactivateTarget.name} will lose access to Autopilot. Their records will be retained.` : ""}
        confirmLabel={deactivating ? "Deactivating…" : "Deactivate"}
        danger
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  );
}
