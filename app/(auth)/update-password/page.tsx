"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthLogo } from "../_components/AuthLogo";

// Reached via the emailed password-reset link (IA doc: /update-password?token=...).
//
// Verifies the recovery token client-side via verifyOtp({ token_hash, type })
// rather than relying on Supabase's hosted /verify redirect + implicit-flow
// hash fragment. The @supabase/ssr browser client is hardcoded to
// flowType: "pkce" (checked in node_modules — not configurable), which only
// recognises `?code=` callbacks, not `#access_token=` fragments — so the
// classic hosted-redirect recovery link silently fails to establish a
// session with this client. token_hash verification is flow-agnostic and
// matches the pattern already used for invitation acceptance. The email
// template must link to `/update-password?token_hash={{ .TokenHash }}&type=recovery`
// (see CLAUDE.md Session 2 log for the exact template instructions given to Gokul).
export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={null}>
      <UpdatePasswordForm />
    </Suspense>
  );
}

type VerifyState = "verifying" | "expired" | "ready";

function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerifyState>("verifying");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
    const type = (searchParams.get("type") ?? "recovery") as "recovery" | "email";

    if (!tokenHash) {
      setState("expired");
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error: verifyError }) => {
      if (cancelled) return;
      setState(verifyError ? "expired" : "ready");
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Something went wrong. Please request a new reset link.");
      setLoading(false);
      return;
    }

    // AUTH-06: "Old sessions are invalidated after password reset."
    await supabase.auth.signOut({ scope: "others" });
    await supabase.auth.signOut();

    router.push("/login?notice=password-updated");
  }

  if (state === "verifying") {
    return (
      <div className="w-full max-w-[380px] rounded-card border border-border-default bg-card-bg p-8 text-center">
        <AuthLogo />
        <p className="mt-6 text-secondary text-text-secondary">Verifying your link…</p>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="w-full max-w-[380px] rounded-card border border-border-default bg-card-bg p-8 text-center">
        <AuthLogo />
        <p className="mt-6 text-body text-text-primary">
          This reset link is invalid or has expired. Please request a new one.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[380px] rounded-card border border-border-default bg-card-bg p-8">
      <AuthLogo />

      <h1 className="mt-5 text-center text-section-heading text-text-primary">
        Set a new password
      </h1>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="password" className="mb-1 block text-label text-text-secondary">
            New password — at least 8 characters
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none focus:border-nhs-blue"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-label text-text-secondary">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none focus:border-nhs-blue"
          />
        </div>

        {error ? <p className="text-secondary text-nhs-red">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-btn bg-nhs-blue px-4 py-3 text-body font-medium text-white disabled:opacity-50"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
