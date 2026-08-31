import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, estimateCost } from "@/lib/anthropic/client";

// Source: AI Feature Specification section 4.2 (Visit Note Draft),
// section 5.1 (daily limit: 100 per org)
const FEATURE = "visit_note_draft";
const DAILY_LIMIT = 100;
const MAX_TOKENS = 200;

interface DraftNoteBody {
  visitId: string;
  existingNotes: string;
}

function isDraftNoteBody(value: unknown): value is DraftNoteBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return typeof body.visitId === "string" && typeof body.existingNotes === "string";
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isDraftNoteBody(body)) {
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

  // RLS (carers_own_visits) confirms this visit belongs to the calling carer.
  const { data: visit } = await supabase.from("visits").select("id, client_id").eq("id", body.visitId).single();
  if (!visit) {
    return NextResponse.json({ error: "Visit not found." }, { status: 404 });
  }

  const [{ data: client }, { data: completedTasks }, { data: emarRecords }] = await Promise.all([
    supabase.from("clients").select("first_name").eq("id", visit.client_id).single(),
    supabase.from("visit_tasks").select("task_label").eq("visit_id", visit.id).eq("completed", true),
    supabase
      .from("emar_records")
      .select("administered, reason_not_administered, medications(medication_name)")
      .eq("visit_id", visit.id),
  ]);

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const medicationLines = (emarRecords ?? []).map((r) => {
    const medication = Array.isArray(r.medications) ? r.medications[0] : r.medications;
    const name = medication?.medication_name ?? "Medication";
    return r.administered ? `- ${name}: Administered` : `- ${name}: Not administered — ${r.reason_not_administered}`;
  });

  const prompt = `Write a professional care visit note for a UK domiciliary care provider. Use past tense. Be factual and concise. Maximum 4 sentences.

Client first name: ${client.first_name}

Tasks completed during this visit:
${(completedTasks ?? []).map((t) => `- ${t.task_label}`).join("\n") || "None recorded"}

Medication administration:
${medicationLines.join("\n") || "No medications logged"}

Any additional carer notes already entered:
${body.existingNotes || "None"}

Write the visit note now. Do not include the client's surname. Do not include medical opinions or diagnoses.`;

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
