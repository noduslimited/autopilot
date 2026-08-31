import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPreVisitInsight } from "@/lib/ai/preVisitInsight";

// Source: AI Feature Specification section 4.1. app/(carer)/visit/[visitId]/page.tsx
// calls getPreVisitInsight() directly (server component, server-side render
// per the spec's "Triggered by: Carer opening the Visit Detail screen")
// rather than fetching this route itself — this route exists for API
// consistency and any future client-side caller, matching the
// incident-insight route's precedent from Session 7.
interface PreVisitBody {
  visitId: string;
}

function isPreVisitBody(value: unknown): value is PreVisitBody {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).visitId === "string";
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isPreVisitBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!userRow || userRow.role !== "carer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase.from("organisations").select("status").eq("id", userRow.org_id).single();
  if (!org || org.status === "trial") {
    return NextResponse.json({ error: "AI features are available on paid plans. Upgrade to access." }, { status: 403 });
  }

  // RLS (carers_own_visits) confirms this visit belongs to the calling carer.
  const { data: visit } = await supabase.from("visits").select("id, client_id").eq("id", body.visitId).single();
  if (!visit) {
    return NextResponse.json({ error: "Visit not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const insight = await getPreVisitInsight(supabase, admin, userRow.org_id, visit.client_id);

  return NextResponse.json({ insight });
}
