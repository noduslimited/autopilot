"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { LogIncidentButton } from "./LogIncidentButton";

export interface IncidentListItem {
  id: string;
  incidentRef: string;
  clientName: string;
  incidentType: "fall" | "medication" | "behaviour" | "other";
  severity: "low" | "medium" | "high";
  description: string;
  status: "open" | "closed";
  createdAt: string;
  aiInsight: string | null;
}

export interface IncidentClientOption {
  id: string;
  first_name: string;
  last_name: string;
}

const SEVERITY_BADGE: Record<IncidentListItem["severity"], { label: string; variant: BadgeVariant }> = {
  high: { label: "HIGH PRIORITY", variant: "atRisk" },
  medium: { label: "MEDIUM", variant: "dueSoon" },
  low: { label: "LOW", variant: "valid" },
};

const TYPE_LABELS: Record<IncidentListItem["incidentType"], string> = {
  fall: "Fall",
  medication: "Medication",
  behaviour: "Behaviour",
  other: "Other",
};

export function IncidentsListClient({ incidents, clients }: { incidents: IncidentListItem[]; clients: IncidentClientOption[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = incidents.filter((i) => {
      const matchesSearch =
        query === "" || i.clientName.toLowerCase().includes(query) || i.description.toLowerCase().includes(query) || i.incidentRef.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || i.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || i.severity === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });

    // HIGH PRIORITY cards sorted first (PRD section 4.6), open before closed.
    result = [...result].sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      if (a.severity === "high" && b.severity !== "high") return -1;
      if (b.severity === "high" && a.severity !== "high") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [incidents, search, statusFilter, priorityFilter]);

  return (
    <div>
      <div className="mt-4 flex justify-end">
        <LogIncidentButton clients={clients} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <i className="ti ti-search absolute top-1/2 left-3 -translate-y-1/2 text-[16px] text-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search incidents…"
            className="w-full rounded-input border border-border-default bg-card-bg py-[9px] pr-3 pl-9 text-body text-text-primary outline-none focus:border-nhs-blue"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none"
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {incidents.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-default bg-card-bg py-10 px-4 text-center">
          <p className="text-body text-text-secondary">No incidents logged yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-card border border-border-default bg-card-bg py-10 px-4 text-center">
          <p className="text-body text-text-secondary">No incidents match your search.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((incident) => {
            const severity = SEVERITY_BADGE[incident.severity];
            const isHigh = incident.severity === "high" && incident.status === "open";
            return (
              <div
                key={incident.id}
                className={[
                  "rounded-card border py-3.5 px-4",
                  isHigh ? "border-danger-red-border shadow-sm" : "border-border-default",
                  "bg-card-bg",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={severity.variant}>{severity.label}</Badge>
                      <Badge variant="notStarted">{TYPE_LABELS[incident.incidentType]}</Badge>
                    </div>
                    <h2 className="mt-1.5 text-body font-medium text-text-primary">{incident.clientName}</h2>
                    <p className="mt-1 text-body text-text-secondary">{incident.description}</p>
                    {incident.aiInsight ? (
                      <div className="mt-2 rounded-[10px] border border-ai-blue-border bg-ai-blue-light py-2 px-3">
                        <p className="flex items-start gap-1.5 text-body text-ai-blue-text">
                          <i className="ti ti-sparkles mt-0.5 shrink-0 text-[14px] text-nhs-blue" aria-hidden="true" />
                          {incident.aiInsight}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-secondary text-nhs-blue">{incident.incidentRef}</p>
                    <p className="mt-0.5 text-secondary text-text-muted">
                      {new Date(incident.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  {incident.status === "open" ? (
                    <Link
                      href={`/incidents/${incident.id}?signoff=1`}
                      className="rounded-btn bg-nhs-blue px-3.5 py-[7px] text-[12px] font-medium text-white"
                    >
                      Sign off
                    </Link>
                  ) : null}
                  <Link
                    href={`/incidents/${incident.id}`}
                    className="rounded-btn border border-border-default bg-card-bg px-3.5 py-[7px] text-[12px] font-medium text-text-primary"
                  >
                    View full
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
