import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { callClaude, estimateCost } from "@/lib/anthropic/client";

// Source: AI Feature Specification section 4.9 (AI Incident Pattern
// Detection). Fires automatically during server rendering of the
// incidents list (PRD 4.6: "server-side, not on demand"), not via a
// client-triggered fetch like every other AI feature in the app — so the
// core logic lives here as a plain function, imported directly by both
// app/(manager)/incidents/page.tsx and the /api/ai/incident-insight route
// (which exists per Sessions.md step 4, but the page doesn't self-fetch it
// — see route.ts for why).
//
// No daily limit is documented for this specific feature in AI Feature
// Spec section 5.1 (only "Incident drafts" — a different, carer-side
// feature — is listed). Reused that value (50/day) as a reasonable,
// similarly-scoped default since this call is equally cheap (max_tokens
// 60) and only fires for qualifying incidents, not on every page view.
export const INCIDENT_INSIGHT_FEATURE = "incident_pattern_detection";
const DAILY_LIMIT = 50;
const MAX_TOKENS = 60;

interface IncidentForInsight {
  id: string;
  client_id: string;
  incident_type: string;
  description: string;
  created_at: string;
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

interface InsightContext {
  // Perf fix, 2026-09-06: the incidents LIST page calls this once per row
  // via Promise.all, and every row was independently re-querying the
  // identical org status plus its own pattern-count — a real N+1 that
  // measured as the single biggest contributor to that page's ~2.3s TTFB.
  // The list page already has every incident's type/client/date in memory
  // from its own single initial query, so it can compute both values with
  // zero extra DB round trips and pass them in here. The detail page calls
  // this for exactly one incident at a time, so it omits both and keeps
  // its original (still cheap, now unavoidable-for-a-single-call) behaviour.
  orgStatus?: string;
  patternCount?: number;
}

export async function getIncidentInsight(
  supabase: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  orgId: string,
  incident: IncidentForInsight,
  context: InsightContext = {},
): Promise<string | null> {
  // CLAUDE.md rule 9 / AI Feature Spec 5.4: AI features are disabled for
  // trial accounts. This function fires directly from server rendering
  // (see the comment above), with no API route in between to gate it, so
  // the check has to live here rather than only in /api/ai/incident-insight.
  let orgStatus = context.orgStatus;
  if (orgStatus === undefined) {
    const { data: org } = await supabase.from("organisations").select("status").eq("id", orgId).single();
    orgStatus = org?.status;
  }
  if (orgStatus === "trial") return null;

  let patternCount = context.patternCount;
  if (patternCount === undefined) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("client_id", incident.client_id)
      .eq("incident_type", incident.incident_type)
      .gte("created_at", thirtyDaysAgo);
    patternCount = count ?? 0;
  }

  if (!patternCount || patternCount < 2) return null;

  const { count: usageToday } = await admin
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("feature", INCIDENT_INSIGHT_FEATURE)
    .gte("created_at", startOfTodayUTC().toISOString());

  if ((usageToday ?? 0) >= DAILY_LIMIT) return null;

  const { data: client } = await supabase.from("clients").select("first_name").eq("id", incident.client_id).single();
  if (!client) return null;

  const prompt = `A care client has had ${patternCount} incidents of type "${incident.incident_type}" in the last 30 days.

Client first name: ${client.first_name}
Incident type: ${incident.incident_type}
Count in 30 days: ${patternCount}
Most recent description: ${incident.description}

Write one sentence (maximum 20 words) suggesting what action the care team should consider. Be specific to the incident type.`;

  const result = await callClaude({ prompt, maxTokens: MAX_TOKENS });
  if (!result) return null;

  await admin.from("ai_usage_logs").insert({
    org_id: orgId,
    feature: INCIDENT_INSIGHT_FEATURE,
    tokens_used: result.inputTokens + result.outputTokens,
    cost_estimate: estimateCost(result.inputTokens, result.outputTokens),
  });

  return result.text;
}
