"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Reuses the exact same mechanism /reset-password already uses
// (resetPasswordForEmail + the update-password accept flow) rather than
// building a separate "enter your current password" change form — no
// document specifies one, and this keeps a single password-reset code
// path in the app instead of two. Shared between the family and carer
// portals (moved here from app/family/profile/ when the carer profile
// page — 2026-09-04 — needed the identical mechanism).
export function ChangePasswordButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function handleClick() {
    setState("sending");
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    setState("sent");
  }

  if (state === "sent") {
    return <p className="text-body text-success-green-text">Check your email — we&apos;ve sent a link to set a new password.</p>;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "sending"}
      className="w-full rounded-btn border border-border-default bg-card-bg py-[10px] text-[13px] font-medium text-text-primary disabled:opacity-50"
    >
      {state === "sending" ? "Sending…" : "Change password"}
    </button>
  );
}
