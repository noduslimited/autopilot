import Link from "next/link";

// Source: PRD section 4.2 (Alert banner) + IA doc section 3.3 (Resolve link targets)
type PersonJoin = { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;

interface UnassignedVisit {
  id: string;
  client_id: string;
  scheduled_start: string;
  clients: PersonJoin;
}

interface MedicationVisit {
  id: string;
  scheduled_start: string;
  clients: PersonJoin;
}

export interface AlertBannerProps {
  unassignedSoon: UnassignedVisit[];
  medicationDueSoon: MedicationVisit[];
  staleHighPriorityCount: number;
}

function clientName(value: PersonJoin): string {
  const person = Array.isArray(value) ? value[0] : value;
  return person ? `${person.first_name} ${person.last_name}` : "A client";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function minutesUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
}

export function AlertBanner({ unassignedSoon, medicationDueSoon, staleHighPriorityCount }: AlertBannerProps) {
  const visitCount = unassignedSoon.length + medicationDueSoon.length;
  const hasAnyAlert = visitCount > 0 || staleHighPriorityCount > 0;

  if (!hasAnyAlert) return null;

  const segments: string[] = [
    ...unassignedSoon.map(
      (visit) => `${clientName(visit.clients)} (${formatTime(visit.scheduled_start)}) has no carer assigned`,
    ),
    ...medicationDueSoon.map(
      (visit) => `${clientName(visit.clients)}'s medication due in ${minutesUntil(visit.scheduled_start)} mins`,
    ),
  ];
  if (staleHighPriorityCount > 0) {
    segments.push(
      `${staleHighPriorityCount} high-priority incident${staleHighPriorityCount > 1 ? "s" : ""} open over 24 hours`,
    );
  }

  const resolveHref =
    unassignedSoon.length > 0
      ? "/rota"
      : medicationDueSoon.length > 0
        ? `/clients/${medicationDueSoon[0].id}?tab=medication`
        : "/incidents";

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-danger-red-border bg-danger-red-light py-3 px-4">
      <div className="flex items-start gap-2">
        <i className="ti ti-alert-circle mt-0.5 shrink-0 text-[18px] text-danger-red" aria-hidden="true" />
        <p className="text-body text-danger-red">
          {visitCount > 0 ? `${visitCount} visit${visitCount > 1 ? "s" : ""} require attention — ` : null}
          {segments.join(" · ")}
        </p>
      </div>
      <Link
        href={resolveHref}
        className="shrink-0 rounded-btn bg-nhs-red px-3.5 py-[7px] text-[12px] font-medium text-white"
      >
        Resolve
      </Link>
    </div>
  );
}
