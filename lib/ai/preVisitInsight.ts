import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { callClaude, estimateCost } from "@/lib/anthropic/client";

// Source: AI Feature Specification section 4.1 (Pre-visit Insight). Fires
// automatically when the carer opens Visit Detail ("Triggered by: Carer
// opening the Visit Detail screen") — server-rendered, not a client-side
// fetch — so this lives here as a plain function, imported directly by
// app/(carer)/visit/[visitId]/page.tsx and by the /api/ai/pre-visit route
// (built per Sessions.md step 12 for consistency/future callers), matching
// the Session 7 incidentInsight.ts precedent for auto-firing AI features.
export const PRE_VISIT_INSIGHT_FEATURE = "pre_visit_insight";
const DAILY_LIMIT = 200;
const MAX_TOKENS = 80;

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getPreVisitInsight(
  supabase: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  orgId: string,
  clientId: string,
): Promise<string | null> {
  // CLAUDE.md rule 9 / AI Feature Spec 5.4: AI features are disabled for
  // trial accounts. Checked here (not just in the /api/ai/pre-visit route)
  // because this function also fires directly from server rendering, with
  // no route in between to gate it.
  const { data: org } = await supabase.from("organisations").select("status").eq("id", orgId).single();
  if (org?.status === "trial") return null;

  const { count: usageToday } = await admin
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("feature", PRE_VISIT_INSIGHT_FEATURE)
    .gte("created_at", startOfTodayUTC().toISOString());

  if ((usageToday ?? 0) >= DAILY_LIMIT) return null;

  const { data: client } = await supabase.from("clients").select("first_name").eq("id", clientId).single();
  if (!client) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: recentVisits }, { data: openIncidents }, { data: recentMessages }] = await Promise.all([
    supabase
      .from("visits")
      .select("visit_notes, check_out_time, wellbeing_rating")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .order("check_out_time", { ascending: false })
      .limit(3),
    supabase
      .from("incidents")
      .select("incident_type, severity, description, created_at")
      .eq("client_id", clientId)
      .eq("status", "open")
      .limit(2),
    supabase
      .from("messages")
      .select("body, sender_role, created_at")
      .eq("client_id", clientId)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const visitLines = (recentVisits ?? [])
    .map((v) => `- ${v.check_out_time}: ${v.visit_notes || "No notes recorded"} (Wellbeing: ${v.wellbeing_rating || "not logged"})`)
    .join("\n");
  const incidentLines =
    (openIncidents ?? []).length > 0
      ? (openIncidents ?? []).map((i) => `- ${i.incident_type} (${i.severity}): ${i.description}`).join("\n")
      : "None";
  const messageLines =
    (recentMessages ?? []).length > 0
      ? (recentMessages ?? []).map((m) => `- ${m.sender_role}: ${m.body}`).join("\n")
      : "None";

  const prompt = `You are generating a brief pre-visit note for a carer about to visit a client.

Client first name: ${client.first_name}

Recent visit notes (most recent first):
${visitLines || "None"}

Open incidents:
${incidentLines}

Recent family messages:
${messageLines}

Write a single sentence (maximum 25 words) that the carer should know before arriving. Focus on the most relevant piece of information. If there is nothing notable, return exactly: null`;

  const result = await callClaude({ prompt, maxTokens: MAX_TOKENS });
  if (!result) return null;

  await admin.from("ai_usage_logs").insert({
    org_id: orgId,
    feature: PRE_VISIT_INSIGHT_FEATURE,
    tokens_used: result.inputTokens + result.outputTokens,
    cost_estimate: estimateCost(result.inputTokens, result.outputTokens),
  });

  const text = result.text.trim();
  if (text.toLowerCase() === "null") return null;
  return text;
}
