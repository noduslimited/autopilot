"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthLogo } from "../_components/AuthLogo";
import { GoogleIcon } from "../_components/GoogleIcon";

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  carer: "Carer",
  senior_carer: "Senior Carer",
  family_nok: "Family / Next of Kin",
};

type VerifyState =
  | { status: "verifying" }
  | { status: "expired" }
  | { status: "ready"; email: string; role: string; orgName: string };

// PRD section 3.2 "Staff registration screen" — also covers family/NOK
// invitations, which follow the same accept-via-token mechanics (IA doc
// section 6: "/register?token=[token] — Staff or NOK registration via
// invitation link"). No dedicated mockup exists for this screen; built to
// match the Login/Register visual language plus the PRD's written spec.
export function InvitationAcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerifyState>({ status: "verifying" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const supabase = createClient();
      const type = (searchParams.get("type") ?? "invite") as "invite" | "email";

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type,
      });

      if (cancelled) return;

      if (verifyError || !data.user) {
        setState({ status: "expired" });
        return;
      }

      const { data: userRow } = await supabase
        .from("users")
        .select("org_id, role")
        .eq("id", data.user.id)
        .single();

      if (!userRow) {
        setState({ status: "expired" });
        return;
      }

      const { data: org } = await supabase
        .from("organisations")
        .select("name")
        .eq("id", userRow.org_id)
        .single();

      setState({
        status: "ready",
        email: data.user.email ?? "",
        role: userRow.role,
        orgName: org?.name ?? "your organisation",
      });
    }

    void verify();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleGoogleSignIn() {
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) setError("Something went wrong. Please try again.");
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
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

    setSubmitting(true);
    const supabase = createClient();
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    // Invitation accepted — flip status from 'invited' to 'active' (Team
    // Members list, Settings, needs this distinction). A plain update, not
    // conditioned on the current value — harmless no-op for a user who
    // was somehow already active.
    if (updateData.user) {
      await supabase.from("users").update({ status: "active" }).eq("id", updateData.user.id);
    }

    // Auth route + authenticated session -> middleware redirects to role home.
    router.refresh();
  }

  if (state.status === "verifying") {
    return (
      <div className="w-full max-w-[380px] rounded-card border border-border-default bg-card-bg p-8 text-center">
        <AuthLogo />
        <p className="mt-6 text-secondary text-text-secondary">Verifying your invitation…</p>
      </div>
    );
  }

  if (state.status === "expired") {
    return (
      <div className="w-full max-w-[380px] rounded-card border border-border-default bg-card-bg p-8 text-center">
        <AuthLogo />
        <p className="mt-6 text-body text-text-primary">
          This invitation has expired. Please ask your manager to resend it.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[380px] rounded-card border border-border-default bg-card-bg p-8">
      <AuthLogo />

      <h1 className="mt-5 text-center text-section-heading text-text-primary">
        You&apos;ve been invited to join {state.orgName}
      </h1>
      <p className="mt-1 text-center text-secondary text-text-secondary">
        Joining as {ROLE_LABELS[state.role] ?? state.role}
      </p>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-btn border border-border-default bg-card-bg px-4 py-3 text-body font-medium text-text-primary"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border-default" />
        <span className="text-secondary text-text-secondary">or create a password</span>
        <div className="h-px flex-1 bg-border-default" />
      </div>

      <form onSubmit={handleCreateAccount} className="space-y-4">
        <div>
          <label className="mb-1 block text-label text-text-secondary">Email</label>
          <input
            type="email"
            value={state.email}
            disabled
            className="w-full rounded-input border border-border-default bg-page-bg px-3 py-[9px] text-body text-text-muted"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-label text-text-secondary">
            Password — at least 8 characters
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
            Confirm password
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
          disabled={submitting}
          className="w-full rounded-btn bg-nhs-blue px-4 py-3 text-body font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account and join"}
        </button>
      </form>
    </div>
  );
}
