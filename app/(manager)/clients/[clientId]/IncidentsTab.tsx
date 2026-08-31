import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

// Source: PRD section 4.3 (Incidents tab)
const SEVERITY_BADGE: Record<string, BadgeVariant> = { high: "atRisk", medium: "highRisk", low: "abilities" };
const STATUS_BADGE: Record<string, BadgeVariant> = { open: "atRisk", closed: "completed" };
const TYPE_LABELS: Record<string, string> = { fall: "Fall", medication: "Medication", behaviour: "Behaviour", other: "Other" };

export async function IncidentsTab({ clientId }: { clientId: string }) {
  const supabase = await createClient();
  const { data: incidents } = await supabase
    .from("incidents")
    .select("id, incident_ref, incident_type, severity, status, created_at, users:reported_by(first_name, last_name)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex justify-end">
        <Link href="/incidents" className="rounded-btn bg-nhs-red px-3.5 py-[7px] text-[12px] font-medium text-white">
          Log incident
        </Link>
      </div>

      {!incidents || incidents.length === 0 ? (
        <p className="mt-4 text-body text-text-secondary">No incidents recorded for this client.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {incidents.map((incident) => {
            const carer = Array.isArray(incident.users) ? incident.users[0] : incident.users;
            return (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="flex items-center justify-between rounded-card border border-border-default bg-card-bg py-3 px-4"
              >
                <div>
                  <p className="text-body font-medium text-text-primary">
                    {TYPE_LABELS[incident.incident_type] ?? incident.incident_type} · {new Date(incident.created_at).toLocaleDateString("en-GB")}
                  </p>
                  <p className="text-secondary text-text-secondary">
                    {carer ? `${carer.first_name} ${carer.last_name}` : "Unknown"} · {incident.incident_ref}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={SEVERITY_BADGE[incident.severity] ?? "notStarted"}>{incident.severity}</Badge>
                  <Badge variant={STATUS_BADGE[incident.status] ?? "notStarted"}>{incident.status}</Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
