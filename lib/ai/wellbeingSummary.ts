import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { callClaude, estimateCost } from "@/lib/anthropic/client";

// Source: PRD section 6.3 ("Wellbeing this week" card — "AI-generated
// plain-English wellbeing summary for the week"). Not one of the AI
// Feature Specification's 9 documented features — added as a 10th,
// modelled on section 4.5's (Dashboard AI Summary) conventions, per
// explicit confirmation from Gokul (see CLAUDE.md Session 10 log).
export const WELLBEING_SUMMARY_FEATURE = "wellbeing_summary";
const DAILY_LIMIT = 50;
const MAX_TOKENS = 150;

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfWeekUTC(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff));
}

export async function getWellbeingSummary(
  supabase: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  orgId: string,
  clientId: string,
  clientFirstName: string,
): Promise<string | null> {
  const { data: org } = await supabase.from("organisations").select("status").eq("id", orgId).single();
  if (org?.status === "trial") return null;

  const { count: usageToday } = await admin
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("feature", WELLBEING_SUMMARY_FEATURE)
    .gte("created_at", startOfTodayUTC().toISOString());

  if ((usageToday ?? 0) >= DAILY_LIMIT) return null;

  const weekStart = startOfWeekUTC(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 5); // Mon-Fri window, matching the 5-box grid

  const { data: visits } = await supabase
    .from("visits")
    .select("scheduled_start, wellbeing_rating, visit_notes")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .gte("scheduled_start", weekStart.toISOString())
    .lt("scheduled_start", weekEnd.toISOString())
    .order("scheduled_start", { ascending: true });

  const rated = (visits ?? []).filter((v) => v.wellbeing_rating);
  if (rated.length === 0) return null;

  const lines = rated.map((v) => `- ${new Date(v.scheduled_start).toLocaleDateString("en-GB", { weekday: "long" })}: ${v.wellbeing_rating}${v.visit_notes ? ` — ${v.visit_notes}` : ""}`);

  const prompt = `Write a brief, warm, plain-English summary of this care client's wellbeing this week, for their family member to read. Base it only on the ratings and notes below — do not invent details. Maximum 2 sentences.

Client first name: ${clientFirstName}

This week's wellbeing ratings:
${lines.join("\n")}

Write the summary now.`;

  const result = await callClaude({ prompt, maxTokens: MAX_TOKENS });
  if (!result) return null;

  await admin.from("ai_usage_logs").insert({
    org_id: orgId,
    feature: WELLBEING_SUMMARY_FEATURE,
    tokens_used: result.inputTokens + result.outputTokens,
    cost_estimate: estimateCost(result.inputTokens, result.outputTokens),
  });

  return result.text;
}
