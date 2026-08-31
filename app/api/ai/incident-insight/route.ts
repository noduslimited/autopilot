import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIncidentInsight } from "@/lib/ai/incidentInsight";

// Source: AI Feature Specification section 4.9. The incidents list page
// calls getIncidentInsight() directly (server component, server-side
// render per the spec's own "not on demand" trigger) rather than fetching
// this route itself — this route exists for API consistency with every
// other AI feature and any future caller (e.g. a carer-side view) that
// needs the same insight without server-component access.
interface IncidentInsightBody {
  incidentId: string;
}

function isIncidentInsightBody(value: unknown): value is IncidentInsightBody {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).incidentId === "string";
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isIncidentInsightBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!userRow || userRow.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase.from("organisations").select("status").eq("id", userRow.org_id).single();
  if (!org || org.status === "trial") {
    return NextResponse.json({ error: "AI features are available on paid plans. Upgrade to access." }, { status: 403 });
  }

  const { data: incident } = await supabase
    .from("incidents")
    .select("id, client_id, incident_type, description, created_at")
    .eq("id", body.incidentId)
    .single();

  if (!incident) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const insight = await getIncidentInsight(supabase, admin, userRow.org_id, incident);

  return NextResponse.json({ insight });
}
