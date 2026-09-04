import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, estimateCost } from "@/lib/anthropic/client";
import { getActiveServiceUserCount } from "@/lib/billing/activeServiceUsers";

// Source: Gokul, direct request 2026-09-03 — Settings overhaul item
// 11.1 ("AI-generated recommendation analysing actual usage — clients,
// staff, visits, AI calls — explaining specifically why upgrading would
// help"). Not one of the AI Feature Specification's original 9 features
// — same "Gokul asked directly" precedent as Session 10's wellbeing
// summary and this session's own AI rota scheduling. CLAUDE.md rule 9
// still applies (trial accounts get a 403) even though in practice the
// Plan & usage page never renders this panel for a trial org — it shows
// the tier picker instead, since a trial org has no "current tier" to
// compare usage against.
const FEATURE = "billing_recommendation";
const DAILY_LIMIT = 10;
const MAX_TOKENS = 200;

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function startOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!userRow || userRow.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase.from("organisations").select("status, stripe_plan_tier").eq("id", userRow.org_id).single();
  if (!org || org.status === "trial") {
    return NextResponse.json({ error: "AI features are available on paid plans. Upgrade to access." }, { status: 403 });
  }
  if (!org.stripe_plan_tier) {
    return NextResponse.json({ text: null });
  }

  const admin = createAdminClient();
  const { count: usageToday } = await admin
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", userRow.org_id)
    .eq("feature", FEATURE)
    .gte("created_at", startOfTodayUTC().toISOString());

  if ((usageToday ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ text: null });
  }

  const monthStart = startOfMonthUTC();
  const [activeUserCount, { count: staffCount }, { count: visitsThisMonth }, { count: aiCallsThisMonth }] = await Promise.all([
    getActiveServiceUserCount(supabase, userRow.org_id),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("org_id", userRow.org_id),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("org_id", userRow.org_id).gte("scheduled_start", monthStart.toISOString()),
    admin.from("ai_usage_logs").select("id", { count: "exact", head: true }).eq("org_id", userRow.org_id).gte("created_at", monthStart.toISOString()),
  ]);

  const TIER_CEILINGS: Record<string, number> = { essential: 15, growth: 50, professional: 150 };
  const ceiling = TIER_CEILINGS[org.stripe_plan_tier] ?? null;

  const prompt = `A UK care provider manager is looking at their Autopilot subscription usage. Current plan: ${org.stripe_plan_tier} (covers up to ${ceiling ?? "unlimited"} active service users).

Real usage this month:
- Active service users (billed): ${activeUserCount}
- Staff members: ${staffCount ?? 0}
- Visits scheduled/completed: ${visitsThisMonth ?? 0}
- AI feature calls: ${aiCallsThisMonth ?? 0}

Write ONE short, specific sentence (max 30 words) telling the manager whether their current plan still fits their real usage, or whether upgrading to the next tier would help — and why, using the real numbers above. Never invent a number not given here. If usage is comfortably within the plan, say so plainly rather than manufacturing a reason to upgrade.`;

  const result = await callClaude({ prompt, maxTokens: MAX_TOKENS });
  if (!result) return NextResponse.json({ text: null });

  await admin.from("ai_usage_logs").insert({
    org_id: userRow.org_id,
    feature: FEATURE,
    tokens_used: result.inputTokens + result.outputTokens,
    cost_estimate: estimateCost(result.inputTokens, result.outputTokens),
  });

  return NextResponse.json({ text: result.text });
}
