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

  // Perf fix, 2026-09-06: incidentRows/activeClients don't depend on the
  // user lookup (RLS scopes both to the caller's own org already) and
  // previously ran one-after-another — now genuinely parallel.
  const [{ data: incidentRows }, {
    data: { user },
  }, { data: activeClients }] = await Promise.all([
    supabase
      .from("incidents")
      .select(
        "id, incident_ref, incident_type, severity, description, status, created_at, signed_off_at, client_id, clients(first_name, last_name)",
      )
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
    supabase.from("clients").select("id, first_name, last_name").eq("status", "active").order("first_name"),
  ]);

  const { data: managerRow } = await supabase.from("users").select("org_id, organisations(status)").eq("id", user!.id).single();
  const orgId = managerRow!.org_id;
  const org = Array.isArray(managerRow!.organisations) ? managerRow!.organisations[0] : managerRow!.organisations;
  const orgStatus = org?.status;

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

  // Perf fix, 2026-09-06: getIncidentInsight() used to run its own
  // "2+ same-type incidents in 30 days" count query AND its own org-status
  // check for every single row — a real N+1 that measured as this page's
  // single biggest latency contributor. Both are computed once here, from
  // data this page already fetched in the single query above, and passed
  // in — getIncidentInsight now only hits the DB at all for incidents that
  // actually qualify (a small minority), not for every row on the page.
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const incidents: IncidentListItem[] = await Promise.all(
    rows.map(async (r) => {
      const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
      const patternCount = rows.filter(
        (other) => other.client_id === r.client_id && other.incident_type === r.incident_type && new Date(other.created_at).getTime() >= thirtyDaysAgo,
      ).length;
      const insight =
        r.status === "open"
          ? await getIncidentInsight(
              supabase,
              admin,
              orgId,
              {
                id: r.id,
                client_id: r.client_id,
                incident_type: r.incident_type,
                description: r.description,
                created_at: r.created_at,
              },
              { orgStatus, patternCount },
            )
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
