"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CriticalBadges, type CriticalBadgesClient } from "@/components/clients/CriticalBadges";
import { createClient } from "@/lib/supabase/client";
import { getDirectionsUrl } from "@/lib/utils/maps";

// Source: PRD section 5.2 (My Day) — three visit card states.
export interface MyDayVisit {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  tasks_total: number;
  tasks_completed: number;
  client: CriticalBadgesClient & { id: string; first_name: string; last_name: string; address: string };
}

function timeRange(start: string, end: string): string {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function MyDayClient({ visits }: { visits: MyDayVisit[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const completedVisits = visits.filter((v) => v.status === "completed");
  const inProgressVisits = visits.filter((v) => v.status === "in_progress");
  const upcomingVisits = visits.filter((v) => v.status === "scheduled");

  async function startVisit(visit: MyDayVisit) {
    const active = visits.find((v) => v.status === "in_progress");
    if (active) {
      setError(
        `You have an active visit with ${active.client.first_name}. Please complete or pause it before starting a new one.`,
      );
      return;
    }
    setStarting(visit.id);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("visits")
      .update({ status: "in_progress", check_in_time: new Date().toISOString() })
      .eq("id", visit.id);
    setStarting(null);
    if (updateError) {
      // The DB-level partial unique index (one_active_visit_per_carer) is
      // the authoritative guard — this branch catches a race the UI check
      // above could miss (e.g. two tabs open at once).
      setError("You already have an active visit. Please complete or pause it before starting a new one.");
      return;
    }
    router.push(`/visit/${visit.id}`);
  }

  return (
    <div className="px-4 pt-4">
      {error ? (
        <div className="mb-3 flex items-start justify-between gap-2 rounded-input border border-nhs-red bg-[#FDECEA] p-3">
          <p className="text-body text-[#A32D2D]">{error}</p>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            <i className="ti ti-x text-[16px] text-[#A32D2D]" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {completedVisits.length > 0 ? (
        <section className="mb-4">
          <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">Completed</h2>
          <div className="flex flex-col gap-2.5">
            {completedVisits.map((visit) => (
              <div key={visit.id} className="rounded-card border border-border-default bg-card-bg p-3.5">
                <div className="flex items-start justify-between">
                  <p className="text-secondary text-text-secondary">{timeRange(visit.scheduled_start, visit.scheduled_end)}</p>
                  <Badge variant="completed">Completed</Badge>
                </div>
                <p className="mt-1 text-[14px] font-bold text-text-primary">
                  {visit.client.first_name} {visit.client.last_name}
                </p>
                <p className="text-secondary text-text-secondary">{visit.client.address}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {inProgressVisits.length > 0 ? (
        <section className="mb-4">
          <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">In progress</h2>
          <div className="flex flex-col gap-2.5">
            {inProgressVisits.map((visit) => (
              <div key={visit.id} className="rounded-card bg-nhs-blue p-3.5">
                <div className="flex items-start justify-between">
                  <p className="text-secondary text-white/70">{timeRange(visit.scheduled_start, visit.scheduled_end)}</p>
                  <span className="rounded-badge bg-white/20 px-[7px] py-[2px] text-[10px] font-medium text-white">In progress</span>
                </div>
                <p className="mt-1 text-[15px] font-bold text-white">
                  {visit.client.first_name} {visit.client.last_name}
                </p>
                <p className="text-secondary text-white/70">{visit.client.address}</p>
                <CriticalBadges client={visit.client} className="mt-1.5" />
                <div className="mt-2.5">
                  <ProgressBar value={(visit.tasks_completed / Math.max(visit.tasks_total, 1)) * 100} variant="green" className="bg-white/20" />
                  <p className="mt-1 text-tiny text-white/70">
                    {visit.tasks_completed} of {visit.tasks_total} tasks completed
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/visit/${visit.id}`)}
                  className="mt-2.5 w-full rounded-btn bg-white py-[9px] text-[13px] font-medium text-nhs-blue"
                >
                  Continue visit
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {upcomingVisits.length > 0 ? (
        <section className="mb-4">
          <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">Upcoming</h2>
          <div className="flex flex-col gap-2.5">
            {upcomingVisits.map((visit) => (
              <div key={visit.id} className="rounded-card border border-border-default bg-card-bg p-3.5">
                <div className="flex items-start justify-between">
                  <p className="text-secondary text-text-secondary">{timeRange(visit.scheduled_start, visit.scheduled_end)}</p>
                  <span className="rounded-badge bg-page-bg px-[7px] py-[2px] text-[10px] font-medium text-text-secondary">
                    {new Date(visit.scheduled_start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <button type="button" onClick={() => startVisit(visit)} className="block w-full text-left" disabled={starting === visit.id}>
                  <p className="mt-1 text-[14px] font-bold text-text-primary">
                    {visit.client.first_name} {visit.client.last_name}
                  </p>
                  <p className="text-secondary text-text-secondary">{visit.client.address}</p>
                  <CriticalBadges client={visit.client} className="mt-1.5" />
                </button>
                <a
                  href={getDirectionsUrl(visit.client.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-btn border border-border-default bg-card-bg py-[9px] text-[13px] font-medium text-text-primary"
                >
                  <i className="ti ti-map-pin text-[15px]" aria-hidden="true" />
                  Get directions
                </a>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {visits.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-body text-text-secondary">No visits scheduled for today.</p>
        </div>
      ) : null}
    </div>
  );
}
