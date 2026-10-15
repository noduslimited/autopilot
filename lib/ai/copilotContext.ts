import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ukDateISO, ukDayRange } from "@/lib/utils/time";

// Source: PRD section 4.9 ("Context sent to AI on each message") and AI
// Feature Specification section 4.7 (morning briefing — same as dashboard
// summary, section 4.5, plus unread family messages).
// UK calendar date (Europe/London), held at UTC midnight so date arithmetic stays simple.
function startOfTodayUTC(): Date {
  return new Date(`${ukDateISO()}T00:00:00Z`);
}

export async function gatherCopilotContext(supabase: SupabaseClient<Database>, orgId: string, orgName: string) {
  const todayStart = startOfTodayUTC();
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
  const todayISO = ukDateISO();

  const [
    { data: todayVisits },
    { data: openIncidents },
    { data: todayShifts },
    { data: staffRows },
    { data: trainingRows },
    { data: clientRows },
    { data: teamRows },
  ] =
    await Promise.all([
      supabase
        .from("visits")
        .select("status, assigned_carer_id")
        .eq("org_id", orgId)
        .gte("scheduled_start", ukDayRange(ukDateISO()).start)
        .lt("scheduled_start", ukDayRange(ukDateISO()).end),
      supabase
        .from("incidents")
        .select("incident_ref, incident_type, severity, description, clients(first_name, last_name)")
        .eq("org_id", orgId)
        .eq("status", "open"),
      supabase
        .from("rota_shifts")
        .select("staff_id, staff:staff_id(users(first_name, last_name))")
        .eq("org_id", orgId)
        .eq("shift_date", todayISO)
        .not("shift_type", "in", "(sick_leave,off,annual_leave)"),
      supabase.from("staff").select("id, dbs_expiry").eq("org_id", orgId),
      supabase.from("training_records").select("staff_id, expiry_date").eq("org_id", orgId),
      // Active client roster, so the Copilot can count, list and answer
      // questions about clients (F-26).
      supabase
        .from("clients")
        .select("client_ref, first_name, last_name, care_type, risk_level, users:assigned_carer_id(first_name, last_name)")
        .eq("org_id", orgId)
        .eq("status", "active")
        .order("last_name"),
      supabase
        .from("users")
        .select("first_name, last_name, role, status")
        .eq("org_id", orgId)
        .in("role", ["manager", "carer"])
        .eq("status", "active"),
    ]);

  const activeClients = (clientRows ?? []).map((c) => {
    const carer = Array.isArray(c.users) ? c.users[0] : c.users;
    return {
      ref: c.client_ref,
      name: `${c.first_name} ${c.last_name}`,
      care_type: c.care_type,
      risk_level: c.risk_level,
      assigned_carer: carer ? `${carer.first_name} ${carer.last_name}` : "None assigned",
    };
  });
  const activeStaff = (teamRows ?? []).map((u) => ({ name: `${u.first_name} ${u.last_name}`, role: u.role }));

  const visits = todayVisits ?? [];
  const today = new Date();

  const overdueDbsCount = (staffRows ?? []).filter((s) => s.dbs_expiry && new Date(s.dbs_expiry) < today).length;
  const overdueTrainingCount = (trainingRows ?? []).filter((t) => new Date(t.expiry_date) < today).length;

  const staffOnShift = (todayShifts ?? []).map((s) => {
    const staffRow = Array.isArray(s.staff) ? s.staff[0] : s.staff;
    const user = staffRow ? (Array.isArray(staffRow.users) ? staffRow.users[0] : staffRow.users) : null;
    return user ? `${user.first_name} ${user.last_name}` : "Unknown";
  });

  const incidentDetails = (openIncidents ?? []).map((i) => {
    const client = Array.isArray(i.clients) ? i.clients[0] : i.clients;
    return {
      ref: i.incident_ref,
      client: client?.first_name ?? "Unknown",
      type: i.incident_type,
      severity: i.severity,
      description: i.description,
    };
  });

  return {
    date: today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }),
    time: today.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }),
    organisation_name: orgName,
    active_clients_count: activeClients.length,
    active_clients: activeClients,
    active_staff_count: activeStaff.length,
    active_staff: activeStaff,
    visits_today: {
      total: visits.length,
      completed: visits.filter((v) => v.status === "completed").length,
      in_progress: visits.filter((v) => v.status === "in_progress").length,
      not_started: visits.filter((v) => v.status === "scheduled").length,
      unassigned: visits.filter((v) => !v.assigned_carer_id).length,
    },
    open_incidents_count: incidentDetails.length,
    open_incidents: incidentDetails,
    staff_on_shift_today: staffOnShift,
    overdue_training_count: overdueTrainingCount,
    overdue_dbs_count: overdueDbsCount,
  };
}

export async function gatherFamilyMessagesContext(supabase: SupabaseClient<Database>, orgId: string) {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("messages")
    .select("client_id, body, sender_name, created_at")
    .eq("org_id", orgId)
    .eq("read_by_manager", false)
    .gte("created_at", yesterday)
    .order("created_at", { ascending: false });
  return data ?? [];
}
