import Anthropic from "@anthropic-ai/sdk";

// Source: AI Feature Specification section 1 (model), section 3 (shared
// system prompt), section 6 (error handling reference).
const MODEL = "claude-sonnet-4-6";
const TIMEOUT_MS = 10_000;

export const SHARED_SYSTEM_PROMPT = `You are the AI assistant for Autopilot, a UK care management platform built for CQC-regulated care providers. You help care managers and carers work more efficiently.

You have access to real data from the care provider's system. Only use the data provided to you in this message. Do not invent or assume information that is not explicitly given.

Your outputs will be read by registered care professionals. Be clear, concise, and professional. Use plain English — not clinical jargon. Avoid unnecessary hedging or caveats.

Never make clinical diagnoses or treatment recommendations. Never suggest medication changes. Never make statements about a client's prognosis or medical condition beyond what is documented in the provided records.

If the data provided is insufficient to answer the request, say so clearly and briefly.`;

// This project's ANTHROPIC_API_KEY is an identity-linked key, which
// requires an anthropic-workspace-id header naming which workspace the
// request acts in — the API rejects calls without it (400
// invalid_request_error). Set ANTHROPIC_WORKSPACE_ID in .env.local once
// known; every AI route works through this shared client so it only needs
// setting in one place.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: TIMEOUT_MS,
  defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID
    ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID }
    : undefined,
});

export interface CallClaudeParams {
  prompt: string;
  maxTokens: number;
  system?: string;
}

export interface CallClaudeResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

// Approximate Claude Sonnet rate per AI Feature Specification section 5.3.
const COST_PER_TOKEN = 0.000003;

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens + outputTokens) * COST_PER_TOKEN;
}

// Graceful degradation is mandatory (CLAUDE.md rule 9, AI Feature Spec
// section 6): any failure — timeout, rate limit, server error, malformed
// response — returns null rather than throwing, so every caller can hide
// the AI element silently with no error shown to the user. Rate limits
// (429) get one retry after 2s per the spec's error handling table;
// everything else fails immediately.
export async function callClaude({
  prompt,
  maxTokens,
  system,
}: CallClaudeParams): Promise<CallClaudeResult | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: system ?? SHARED_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text",
      );
      const text = textBlock?.text.trim();
      if (!text) return null;

      return {
        text,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (error) {
      const isRateLimit = error instanceof Anthropic.APIError && error.status === 429;
      if (isRateLimit && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      console.error("Anthropic API call failed:", error);
      return null;
    }
  }
  return null;
}

export interface StreamClaudeParams {
  prompt: string;
  maxTokens: number;
  system?: string;
}

// Streaming variant — only used by AI Report Generation (AI Feature Spec
// section 4.6, "stream: true" for progressive rendering). No retry-on-429
// here (unlike callClaude): a stream that's already started can't be
// meaningfully retried, so any failure — before or during the stream —
// is surfaced to the caller as a thrown error for it to handle per the
// spec's own error copy ("Report generation is temporarily unavailable").
export async function* streamClaude({ prompt, maxTokens, system }: StreamClaudeParams): AsyncGenerator<string> {
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system: system ?? SHARED_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}
