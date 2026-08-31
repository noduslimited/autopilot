import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, estimateCost } from "@/lib/anthropic/client";

// Source: AI Feature Specification section 4.4 (Care Plan Update Draft),
// section 5.1 (daily limit: 20 per org)
const FEATURE = "care_plan_draft";
const DAILY_LIMIT = 20;
const MAX_TOKENS = 500;

interface DraftCarePlanBody {
  clientId: string;
}

function isDraftCarePlanBody(value: unknown): value is DraftCarePlanBody {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).clientId === "string";
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isDraftCarePlanBody(body)) {
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

  const admin = createAdminClient();
  const { count: usageToday } = await admin
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", userRow.org_id)
    .eq("feature", FEATURE)
    .gte("created_at", startOfTodayUTC().toISOString());

  if ((usageToday ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ draft: null });
  }

  const [{ data: client }, { data: carePlan }, { data: recentVisits }, { data: openIncidents }] = await Promise.all([
    supabase.from("clients").select("first_name, risk_level, falls_risk, mobility_aids").eq("id", body.clientId).single(),
    supabase.from("care_plans").select("care_needs").eq("client_id", body.clientId).maybeSingle(),
    supabase
      .from("visits")
      .select("visit_notes, check_out_time, wellbeing_rating")
      .eq("client_id", body.clientId)
      .eq("status", "completed")
      .order("check_out_time", { ascending: false })
      .limit(10),
    supabase
      .from("incidents")
      .select("incident_type, description, created_at, severity")
      .eq("client_id", body.clientId)
      .eq("status", "open"),
  ]);

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const prompt = `You are helping a care manager draft updates to a service user's care plan based on recent observations.

Client first name: ${client.first_name}
Current risk level: ${client.risk_level}
Falls risk: ${client.falls_risk ? "Yes" : "No"}
Mobility aids: ${client.mobility_aids || "None recorded"}

Current care plan summary:
${JSON.stringify(carePlan?.care_needs ?? [])}

Recent visit notes (last 10 visits):
${(recentVisits ?? []).map((v) => `${v.check_out_time}: ${v.visit_notes || "No notes"}`).join("\n") || "None recorded"}

Open incidents:
${(openIncidents ?? []).map((i) => `${i.created_at}: ${i.incident_type} (${i.severity}) — ${i.description}`).join("\n") || "None"}

Based on the above, suggest specific updates to this person's care plan. Format your response as a numbered list of recommended changes. Each point should be actionable and specific. Label each item as either an UPDATE to an existing plan element or an ADDITION of a new one.

Do not suggest changes that cannot be justified by the data provided. Maximum 6 items.`;

  const result = await callClaude({ prompt, maxTokens: MAX_TOKENS });

  if (!result) {
    return NextResponse.json({ draft: null });
  }

  await admin.from("ai_usage_logs").insert({
    org_id: userRow.org_id,
    feature: FEATURE,
    tokens_used: result.inputTokens + result.outputTokens,
    cost_estimate: estimateCost(result.inputTokens, result.outputTokens),
  });

  return NextResponse.json({ draft: result.text });
}
