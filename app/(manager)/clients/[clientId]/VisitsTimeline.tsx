"use client";

import { useMemo, useState } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

export interface VisitTimelineItem {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  carerName: string;
  tasksTotal: number;
  tasksCompleted: number;
  notes: string | null;
  hasIncident: boolean;
}

const STATUS_BADGE: Record<string, BadgeVariant> = {
  completed: "completed",
  in_progress: "inProgress",
  scheduled: "notStarted",
  missed: "atRisk",
  cancelled: "draft",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTimeRange(start: string, end: string): string {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function VisitsTimeline({ visits }: { visits: VisitTimelineItem[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return visits.filter((visit) => {
      const date = visit.scheduledStart.slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  }, [visits, from, to]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-secondary text-text-secondary">From</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-input border border-border-default bg-card-bg px-3 py-[7px] text-body text-text-primary" />
        <label className="text-secondary text-text-secondary">To</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-input border border-border-default bg-card-bg px-3 py-[7px] text-body text-text-primary" />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 text-body text-text-secondary">No visits recorded for this period.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((visit) => (
            <div
              key={visit.id}
              className={[
                "rounded-card border py-3 px-4",
                visit.hasIncident ? "border-danger-red-border bg-danger-red-light" : "border-border-default bg-card-bg",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-body font-medium text-text-primary">
                    {formatDate(visit.scheduledStart)} · {formatTimeRange(visit.scheduledStart, visit.scheduledEnd)}
                  </p>
                  <p className="text-secondary text-text-secondary">
                    {visit.carerName} · {visit.tasksCompleted}/{visit.tasksTotal} tasks
                    {visit.hasIncident ? " · incident" : ""}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[visit.status] ?? "notStarted"}>{visit.status.replace("_", " ")}</Badge>
              </div>
              {visit.notes ? <p className="mt-2 text-body text-text-primary">{visit.notes}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
