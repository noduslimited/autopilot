import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, estimateCost } from "@/lib/anthropic/client";
import { describeExistingShift } from "@/lib/rota/conflicts";

// Source: Gokul, direct request 2026-09-03 — Rota redesign item 8.7
// ("AI scheduling — plain-English text input, AI creates shifts via
// existing AI infra"). Not one of the AI Feature Specification's
// original 9 features (same precedent as Session 10's wellbeing summary
// — a new AI feature added on direct instruction gets the same
// trial-gating/rate-limiting/graceful-degradation conventions as every
// other one). The AI never writes to rota_shifts directly — it only
// proposes; the manager reviews and confirms each shift client-side
// through the exact same conflict-aware save path a manually-added shift
// uses (RotaGrid's saveShiftDirect).
const FEATURE = "rota_schedule";
const DAILY_LIMIT = 30;
const MAX_TOKENS = 1000;

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

interface RawShiftProposal {
  staffName?: string;
  clientNames?: string[];
  date?: string;
  startTime?: string;
  endTime?: string;
}

function parseProposals(text: string): RawShiftProposal[] {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { shifts?: unknown };
    if (!Array.isArray(parsed.shifts)) return [];
    return parsed.shifts as RawShiftProposal[];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const prompt = body && typeof body === "object" && typeof (body as { prompt?: unknown }).prompt === "string" ? (body as { prompt: string }).prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

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
    return NextResponse.json({ proposals: null });
  }

  const [{ data: staffRows }, { data: clientRows }] = await Promise.all([
    supabase.from("staff").select("id, users(first_name, last_name)").eq("org_id", userRow.org_id),
    supabase.from("clients").select("id, first_name, last_name").eq("org_id", userRow.org_id).eq("status", "active"),
  ]);

  const staffList = (staffRows ?? []).map((s) => {
    const person = Array.isArray(s.users) ? s.users[0] : s.users;
    return { id: s.id, name: person ? `${person.first_name} ${person.last_name}` : "Unknown" };
  });
  const clientList = (clientRows ?? []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }));

  if (staffList.length === 0) {
    return NextResponse.json({ proposals: [] });
  }

  const now = new Date();
  const todayLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const aiPrompt = `A care manager wants to schedule rota shifts using plain English. Today is ${todayLabel} (${now.toISOString().slice(0, 10)}).

Available carers: ${staffList.map((s) => s.name).join(", ")}
Active clients: ${clientList.map((c) => c.name).join(", ") || "(none)"}

Manager's request: "${prompt}"

Respond with ONLY a JSON object (no markdown, no explanation outside the JSON) in exactly this shape:
{"shifts":[{"staffName":"exact carer name from the list above","clientNames":["exact client name(s) from the list above, if any"],"date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM"}]}

Rules:
- Only use carer and client names exactly as given above — never invent a name.
- Resolve relative dates ("next Monday", "every day this week") into one concrete entry per actual date.
- If the request is ambiguous or impossible to resolve from the given names, return {"shifts":[]}.
- Times are 24-hour HH:MM.`;

  const result = await callClaude({ prompt: aiPrompt, maxTokens: MAX_TOKENS });
  if (!result) return NextResponse.json({ proposals: null });

  await admin.from("ai_usage_logs").insert({
    org_id: userRow.org_id,
    feature: FEATURE,
    tokens_used: result.inputTokens + result.outputTokens,
    cost_estimate: estimateCost(result.inputTokens, result.outputTokens),
  });

  const raw = parseProposals(result.text);
  if (raw.length === 0) return NextResponse.json({ proposals: [] });

  const dates = Array.from(new Set(raw.map((r) => r.date).filter((d): d is string => !!d)));
  const staffIds = Array.from(
    new Set(
      raw
        .map((r) => staffList.find((s) => s.name.toLowerCase() === (r.staffName ?? "").toLowerCase())?.id)
        .filter((id): id is string => !!id),
    ),
  );

  const { data: existingShifts } =
    dates.length > 0 && staffIds.length > 0
      ? await supabase
          .from("rota_shifts")
          .select("id, staff_id, shift_date, start_time, end_time, shift_type")
          .in("staff_id", staffIds)
          .in("shift_date", dates)
      : { data: [] };

  const proposals = raw.map((r) => {
    const matchedStaff = staffList.find((s) => s.name.toLowerCase() === (r.staffName ?? "").toLowerCase());
    const matchedClients = (r.clientNames ?? [])
      .map((name) => clientList.find((c) => c.name.toLowerCase() === name.toLowerCase()))
      .filter((c): c is { id: string; name: string } => !!c);
    const unmatchedClientNames = (r.clientNames ?? []).filter(
      (name) => !clientList.some((c) => c.name.toLowerCase() === name.toLowerCase()),
    );

    const existing = matchedStaff ? (existingShifts ?? []).find((s) => s.staff_id === matchedStaff.id && s.shift_date === r.date) : null;
    const conflict = existing && matchedStaff ? describeExistingShift(existing, matchedStaff.name).message : null;

    return {
      staffId: matchedStaff?.id ?? null,
      staffName: r.staffName ?? "Unknown",
      staffMatched: !!matchedStaff,
      clientIds: matchedClients.map((c) => c.id),
      clientNames: matchedClients.map((c) => c.name),
      unmatchedClientNames,
      date: r.date ?? "",
      startTime: r.startTime ?? "",
      endTime: r.endTime ?? "",
      conflict,
    };
  });

  return NextResponse.json({ proposals });
}
