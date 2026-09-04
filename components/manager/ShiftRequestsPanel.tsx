"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/Modal";

// Source: Gokul, direct request 2026-09-04 — carer mobile portal item 5's
// manager side. Shared between the Rota page's org-wide "Shift requests"
// section and the Staff Profile Schedule tab's per-carer pending list —
// same row shape, same approve/decline action, just a different query
// scoping it (org-wide vs. one staff member) server-side before this
// component ever sees the data.
export interface ShiftRequestRow {
  id: string;
  staffName: string;
  requestType: "time_off" | "holiday" | "sick" | "shift_swap" | "shift_issue";
  dateFrom: string;
  dateTo: string | null;
  category: string | null;
  notes: string | null;
  swapWithName: string | null;
  requestedAt: string;
}

const TYPE_LABEL: Record<ShiftRequestRow["requestType"], { label: string; variant: BadgeVariant }> = {
  time_off: { label: "Time off", variant: "pending" },
  holiday: { label: "Holiday", variant: "dueSoon" },
  sick: { label: "Sick", variant: "atRisk" },
  shift_swap: { label: "Shift swap", variant: "notStarted" },
  shift_issue: { label: "Shift issue", variant: "atRisk" },
};

function dateRangeLabel(from: string, to: string | null): string {
  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (!to || to === from) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

export function ShiftRequestsPanel({ requests, emptyMessage }: { requests: ShiftRequestRow[]; emptyMessage: string }) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<ShiftRequestRow | null>(null);
  const [errorFor, setErrorFor] = useState<{ id: string; message: string } | null>(null);

  async function act(id: string, decision: "approved" | "declined") {
    setActingId(id);
    setErrorFor(null);
    const response = await fetch(`/api/shift-requests/${id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    }).catch(() => null);
    setActingId(null);
    setDeclineTarget(null);

    if (!response?.ok) {
      const data = await response?.json().catch(() => null);
      setErrorFor({ id, message: data?.error ?? "Could not action this request. Please try again." });
      return;
    }
    router.refresh();
  }

  if (requests.length === 0) {
    return <p className="text-body text-text-secondary">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2.5">
      {requests.map((req) => {
        const type = TYPE_LABEL[req.requestType];
        return (
          <div key={req.id} className="rounded-input border border-border-default bg-card-bg p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Badge variant={type.variant}>{type.label}</Badge>
                {req.staffName ? <p className="text-body font-medium text-text-primary">{req.staffName}</p> : null}
              </div>
              <p className="text-secondary text-text-secondary">{dateRangeLabel(req.dateFrom, req.dateTo)}</p>
            </div>
            {req.category ? <p className="mt-1 text-secondary text-text-secondary">{req.category}</p> : null}
            {req.swapWithName ? <p className="mt-1 text-secondary text-text-secondary">Swap with: {req.swapWithName}</p> : null}
            {req.notes ? <p className="mt-1 text-body text-text-primary">{req.notes}</p> : null}
            {errorFor?.id === req.id ? <p className="mt-1.5 text-secondary text-nhs-red">{errorFor.message}</p> : null}
            <div className="mt-2.5 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setDeclineTarget(req)}
                disabled={actingId === req.id}
                className="rounded-btn border border-border-default bg-card-bg px-3 py-[6px] text-[12px] font-medium text-text-primary disabled:opacity-50"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => act(req.id, "approved")}
                disabled={actingId === req.id}
                className="rounded-btn bg-nhs-green px-3 py-[6px] text-[12px] font-medium text-white disabled:opacity-50"
              >
                {actingId === req.id ? "…" : "Approve"}
              </button>
            </div>
          </div>
        );
      })}

      <ConfirmDialog
        open={!!declineTarget}
        title="Decline this request?"
        message={declineTarget ? `Decline ${declineTarget.staffName}'s ${TYPE_LABEL[declineTarget.requestType].label.toLowerCase()} request? They'll be notified.` : ""}
        confirmLabel="Decline"
        onConfirm={() => declineTarget && act(declineTarget.id, "declined")}
        onCancel={() => setDeclineTarget(null)}
      />
    </div>
  );
}
