import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAndMaybeEmail } from "@/lib/notifications/notify";

// Source: PRD section 5.5 (Report Incident) — "On submit: incident record
// created... push notification sent to manager". The incident insert
// itself goes through the carer's own RLS-scoped session (policy
// "carers_file_incident"), but the manager notification needs the admin
// client — notifications RLS has no direct INSERT policy, same reasoning
// as /api/shift-swap-request. Notification + Settings-gated email now
// goes through the shared notifyAndMaybeEmail() (Session 12), which this
// route used to do by hand (in-app insert only, no email).
interface ReportIncidentBody {
  clientId: string;
  visitId: string | null;
  incidentType: string;
  severity: string;
  description: string;
  gpContacted: boolean;
  gpNotes: string | null;
  photoUrls: string[];
}

function isReportIncidentBody(value: unknown): value is ReportIncidentBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.clientId === "string" &&
    (body.visitId === null || typeof body.visitId === "string") &&
    typeof body.incidentType === "string" &&
    typeof body.severity === "string" &&
    typeof body.description === "string" &&
    typeof body.gpContacted === "boolean" &&
    (body.gpNotes === null || typeof body.gpNotes === "string") &&
    (body.photoUrls === undefined || (Array.isArray(body.photoUrls) && body.photoUrls.every((url) => typeof url === "string")))
  );
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isReportIncidentBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: carer } = await supabase.from("users").select("org_id, role, first_name, last_name").eq("id", user.id).single();
  if (!carer || carer.role !== "carer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: client } = await supabase.from("clients").select("first_name").eq("id", body.clientId).single();
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  // Defence in depth on top of the incident-photos bucket's own RLS: only
  // accept photo paths that genuinely live under this carer's own org
  // folder (storage path convention: {org_id}/{carer_id}/{filename}).
  const photoUrls = (body.photoUrls ?? []).filter((url) => url.startsWith(`${carer.org_id}/`)).slice(0, 3);

  const { data: incident, error: insertError } = await supabase
    .from("incidents")
    .insert({
      org_id: carer.org_id,
      incident_ref: "",
      client_id: body.clientId,
      visit_id: body.visitId,
      reported_by: user.id,
      incident_type: body.incidentType,
      severity: body.severity,
      description: body.description,
      gp_contacted: body.gpContacted,
      gp_notes: body.gpContacted ? body.gpNotes : null,
      status: "open",
      photo_urls: photoUrls.length > 0 ? photoUrls : null,
    })
    .select("id, incident_ref")
    .single();

  if (insertError || !incident) {
    return NextResponse.json({ error: "Could not submit this incident report." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: managers } = await admin.from("users").select("id").eq("org_id", carer.org_id).eq("role", "manager");

  await notifyAndMaybeEmail(admin, {
    orgId: carer.org_id,
    userIds: (managers ?? []).map((m) => m.id),
    type: "incident_filed",
    title: `Incident reported: ${client.first_name}`,
    body: `${carer.first_name} ${carer.last_name} filed a ${body.severity} severity ${body.incidentType} incident for ${client.first_name}.`,
    link: `/incidents/${incident.id}`,
  });

  return NextResponse.json({ incidentRef: incident.incident_ref });
}
