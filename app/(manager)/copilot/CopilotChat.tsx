"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Select, FieldLabel, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export interface NamedEntity {
  id: string;
  name: string;
  type: "staff" | "client";
}

interface BriefingAlertItem {
  type: "danger" | "warning" | "info";
  icon: string;
  text: string;
}
type BriefingResult = { allClear: true; summary: string } | BriefingAlertItem[];

interface ChatMessage {
  id: string;
  role: "ai" | "manager";
  content: string;
  timestamp: string;
  briefing?: BriefingResult;
  streaming?: boolean;
  mentionedEntities?: NamedEntity[];
  showCarePlanActions?: boolean;
  showDownloadPdf?: boolean;
}

const PROMPT_CHIPS = ["Which staff are overdue training?", "Summarise this week's visits", "Generate August CQC report"];

const ALERT_STYLES: Record<BriefingAlertItem["type"], string> = {
  danger: "bg-danger-red-light text-danger-red",
  warning: "bg-amber-light text-amber-text",
  info: "bg-ai-blue-light text-ai-blue-text",
};

const ALERT_ICONS: Record<string, string> = {
  "alert-circle": "alert-circle",
  pill: "pill",
  "file-text": "file-text",
  users: "users",
};

// crypto.randomUUID() is only available in secure browser contexts
// (HTTPS, or localhost) — this dev environment is only reachable via a
// LAN IP over plain HTTP (see CLAUDE.md session logs), where it throws.
// These are just local React keys, not real identifiers, so a simple
// fallback is fine.
function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function initialsOf(name: string): string {
  return name.split(" ").filter(Boolean).map((p) => p[0]!.toUpperCase()).slice(0, 2).join("");
}

