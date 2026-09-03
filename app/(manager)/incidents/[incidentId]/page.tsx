import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIncidentInsight } from "@/lib/ai/incidentInsight";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { IncidentDetailActions } from "./IncidentDetailActions";

// Source: PRD section 4.6 (Incident Detail)

const SEVERITY_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  high: { label: "HIGH PRIORITY", variant: "atRisk" },
  medium: { label: "MEDIUM", variant: "dueSoon" },
  low: { label: "LOW", variant: "valid" },
};

const TYPE_LABELS: Record<string, string> = {
  fall: "Fall",
  medication: "Medication",
  behaviour: "Behaviour",
  other: "Other",
};

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function IncidentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ incidentId: string }>;
  searchParams: Promise<{ signoff?: string }>;
}) {
  const { incidentId } = await params;
  const { signoff } = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: incident } = await supabase
    .from("incidents")
    .select(
      "id, org_id, incident_ref, incident_type, severity, description, gp_contacted, gp_notes, status, manager_notes, signed_off_at, created_at, client_id, clients(id, first_name, last_name), reported_by, reporter:reported_by(first_name, last_name), signed_off_by, signer:signed_off_by(first_name, last_name)",
    )
    .eq("id", incidentId)
    .single();

  if (!incident) {
    return (
      <div className="p-5">
        <p className="text-body text-text-secondary">This page doesn&apos;t exist.</p>
        <Link href="/incidents" className="text-body text-nhs-blue">
          Go back
        </Link>
      </div>
    );
  }

  const client = single(incident.clients);
  const reporter = single(incident.reporter);
  const signer = single(incident.signer);

  const insight =
    incident.status === "open"
      ? await getIncidentInsight(supabase, admin, incident.org_id, {
          id: incident.id,
          client_id: incident.client_id,
          incident_type: incident.incident_type,
          description: incident.description,
          created_at: incident.created_at,
        })
      : null;

  const { data: auditRows } = await supabase
    .from("audit_logs")
    .select("action, created_at, user_id, new_values, users:user_id(first_name, last_name)")
    .eq("table_name", "incidents")
    .eq("record_id", incidentId)
    .order("created_at", { ascending: true });

  const timeline = (auditRows ?? []).map((row) => {
    const actor = single(row.users);
    const actorName = actor ? `${actor.first_name} ${actor.last_name}` : "System";
    let label = "Reviewed by manager";
    if (row.action === "create") {
      label = "Incident filed";
    } else if (row.action === "update") {
      const newValues = row.new_values as { status?: string } | null;
      if (newValues?.status === "closed") label = "Signed off and closed";
    }
    return { label, actorName, createdAt: row.created_at };
  });

  const severity = SEVERITY_BADGE[incident.severity] ?? SEVERITY_BADGE.low;

  return (
    <div className="p-5">
      <Link href="/incidents" className="inline-flex items-center gap-1 text-secondary text-nhs-blue">
        <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
        Back to incidents
      </Link>

      <div
        className={[
          "mt-3 rounded-card border py-3.5 px-4",
          incident.severity === "high" && incident.status === "open" ? "border-danger-red-border" : "border-border-default",
          "bg-card-bg",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={severity.variant}>{severity.label}</Badge>
            <Badge variant="notStarted">{TYPE_LABELS[incident.incident_type] ?? incident.incident_type}</Badge>
            <span className="font-mono text-body font-medium text-nhs-blue">{incident.incident_ref}</span>
          </div>
          <Badge variant={incident.status === "open" ? "pending" : "valid"}>{incident.status === "open" ? "Open" : "Closed"}</Badge>
        </div>
        <h1 className="mt-2 text-section-heading text-text-primary">
          {client ? `${client.first_name} ${client.last_name}` : "Unknown client"} — {TYPE_LABELS[incident.incident_type] ?? incident.incident_type}
        </h1>
        <p className="mt-1 text-secondary text-text-secondary">
          Reported by {reporter ? `${reporter.first_name} ${reporter.last_name}` : "Unknown"} ·{" "}
          {new Date(incident.created_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} at{" "}
          {new Date(incident.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <h2 className="text-subsection-heading text-text-primary">Incident details</h2>
          <div className="mt-2 space-y-2">
            <div className="flex justify-between text-body">
              <span className="text-text-secondary">Client</span>
              <span className="text-text-primary">{client ? `${client.first_name} ${client.last_name}` : "—"}</span>
            </div>
            <div className="flex justify-between text-body">
              <span className="text-text-secondary">Reported by</span>
              <span className="text-text-primary">{reporter ? `${reporter.first_name} ${reporter.last_name}` : "—"}</span>
            </div>
            <div className="flex justify-between text-body">
              <span className="text-text-secondary">Date and time</span>
              <span className="text-text-primary">
                {new Date(incident.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                {new Date(incident.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex justify-between text-body">
              <span className="text-text-secondary">Type</span>
              <span className="text-text-primary">{TYPE_LABELS[incident.incident_type] ?? incident.incident_type}</span>
            </div>
            <div className="flex justify-between text-body">
              <span className="text-text-secondary">Severity</span>
              <Badge variant={severity.variant}>{incident.severity[0]!.toUpperCase() + incident.severity.slice(1)}</Badge>
            </div>
            <div className="flex justify-between text-body">
              <span className="text-text-secondary">GP contacted</span>
              <span className="text-text-primary">{incident.gp_contacted ? "Yes" : "No"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <h2 className="text-subsection-heading text-text-primary">GP / emergency notes</h2>
          <div className="mt-2 rounded-input bg-page-bg p-3">
            <p className="text-body text-text-primary">{incident.gp_notes || "No notes recorded."}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">What happened</h2>
        <div className="mt-2 rounded-input bg-page-bg p-3">
          <p className="whitespace-pre-line text-body text-text-primary">{incident.description}</p>
        </div>
        {insight ? (
          <div className="mt-2 rounded-[10px] border border-ai-blue-border bg-ai-blue-light py-2 px-3">
            <p className="flex items-start gap-1.5 text-body text-ai-blue-text">
              <i className="ti ti-sparkles mt-0.5 shrink-0 text-[14px] text-nhs-blue" aria-hidden="true" />
              {insight}
            </p>
          </div>
        ) : null}
      </div>

      <IncidentDetailActions
        incidentId={incident.id}
        incidentRef={incident.incident_ref}
        status={incident.status as "open" | "closed"}
        managerNotes={incident.manager_notes}
        autoOpenSignOff={signoff === "1"}
        signedOffAt={incident.signed_off_at}
        signedOffByName={signer ? `${signer.first_name} ${signer.last_name}` : null}
        pdfData={{
          clientName: client ? `${client.first_name} ${client.last_name}` : "Unknown client",
          incidentType: TYPE_LABELS[incident.incident_type] ?? incident.incident_type,
          severity: severity.label,
          createdAt: incident.created_at,
          reporterName: reporter ? `${reporter.first_name} ${reporter.last_name}` : "Unknown",
          description: incident.description,
          gpContacted: incident.gp_contacted,
          gpNotes: incident.gp_notes,
        }}
      />

      <div className="mt-4 rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Status history</h2>
        <div className="mt-3 space-y-3">
          {timeline.map((entry, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-nhs-blue" />
              <div>
                <p className="text-body font-medium text-text-primary">{entry.label}</p>
                <p className="text-secondary text-text-secondary">
                  {entry.actorName} ·{" "}
                  {new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                  {new Date(entry.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
