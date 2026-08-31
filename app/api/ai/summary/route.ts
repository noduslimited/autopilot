import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, estimateCost } from "@/lib/anthropic/client";

// Source: AI Feature Specification section 4.5 (Dashboard AI Summary),
// section 5.1 (daily limit: 50 per org), section 5.4 (trial accounts).
const FEATURE = "dashboard_summary";
const DAILY_LIMIT = 50;
const MAX_TOKENS = 150;

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!userRow || userRow.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organisations")
    .select("status")
    .eq("id", userRow.org_id)
    .single();

  // CLAUDE.md rule 9: AI features disabled for trial accounts.
  if (!org || org.status === "trial") {
    return NextResponse.json(
      { error: "AI features are available on paid plans. Upgrade to access." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const todayStart = startOfTodayUTC();

  const { count: usageToday } = await admin
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", userRow.org_id)
    .eq("feature", FEATURE)
    .gte("created_at", todayStart.toISOString());

  if ((usageToday ?? 0) >= DAILY_LIMIT) {
    // Daily limit reached — same graceful-degradation contract as any
    // other AI failure: hide the element, no error surfaced to the user.
    return NextResponse.json({ summary: null });
  }

  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const [{ data: todayVisits }, { data: openIncidents }, { data: overdueTraining }] = await Promise.all([
    supabase
      .from("visits")
      .select("status, assigned_carer_id")
      .eq("org_id", userRow.org_id)
      .gte("scheduled_start", todayStart.toISOString())
      .lt("scheduled_start", todayEnd.toISOString()),
    supabase
      .from("incidents")
      .select("severity")
      .eq("org_id", userRow.org_id)
      .eq("status", "open"),
    supabase
      .from("training_records")
      .select("staff_id")
      .eq("org_id", userRow.org_id)
      .lt("expiry_date", todayStart.toISOString().slice(0, 10)),
  ]);

  const visits = todayVisits ?? [];
  const completed = visits.filter((v) => v.status === "completed").length;
  const inProgress = visits.filter((v) => v.status === "in_progress").length;
  const notStarted = visits.filter((v) => v.status === "scheduled").length;
  const unassigned = visits.filter((v) => !v.assigned_carer_id).length;
  const incidents = openIncidents ?? [];
  const highPriorityIncidents = incidents.filter((i) => i.severity === "high").length;

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // No CQC review date field exists anywhere in the schema, so that line
  // from the AI Feature Spec's template is omitted — the global AI
  // principle "AI never fabricates data" rules out referencing data that
  // isn't there.
  const prompt = `Write a 2-4 sentence briefing for a care manager. Today is ${todayLabel}. Be direct and practical. Reference specific numbers. If everything is fine, say so briefly.

Service data:
- Total visits today: ${visits.length}
- Completed: ${completed}, In progress: ${inProgress}, Not started: ${notStarted}
- Unassigned visits: ${unassigned}
- Open incidents: ${incidents.length} (${highPriorityIncidents} high priority)
- Staff with overdue training: ${(overdueTraining ?? []).length}

Write the briefing now. Do not use bullet points — write in natural prose.`;

  const result = await callClaude({ prompt, maxTokens: MAX_TOKENS });

  if (!result) {
    return NextResponse.json({ summary: null });
  }

  await admin.from("ai_usage_logs").insert({
    org_id: userRow.org_id,
    feature: FEATURE,
    tokens_used: result.inputTokens + result.outputTokens,
    cost_estimate: estimateCost(result.inputTokens, result.outputTokens),
  });

  return NextResponse.json({ summary: result.text });
}