export function CopilotChat({
  managerName,
  managerFirstName,
  entities,
}: {
  managerName: string;
  managerFirstName: string;
  entities: NamedEntity[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [savePlanTarget, setSavePlanTarget] = useState<{ text: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const briefingRequested = useRef(false);

  useEffect(() => {
    const key = `copilot_briefed_${new Date().toISOString().slice(0, 10)}`;
    if (typeof window === "undefined" || briefingRequested.current) return;
    briefingRequested.current = true;
    let cached = false;
    try {
      cached = !!window.localStorage.getItem(key);
    } catch {
      // localStorage unavailable — just request the briefing anyway.
    }
    if (cached) return;

    (async () => {
      const response = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "briefing" }),
      }).catch(() => null);

      if (!response || !response.ok) return;
      const data: { briefing: BriefingResult | null } = await response.json();
      if (!data.briefing) return;

      setMessages((current) => [
        ...current,
        {
          id: generateId(),
          role: "ai",
          content: `Good morning, ${managerFirstName}. Here's your briefing for ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.`,
          timestamp: nowLabel(),
          briefing: data.briefing!,
        },
      ]);
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        // Non-fatal — briefing may re-request next load, acceptable.
      }
    })();
  }, [managerFirstName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function detectEntities(text: string): NamedEntity[] {
    const lower = text.toLowerCase();
    return entities.filter((e) => lower.includes(e.name.toLowerCase()));
  }

  async function handleSend(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    setInput("");

    const managerMessage: ChatMessage = { id: generateId(), role: "manager", content: text.trim(), timestamp: nowLabel() };
    const aiMessageId = generateId();
    setMessages((current) => [
      ...current,
      managerMessage,
      { id: aiMessageId, role: "ai", content: "", timestamp: nowLabel(), streaming: true },
    ]);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    const response = await fetch("/api/ai/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "chat", message: text.trim(), history }),
    }).catch(() => null);

    if (!response || !response.ok || !response.body) {
      setMessages((current) =>
        current.map((m) =>
          m.id === aiMessageId ? { ...m, content: "AI Copilot is temporarily unavailable. Please try again shortly.", streaming: false } : m,
        ),
      );
      setSending(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk.includes("__AI_COPILOT_ERROR__") && full.length === 0) {
        setMessages((current) =>
          current.map((m) =>
            m.id === aiMessageId ? { ...m, content: "AI Copilot is temporarily unavailable. Please try again shortly.", streaming: false } : m,
          ),
        );
        setSending(false);
        return;
      }
      full += chunk;
      setMessages((current) => current.map((m) => (m.id === aiMessageId ? { ...m, content: full } : m)));
    }

    const lowerCombined = `${text} ${full}`.toLowerCase();
    setMessages((current) =>
      current.map((m) =>
        m.id === aiMessageId
          ? {
              ...m,
              streaming: false,
              mentionedEntities: detectEntities(full),
              showCarePlanActions: lowerCombined.includes("care plan"),
              showDownloadPdf: lowerCombined.includes("report") || lowerCombined.includes("cqc") || lowerCombined.includes("summary"),
            }
          : m,
      ),
    );
    setSending(false);
  }

  function handlePrintMessage(content: string) {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>AI Copilot report</title></head><body style="font-family:sans-serif;white-space:pre-line;padding:24px;">${content.replace(/</g, "&lt;")}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-border-default bg-card-bg py-3.5 px-5">
        <h1 className="flex items-center gap-1.5 text-page-heading text-text-primary">
          <i className="ti ti-sparkles text-[18px] text-nhs-blue" aria-hidden="true" />
          AI Copilot
        </h1>
        <p className="mt-0.5 text-secondary text-text-secondary">
          Knows your clients, staff, visits, and incidents in real time · New session starts a fresh conversation
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <p className="text-body text-text-secondary">Ask anything about your service to get started.</p>
        ) : null}
        {messages.map((message) => (
          <div key={message.id} className={["flex items-end gap-2", message.role === "manager" ? "justify-end" : "justify-start"].join(" ")}>
            {message.role === "ai" ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nhs-blue">
                <i className="ti ti-sparkles text-[14px] text-white" aria-hidden="true" />
              </div>
            ) : null}
            <div className={["max-w-[70%]", message.role === "manager" ? "order-first" : ""].join(" ")}>
              <div
                className={[
                  "py-2.5 px-3.5 text-body",
                  message.role === "ai"
                    ? "rounded-tr-card rounded-bl-card rounded-br-card rounded-tl-[2px] bg-card-bg text-text-primary shadow-sm"
                    : "rounded-tl-card rounded-bl-card rounded-br-card rounded-tr-[2px] bg-nhs-blue text-white",
                ].join(" ")}
              >
                <p className="whitespace-pre-line">{message.content || (message.streaming ? "…" : "")}</p>

                {message.briefing && !Array.isArray(message.briefing) ? (
                  <div className="mt-2 rounded-input bg-success-green-light py-2 px-3 text-success-green-text">
                    {message.briefing.summary}
                  </div>
                ) : null}
                {message.briefing && Array.isArray(message.briefing) ? (
                  <div className="mt-2 space-y-1.5">
                    {message.briefing.map((alert, i) => (
                      <div key={i} className={["flex items-start gap-2 rounded-input py-2 px-3", ALERT_STYLES[alert.type]].join(" ")}>
                        <i className={`ti ti-${ALERT_ICONS[alert.icon] ?? "alert-circle"} mt-0.5 text-[14px]`} aria-hidden="true" />
                        <span>{alert.text}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {message.mentionedEntities && message.mentionedEntities.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.mentionedEntities.map((entity) => (
                      <Link
                        key={entity.id}
                        href={entity.type === "staff" ? `/staff/${entity.id}` : `/clients/${entity.id}`}
                        className="rounded-btn border border-ai-blue-border bg-ai-blue-light px-3 py-1.5 text-secondary text-ai-blue-text"
                      >
                        View {entity.name.split(" ")[0]} <i className="ti ti-arrow-up-right text-[11px]" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                ) : null}

                {(message.showCarePlanActions || message.showDownloadPdf) && !message.streaming ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.showCarePlanActions ? (
                      <>
                        <Button variant="secondary" onClick={() => setSavePlanTarget({ text: message.content })}>
                          Save to care plan
                        </Button>
                        <Button variant="secondary" onClick={() => setSavePlanTarget({ text: message.content })}>
                          Edit first
                        </Button>
                      </>
                    ) : null}
                    {message.showDownloadPdf ? (
                      <Button variant="secondary" onClick={() => handlePrintMessage(message.content)}>
                        Download PDF
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <p className={["mt-0.5 text-secondary text-text-muted", message.role === "manager" ? "text-right" : ""].join(" ")}>
                {message.timestamp} · {message.role === "ai" ? "AI Copilot" : managerName}
              </p>
            </div>
            {message.role === "manager" ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ai-blue-light text-secondary font-medium text-ai-blue-heading">
                {initialsOf(managerName)}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {!input ? (
        <div className="flex flex-wrap gap-1.5 px-5 pb-2">
          {PROMPT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleSend(chip)}
              className="rounded-[20px] border border-border-default bg-card-bg px-3 py-1.5 text-secondary text-text-primary hover:bg-surface-secondary"
            >
              {chip}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="flex gap-2 border-t border-border-default bg-card-bg p-4"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your service…"
          className="flex-1 rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none focus:border-nhs-blue"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="flex items-center justify-center rounded-btn bg-nhs-blue px-4 text-white disabled:opacity-50"
        >
          <i className="ti ti-send text-[16px]" aria-hidden="true" />
        </button>
      </form>

      {savePlanTarget ? (
        <SaveToCarePlanModal text={savePlanTarget.text} entities={entities} onClose={() => setSavePlanTarget(null)} />
      ) : null}
    </div>
  );
}

function SaveToCarePlanModal({ text, entities, onClose }: { text: string; entities: NamedEntity[]; onClose: () => void }) {
  const [clientId, setClientId] = useState("");
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const clients = entities.filter((e) => e.type === "client");

  async function handleSave() {
    if (!clientId) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase
      .from("care_plans")
      .update({ ai_suggested_updates: draft, last_reviewed_at: new Date().toISOString(), reviewed_by: user!.id })
      .eq("client_id", clientId);

    setSaving(false);
    setSaved(true);
  }

  return (
    <Modal open onClose={onClose}>
      {saved ? (
        <div className="space-y-3">
          <h2 className="text-section-heading text-text-primary">Saved to care plan</h2>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-section-heading text-text-primary">Save to care plan</h2>
          <div>
            <FieldLabel required>Client</FieldLabel>
            <Select required value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Update text</FieldLabel>
            <Textarea className="min-h-[160px]" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || !clientId}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
