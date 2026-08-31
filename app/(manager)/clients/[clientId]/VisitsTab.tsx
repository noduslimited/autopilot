import { createClient } from "@/lib/supabase/server";
import { VisitsTimeline, type VisitTimelineItem } from "./VisitsTimeline";

// Source: PRD section 4.3 (Visits tab)
export async function VisitsTab({ clientId }: { clientId: string }) {
  const supabase = await createClient();

  const [{ data: visits }, { data: incidents }] = await Promise.all([
    supabase
      .from("visits")
      .select("id, scheduled_start, scheduled_end, status, visit_notes, tasks_total, tasks_completed, users:assigned_carer_id(first_name, last_name)")
      .eq("client_id", clientId)
      .order("scheduled_start", { ascending: false }),
    supabase.from("incidents").select("visit_id").eq("client_id", clientId).not("visit_id", "is", null),
  ]);

  const incidentVisitIds = new Set((incidents ?? []).map((i) => i.visit_id));

  const items: VisitTimelineItem[] = (visits ?? []).map((visit) => {
    const carer = Array.isArray(visit.users) ? visit.users[0] : visit.users;
    return {
      id: visit.id,
      scheduledStart: visit.scheduled_start,
      scheduledEnd: visit.scheduled_end,
      status: visit.status,
      carerName: carer ? `${carer.first_name} ${carer.last_name}` : "Unassigned",
      tasksTotal: visit.tasks_total,
      tasksCompleted: visit.tasks_completed,
      notes: visit.visit_notes,
      hasIncident: incidentVisitIds.has(visit.id),
    };
  });

  return <VisitsTimeline visits={items} />;
}
