import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, estimateCost } from "@/lib/anthropic/client";

// Source: AI Feature Specification section 4.8 (AI Rota Suggestion),
// section 5.1 (daily limit: 30 per org).
//
// The spec's own data-gathering code queries `visits` for "affected
// visits," but nothing in the app creates visits rows yet (visit
// scheduling/logging isn't a Session 6 deliverable) — so "affected visits"
// is derived from the sick carer's own rota_shifts.assigned_client_ids for
// that day instead, which is real, populated data. This still satisfies
// ROTA-04's intent (clients who now need cover because their carer is
// sick) without fabricating data that doesn't exist (AI Feature Spec
// Global Principle 1).
const FEATURE = "rota_suggestion";
const DAILY_LIMIT = 30;
const MAX_TOKENS = 60;

interface RotaSuggestionBody {
  sickStaffId: string;
  sickStaffName: string;
  date: string;
}

function isRotaSuggestionBody(value: unknown): value is RotaSuggestionBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return typeof body.sickStaffId === "string" && typeof body.sickStaffName === "string" && typeof body.date === "string";
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function calculateHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isRotaSuggestionBody(body)) {
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
    return NextResponse.json({ text: null });
  }

  const [{ data: sickShift }, { data: availableShifts }] = await Promise.all([
    supabase
      .from("rota_shifts")
      .select("assigned_client_ids")
      .eq("staff_id", body.sickStaffId)
      .eq("shift_date", body.date)
      .maybeSingle(),
    supabase
      .from("rota_shifts")
      .select("staff_id, assigned_client_ids, start_time, end_time, staff:staff_id(role, users(first_name, last_name))")
      .eq("org_id", userRow.org_id)
      .eq("shift_date", body.date)
      .not("shift_type", "in", "(sick_leave,off,annual_leave)")
      .neq("staff_id", body.sickStaffId),
  ]);

  const affectedClientIds = sickShift?.assigned_client_ids ?? [];
  if (affectedClientIds.length === 0) {
    return NextResponse.json({ text: null });
  }

  const { data: affectedClients } = await supabase.from("clients").select("first_name").in("id", affectedClientIds);

  const staffWithCapacity = (availableShifts ?? []).map((s) => {
    const staffRow = Array.isArray(s.staff) ? s.staff[0] : s.staff;
    const userRow2 = staffRow ? (Array.isArray(staffRow.users) ? staffRow.users[0] : staffRow.users) : null;
    return {
      staffId: s.staff_id,
      name: userRow2 ? `${userRow2.first_name} ${userRow2.last_name}` : "Unknown",
      assignedCount: s.assigned_client_ids.length,
      hoursWorked: calculateHours(s.start_time, s.end_time),
      startTime: s.start_time,
      endTime: s.end_time,
    };
  });

  if (staffWithCapacity.length === 0) {
    return NextResponse.json({ text: "No suitable cover available today.", suggestedStaffId: null });
  }

  const candidate = [...staffWithCapacity].sort((a, b) => a.assignedCount - b.assignedCount || a.name.localeCompare(b.name))[0];

  const affectedDescription = (affectedClients ?? []).map((c) => `Client ${c.first_name}`).join(", ");

  const prompt = `A care worker is on sick leave today. Suggest the best available cover.

Sick staff member: ${body.sickStaffName}
Affected visits: ${affectedDescription}

Available staff today:
${staffWithCapacity.map((s) => `- ${s.name}: ${s.assignedCount} clients already assigned, shift ${s.startTime ?? "?"}-${s.endTime ?? "?"}`).join("\n")}

Choose the staff member with the lowest current workload who has capacity to cover the affected visits. Respond in this format:
"[Staff name] is available and could cover [description of affected visits]."

One sentence only. If no suitable cover is available, respond: "No suitable cover available today."`;

  const result = await callClaude({ prompt, maxTokens: MAX_TOKENS });

  if (!result) {
    return NextResponse.json({ text: null });
  }

  await admin.from("ai_usage_logs").insert({
    org_id: userRow.org_id,
    feature: FEATURE,
    tokens_used: result.inputTokens + result.outputTokens,
    cost_estimate: estimateCost(result.inputTokens, result.outputTokens),
  });

  const noCover = result.text.toLowerCase().includes("no suitable cover");

  return NextResponse.json({ text: result.text, suggestedStaffId: noCover ? null : candidate.staffId });
}
