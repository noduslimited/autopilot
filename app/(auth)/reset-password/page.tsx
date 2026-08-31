"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthLogo } from "../_components/AuthLogo";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    // Same confirmation regardless of whether the email exists — avoids
    // user enumeration, consistent with the login screen's error handling.
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="w-full max-w-[380px] rounded-card border border-border-default bg-card-bg p-8">
      <AuthLogo />

      {sent ? (
        <>
          <h1 className="mt-5 text-center text-section-heading text-text-primary">
            Check your email
          </h1>
          <p className="mt-2 text-center text-secondary text-text-secondary">
            If an account exists for {email}, we&apos;ve sent a link to reset your password. The
            link is valid for 1 hour.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-5 text-center text-section-heading text-text-primary">
            Reset your password
          </h1>
          <p className="mt-1 text-center text-secondary text-text-secondary">
            We&apos;ll email you a link to set a new password.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-btn bg-nhs-blue px-4 py-3 text-body font-medium text-white disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </>
      )}

      <p className="mt-4 text-center text-secondary">
        <Link href="/login" className="text-nhs-blue">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
