import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, estimateCost } from "@/lib/anthropic/client";

// Source: AI Feature Specification section 4.3 (Incident Report Draft),
// section 5.1 (daily limit: 50 per org)
const FEATURE = "incident_draft";
const DAILY_LIMIT = 50;
const MAX_TOKENS = 250;

interface DraftIncidentBody {
  clientId: string;
  incidentType: string;
  severity: string;
  gpContacted: boolean;
  gpNotes: string | null;
  existingDescription: string | null;
}

function isDraftIncidentBody(value: unknown): value is DraftIncidentBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.clientId === "string" &&
    typeof body.incidentType === "string" &&
    typeof body.severity === "string" &&
    typeof body.gpContacted === "boolean" &&
    (body.gpNotes === null || typeof body.gpNotes === "string") &&
    (body.existingDescription === null || typeof body.existingDescription === "string")
  );
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isDraftIncidentBody(body)) {
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

  const { data: client } = await supabase.from("clients").select("first_name").eq("id", body.clientId).single();
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  // Source: user feedback during Session 9's real-device test (see
  // CLAUDE.md log) — the AI Feature Spec's documented prompt never
  // considers text the carer already typed, so tapping "AI draft" after
  // writing something always overwrote it with unrelated boilerplate.
  // When there's existing text, reword it into clean, factual, audit-ready
  // wording instead of generating a fresh report from the structured
  // fields alone — the carer's own account of events is preserved, not
  // replaced.
  const hasExistingText = !!body.existingDescription?.trim();

  const prompt = hasExistingText
    ? `Reword the following incident description into clean, professional, factual wording suitable for a UK care provider's audit record. Use past tense. Plain text only — no markdown, no headings, no bullet points.

Stay strictly within what the carer actually wrote:
- Do not add any fact, detail, time, or figure that is not already stated in the carer's original text.
- Do not add clinical conclusions, opinions, or recommendations of any kind — no suggested actions, no hazard assessments, nothing beyond what happened.
- If something (e.g. a time) is missing from the original text, simply omit it rather than inventing or flagging it.
- Only change wording, structure, and tone — every fact in your output must come directly from the original text below.

Maximum 5 sentences.

Client first name: ${client.first_name}
Incident type: ${body.incidentType}
Severity: ${body.severity}
GP contacted: ${body.gpContacted ? "Yes" : "No"}
${body.gpNotes ? `GP advice: ${body.gpNotes}` : ""}

Carer's original description:
${body.existingDescription}

Write the reworded description now — plain text, no formatting, no additions.`
    : `Write a structured incident report for a UK care provider. Use past tense. Be factual and objective. Do not state clinical conclusions (e.g. do not say "no injury" unless the carer has explicitly confirmed this). Maximum 5 sentences.

Client first name: ${client.first_name}
Incident type: ${body.incidentType}
Severity: ${body.severity}
GP contacted: ${body.gpContacted ? "Yes" : "No"}
${body.gpNotes ? `GP advice: ${body.gpNotes}` : ""}

Write the description section of the incident report now. Begin with "During ${client.first_name}'s visit..."`;

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
