import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, streamClaude, estimateCost } from "@/lib/anthropic/client";
import { gatherCopilotContext, gatherFamilyMessagesContext } from "@/lib/ai/copilotContext";

// Source: AI Feature Specification section 4.7 (Morning Briefing) and
// PRD section 4.9 (AI Copilot chat). Both request types share one daily
// limit — the spec's rate-limit table (section 5.1) lists a single
// "Copilot messages" entry (100/day), not separate ones per request type.
const FEATURE = "copilot_message";
const DAILY_LIMIT = 100;

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

interface ChatMessage {
  role: "manager" | "ai";
  content: string;
}

interface CopilotBody {
  type: "briefing" | "chat";
  message?: string;
  history?: ChatMessage[];
}

function isCopilotBody(value: unknown): value is CopilotBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return body.type === "briefing" || body.type === "chat";
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isCopilotBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase.from("users").select("org_id, role, first_name").eq("id", user.id).single();
  if (!userRow || userRow.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase.from("organisations").select("status, name").eq("id", userRow.org_id).single();
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
    return body.type === "briefing"
      ? NextResponse.json({ briefing: null })
      : new Response(null, { status: 429 });
  }

  const context = await gatherCopilotContext(supabase, userRow.org_id, org.name);

  if (body.type === "briefing") {
    const familyMessages = await gatherFamilyMessagesContext(supabase, userRow.org_id);

    const prompt = `Generate a morning briefing for a care manager. Today is ${context.date}.

Produce up to 3 alert items. Each item must be in this JSON format:
{
  "type": "danger" | "warning" | "info",
  "icon": "alert-circle" | "pill" | "file-text" | "users",
  "text": "[one sentence, max 20 words]"
}

Only include items where there is a genuine issue to flag. If there are no issues, return:
{ "allClear": true, "summary": "[1 sentence positive summary]" }

Data:
${JSON.stringify({ ...context, unread_family_messages: familyMessages }, null, 2)}

Return valid JSON only. No markdown. No additional text.`;

    const result = await callClaude({ prompt, maxTokens: 300 });
    if (!result) return NextResponse.json({ briefing: null });

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, ""));
    } catch {
      return NextResponse.json({ briefing: null });
    }

    await admin.from("ai_usage_logs").insert({
      org_id: userRow.org_id,
      feature: FEATURE,
      tokens_used: result.inputTokens + result.outputTokens,
      cost_estimate: estimateCost(result.inputTokens, result.outputTokens),
    });

    return NextResponse.json({ briefing: parsed });
  }

  // Chat
  if (!body.message || !body.message.trim()) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const historyText = (body.history ?? [])
    .map((m) => `${m.role === "manager" ? "Manager" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `You are the AI Copilot for a UK care management platform, helping a care manager named ${userRow.first_name}.

Current context:
${JSON.stringify(context, null, 2)}

${historyText ? `Conversation so far:\n${historyText}\n` : ""}
Manager: ${body.message.trim()}

Respond helpfully and specifically, referencing real data from the context above. Do not invent information not present in the context. Keep the response focused and practical.`;

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamClaude({ prompt, maxTokens: 800 })) {
          fullText += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        console.error("Copilot chat streaming failed:", error);
        if (fullText.length === 0) controller.enqueue(encoder.encode("__AI_COPILOT_ERROR__"));
      } finally {
        controller.close();
        if (fullText.length > 0) {
          const inputTokens = Math.ceil(prompt.length / 4);
          const outputTokens = Math.ceil(fullText.length / 4);
          await admin.from("ai_usage_logs").insert({
            org_id: userRow.org_id,
            feature: FEATURE,
            tokens_used: inputTokens + outputTokens,
            cost_estimate: estimateCost(inputTokens, outputTokens),
          });
        }
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
