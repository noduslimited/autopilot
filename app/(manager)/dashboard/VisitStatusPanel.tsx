"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

// Source: PRD section 4.2 (Visit status panel), TRD section 5.4 (real-time subscription pattern)
interface VisitRow {
  id: string;
  client_id: string;
  assigned_carer_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  check_in_time: string | null;
  status: string;
  clients: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  users: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
}

export interface VisitStatusPanelProps {
  orgId: string;
  initialVisits: VisitRow[];
}

type DisplayStatus = "completed" | "inProgress" | "notStarted" | "atRisk";

const STATUS_ORDER: Record<DisplayStatus, number> = { atRisk: 0, inProgress: 1, notStarted: 2, completed: 3 };
const STATUS_BADGE: Record<DisplayStatus, BadgeVariant> = {
  completed: "completed",
  inProgress: "inProgress",
  notStarted: "notStarted",
  atRisk: "atRisk",
};
const STATUS_LABEL: Record<DisplayStatus, string> = {
  completed: "Completed",
  inProgress: "In progress",
  notStarted: "Not started",
  atRisk: "At risk",
};

function displayStatus(visit: VisitRow, now: Date): DisplayStatus {
  if (visit.status === "completed") return "completed";
  if (visit.status === "in_progress") return "inProgress";

  const isAtRisk =
    !visit.assigned_carer_id || (new Date(visit.scheduled_start) < now && !visit.check_in_time);
  return isAtRisk ? "atRisk" : "notStarted";
}

function personName(value: VisitRow["clients"]): string {
  const person = Array.isArray(value) ? value[0] : value;
  return person ? `${person.first_name} ${person.last_name}` : "Unassigned";
}

function timeRange(start: string, end: string): string {
  const format = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${format(start)} – ${format(end)}`;
}

export function VisitStatusPanel({ orgId, initialVisits }: VisitStatusPanelProps) {
  const [visits, setVisits] = useState(initialVisits);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`visits-today-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visits", filter: `org_id=eq.${orgId}` },
        () => {
          // Re-fetch rather than patch locally — the joined client/carer
          // names aren't present on the raw postgres_changes payload.
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  useEffect(() => {
    setVisits(initialVisits);
  }, [initialVisits]);

  const now = new Date();
  const withStatus = visits.map((visit) => ({ visit, status: displayStatus(visit, now) }));

  const counts: Record<DisplayStatus, number> = { completed: 0, inProgress: 0, notStarted: 0, atRisk: 0 };
  withStatus.forEach(({ status }) => {
    counts[status] += 1;
  });

  const sorted = [...withStatus].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const visible = sorted.slice(0, 4);

  return (
    <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
      <div className="flex items-center justify-between">
        <h2 className="text-subsection-heading text-text-primary">Today&apos;s visit status</h2>
        <span className="flex items-center gap-1 text-label text-nhs-green">
          <span className="h-1.5 w-1.5 rounded-full bg-nhs-green" /> Live
        </span>
      </div>

      {visits.length === 0 ? (
        <div className="mt-4 rounded-card bg-surface-secondary py-6 px-4 text-center">
          <p className="text-body text-text-secondary">No visits scheduled today. Use the Rota to plan next week's schedule.</p>
          <Link href="/rota" className="mt-2 inline-block text-body text-nhs-blue">
            Go to Rota
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(Object.keys(counts) as DisplayStatus[]).map((status) => (
              <div key={status} className="rounded-card bg-surface-secondary py-2 px-2 text-center">
                <p className="text-[16px] font-bold text-text-primary">{counts[status]}</p>
                <p className="text-tiny text-text-muted">{STATUS_LABEL[status]}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {visible.map(({ visit, status }) => (
              <Link
                key={visit.id}
                href={`/clients/${visit.client_id}`}
                className={[
                  "flex items-center justify-between rounded-card border py-2.5 px-3",
                  status === "atRisk" ? "border-danger-red-border bg-danger-red-light" : "border-border-default",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-text-primary">{personName(visit.clients)}</p>
                  <p className="truncate text-secondary text-text-secondary">
                    {personName(visit.users)} · {timeRange(visit.scheduled_start, visit.scheduled_end)}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>
              </Link>
            ))}
          </div>

          <Link href="/rota" className="mt-3 inline-block text-body text-nhs-blue">
            View all visits
          </Link>
        </>
      )}
    </div>
  );
}
