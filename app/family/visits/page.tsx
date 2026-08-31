import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLinkedClientId } from "@/lib/family/getLinkedClient";
import { UnlinkedAccountNotice } from "@/components/family/UnlinkedAccountNotice";
import { Header } from "@/components/layout/Header";

// Source: PRD section 6.4 (Visit History)

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function visitTimeName(iso: string): string {
  const hour = new Date(iso).getUTCHours();
  if (hour < 12) return "Morning visit";
  if (hour < 17) return "Afternoon visit";
  return "Evening visit";
}

function timeRange(start: string, end: string): string {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function dateGroupLabel(date: Date, todayStart: Date): string {
  const diffDays = Math.round((todayStart.getTime() - Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())) / (1000 * 60 * 60 * 24));
  const dateStr = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  if (diffDays === 0) return `Today — ${dateStr}`;
  if (diffDays === 1) return `Yesterday — ${dateStr}`;
  return dateStr;
}

export default async function FamilyVisitsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days } = await searchParams;
  const windowDays = Math.max(7, Number(days) || 7);

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const clientId = await getLinkedClientId(supabase, authUser!.id);
  if (!clientId) return <UnlinkedAccountNotice />;

  const { data: client } = await supabase.from("clients").select("first_name, last_name").eq("id", clientId).single();
  if (!client) return <UnlinkedAccountNotice />;

  const todayStart = startOfTodayUTC();
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
  const windowStart = new Date(todayStart);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);

  const [{ data: visits }, { data: incidents }] = await Promise.all([
    supabase
      .from("visits")
      .select("id, scheduled_start, scheduled_end, status, tasks_total, tasks_completed, visit_notes, staff:assigned_carer_id(first_name, last_name)")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .gte("scheduled_start", windowStart.toISOString())
      .lt("scheduled_start", todayEnd.toISOString())
      .order("scheduled_start", { ascending: false }),
    supabase.from("incidents").select("visit_id").eq("client_id", clientId).not("visit_id", "is", null),
  ]);

  const incidentVisitIds = new Set((incidents ?? []).map((i) => i.visit_id));

  const groups: Array<{ label: string; visits: NonNullable<typeof visits> }> = [];
  for (const visit of visits ?? []) {
    const visitDate = new Date(visit.scheduled_start);
    const label = dateGroupLabel(visitDate, todayStart);
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.visits.push(visit);
    else groups.push({ label, visits: [visit] });
  }

  return (
    <div>
      <Header title="Visit history" backHref="/family/overview" subtitle={`${client.first_name} ${client.last_name} · Last ${windowDays} days`} />

      <div className="px-4 py-4">
        {groups.length === 0 ? (
          <p className="py-6 text-center text-body text-text-secondary">No visits recorded in this period.</p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-4">
              <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">{group.label}</h2>
              <div className="flex flex-col gap-2.5">
                {group.visits.map((visit) => {
                  const carer = Array.isArray(visit.staff) ? visit.staff[0] : visit.staff;
                  const hasIncident = incidentVisitIds.has(visit.id);
                  return (
                    <div key={visit.id} className="flex gap-2.5">
                      <span className={["mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", hasIncident ? "bg-nhs-red" : "bg-nhs-green"].join(" ")} />
                      <div className={["flex-1 rounded-card border p-3", hasIncident ? "border-nhs-red bg-[#FDECEA]" : "border-border-default bg-card-bg"].join(" ")}>
                        <div className="flex items-start justify-between">
                          <p className={["text-body font-medium", hasIncident ? "text-danger-red" : "text-text-primary"].join(" ")}>
                            {visitTimeName(visit.scheduled_start)}
                            {hasIncident ? " · Incident" : ""}
                          </p>
                          {hasIncident ? <span className="text-secondary font-medium text-danger-red">Incident</span> : null}
                        </div>
                        <p className={["text-secondary", hasIncident ? "text-danger-red" : "text-text-secondary"].join(" ")}>
                          {carer ? `${carer.first_name} ${carer.last_name}` : "Carer"} · {timeRange(visit.scheduled_start, visit.scheduled_end)}
                          {!hasIncident ? ` · ${visit.tasks_completed} tasks` : ""}
                        </p>
                        {visit.visit_notes ? (
                          <p className={["mt-1.5 rounded-input p-2 text-body", hasIncident ? "bg-white/60 text-danger-red" : "bg-page-bg text-text-primary"].join(" ")}>
                            {visit.visit_notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        <Link
          href={`/family/visits?days=${windowDays + 7}`}
          className="mt-2 flex w-full items-center justify-center rounded-btn border border-border-default bg-card-bg py-[10px] text-[13px] font-medium text-text-primary"
        >
          Load earlier visits
        </Link>
      </div>
    </div>
  );
}
