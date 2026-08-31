"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface MessageComposerProps {
  orgId: string;
  clientId: string;
  senderId: string;
  senderRole: "manager" | "family_nok";
  senderName: string;
  placeholder?: string;
  onSent?: () => void;
}

export function MessageComposer({ orgId, clientId, senderId, senderRole, senderName, placeholder = "Message the care team…", onSent }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.from("messages").insert({
      org_id: orgId,
      client_id: clientId,
      sender_id: senderId,
      sender_role: senderRole,
      sender_name: senderName,
      body: trimmed,
    });
    setSending(false);
    if (!error) {
      // "Family message received" notification (PRD 8.1) — only fires
      // for family-sent messages, not manager-sent ones. Best-effort:
      // the message itself already sent successfully, so a notification
      // failure here shouldn't block the composer or show an error.
      if (senderRole === "family_nok") {
        void fetch("/api/messages/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, senderName, bodyPreview: trimmed }),
        }).catch(() => {});
      }
      setBody("");
      onSent?.();
    }
  }

  return (
    <div className="flex items-center gap-2 border-t border-border-default bg-card-bg p-3">
      <input
        type="text"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void send();
        }}
        placeholder={placeholder}
        className="flex-1 rounded-input border border-border-default px-3 py-[9px] text-body"
      />
      <button
        type="button"
        onClick={send}
        disabled={sending || !body.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nhs-blue text-white disabled:opacity-50"
        aria-label="Send message"
      >
        <i className="ti ti-send text-[16px]" aria-hidden="true" />
      </button>
    </div>
  );
}
