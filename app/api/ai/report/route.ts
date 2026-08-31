import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamClaude, estimateCost } from "@/lib/anthropic/client";
import { gatherReportContext } from "@/lib/ai/reportContext";

// Source: AI Feature Specification section 4.6, section 5.1 (daily limit:
// 10 per org — "Report generation").
const FEATURE = "report_generation";
const DAILY_LIMIT = 10;
const MAX_TOKENS = 2000;

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Rough token estimate (chars/4) for cost logging on the streamed path —
// the streaming API doesn't give an exact count without a second call to
// wait on the stream's own finalMessage(), which isn't worth the added
// complexity for a rate-limit/cost-tracking approximation.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const prompt = typeof body === "object" && body !== null ? (body as Record<string, unknown>).prompt : null;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return new Response(JSON.stringify({ error: "Invalid request." }), { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { data: userRow } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!userRow || userRow.role !== "manager") {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const { data: org } = await supabase.from("organisations").select("status").eq("id", userRow.org_id).single();
  if (!org || org.status === "trial") {
    return new Response(JSON.stringify({ error: "AI features are available on paid plans. Upgrade to access." }), { status: 403 });
  }

  const admin = createAdminClient();
  const { count: usageToday } = await admin
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", userRow.org_id)
    .eq("feature", FEATURE)
    .gte("created_at", startOfTodayUTC().toISOString());

  if ((usageToday ?? 0) >= DAILY_LIMIT) {
    return new Response(JSON.stringify({ error: "Daily report generation limit reached. Try again tomorrow." }), { status: 429 });
  }

  const context = await gatherReportContext(supabase, userRow.org_id, prompt);

  const fullPrompt = `You are generating a report for a UK care provider. Use the data provided. Do not invent statistics. If data for a specific request is not available, say so.

Manager's request: ${prompt}

Available data:
${JSON.stringify(context, null, 2)}

Format the report with clear headings. Use plain English. Include specific numbers from the data. At the end, note any limitations (e.g. "Medication compliance data not available for this period").`;

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamClaude({ prompt: fullPrompt, maxTokens: MAX_TOKENS })) {
          fullText += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        console.error("AI report streaming failed:", error);
        if (fullText.length === 0) {
          controller.enqueue(encoder.encode("__AI_REPORT_ERROR__"));
        }
      } finally {
        controller.close();
        if (fullText.length > 0) {
          const inputTokens = estimateTokens(fullPrompt);
          const outputTokens = estimateTokens(fullText);
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
