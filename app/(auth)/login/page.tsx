"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthLogo } from "../_components/AuthLogo";
import { GoogleIcon } from "../_components/GoogleIcon";

const NOTICES: Record<string, string> = {
  "password-updated": "Password updated. Please sign in.",
  "session-expired": "Your session has expired. Please sign in again.",
  "not-registered": "This account is not registered. Start a free trial or use your invitation link.",
  "account-deactivated": "This account has been deactivated. Contact your manager for access.",
};

// useSearchParams() requires a Suspense boundary for static prerendering.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const notice = searchParams.get("notice");
  const noticeMessage = notice ? NOTICES[notice] : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Generic message for both wrong password and non-existent email — no
      // user enumeration (PRD section 3.1, AUTH-01 acceptance criteria).
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    // Middleware performs the role-based redirect on the next request — this
    // page is an auth route, so refreshing it while authenticated triggers
    // middleware's "redirect authenticated user away from auth routes" step.
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const redirectParam = searchParams.get("redirect");
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (redirectParam) callbackUrl.searchParams.set("redirect", redirectParam);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });

    if (oauthError) {
      setError("Something went wrong. Please try again.");
      setGoogleLoading(false);
    }
    // On success, the browser is redirected to Google — no further action here.
  }

  return (
    <div className="w-full max-w-[380px] rounded-card border border-border-default bg-card-bg p-8">
      <AuthLogo />

      {noticeMessage ? (
        <p className="mt-4 rounded-btn bg-ai-blue-light px-3 py-2 text-center text-secondary text-ai-blue-text">
          {noticeMessage}
        </p>
      ) : null}

      <h1 className="mt-5 text-center text-section-heading text-text-primary">
        Sign in to your workspace
      </h1>
      <p className="mt-1 text-center text-secondary text-text-secondary">
        Care management for UK care providers
      </p>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-btn border border-border-default bg-card-bg px-4 py-3 text-body font-medium text-text-primary disabled:opacity-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border-default" />
        <span className="text-secondary text-text-secondary">or</span>
        <div className="h-px flex-1 bg-border-default" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-label text-text-secondary">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@yourorg.co.uk"
            className="w-full rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none focus:border-nhs-blue"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-label text-text-secondary">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none focus:border-nhs-blue"
          />
          {error ? <p className="mt-2 text-secondary text-nhs-red">{error}</p> : null}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-btn bg-nhs-blue px-4 py-3 text-body font-medium text-white disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-secondary">
        <Link href="/reset-password" className="text-nhs-blue">
          Forgot password? Reset it
        </Link>
      </p>

      <p className="mt-4 text-center text-secondary text-text-secondary">
        New to Autopilot?{" "}
        <Link href="/register" className="text-nhs-blue">
          Start your free trial
        </Link>
        <br />
        or use your invitation link.
      </p>
    </div>
  );
}
