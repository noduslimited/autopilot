import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIncidentInsight } from "@/lib/ai/incidentInsight";
import { IncidentsListClient, type IncidentListItem } from "./IncidentsListClient";

// Source: PRD section 4.6 (Incidents)

function startOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export default async function IncidentsPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: incidentRows } = await supabase
    .from("incidents")
    .select(
      "id, incident_ref, incident_type, severity, description, status, created_at, signed_off_at, client_id, clients(first_name, last_name)",
    )
    .order("created_at", { ascending: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: managerRow } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
  const orgId = managerRow!.org_id;

  const rows = incidentRows ?? [];

  const monthStart = startOfMonthUTC();
  const closedThisMonth = rows.filter((r) => r.status === "closed" && r.signed_off_at && new Date(r.signed_off_at) >= monthStart);
  const openCount = rows.filter((r) => r.status === "open").length;
  const highPriorityCount = rows.filter((r) => r.status === "open" && r.severity === "high").length;
  const avgCloseDays =
    closedThisMonth.length > 0
      ? closedThisMonth.reduce((sum, r) => sum + (new Date(r.signed_off_at!).getTime() - new Date(r.created_at).getTime()), 0) /
        closedThisMonth.length /
        (1000 * 60 * 60 * 24)
      : null;

  // AI Feature Spec 4.9: computed server-side at render time, only for
  // incidents that qualify (2+ same-type in 30 days) — getIncidentInsight
  // itself returns null immediately for non-qualifying incidents, so this
  // is cheap for the common case.
  const incidents: IncidentListItem[] = await Promise.all(
    rows.map(async (r) => {
      const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
      const insight =
        r.status === "open"
          ? await getIncidentInsight(supabase, admin, orgId, {
              id: r.id,
              client_id: r.client_id,
              incident_type: r.incident_type,
              description: r.description,
              created_at: r.created_at,
            })
          : null;

      return {
        id: r.id,
        incidentRef: r.incident_ref,
        clientName: client ? `${client.first_name} ${client.last_name}` : "Unknown",
        incidentType: r.incident_type as "fall" | "medication" | "behaviour" | "other",
        severity: r.severity as "low" | "medium" | "high",
        description: r.description,
        status: r.status as "open" | "closed",
        createdAt: r.created_at,
        aiInsight: insight,
      };
    }),
  );

  const { data: activeClients } = await supabase.from("clients").select("id, first_name, last_name").eq("status", "active").order("first_name");

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-page-heading text-text-primary">Incidents</h1>
          <p className="mt-1 text-secondary text-text-secondary">
            {openCount} open · {highPriorityCount} high priority · {closedThisMonth.length} closed this month
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">Open</p>
          <p className={["mt-1 text-section-heading", openCount > 0 ? "text-nhs-red" : "text-text-primary"].join(" ")}>{openCount}</p>
        </div>
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">High priority</p>
          <p className={["mt-1 text-section-heading", highPriorityCount > 0 ? "text-nhs-red" : "text-text-primary"].join(" ")}>
            {highPriorityCount}
          </p>
        </div>
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">Closed this month</p>
          <p className="mt-1 text-section-heading text-text-primary">{closedThisMonth.length}</p>
        </div>
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">Avg close time</p>
          <p className="mt-1 text-section-heading text-text-primary">{avgCloseDays !== null ? `${avgCloseDays.toFixed(1)}d` : "—"}</p>
        </div>
      </div>

      <IncidentsListClient incidents={incidents} clients={activeClients ?? []} />
    </div>
  );
}
