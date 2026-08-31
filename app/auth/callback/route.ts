import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google OAuth redirects here with an exchange code (TRD section 6.2).
// After exchanging it for a session, we hand off to /login — middleware's
// "redirect authenticated user away from auth routes" step then sends the
// user to their role home page (or the original `redirect` target), the
// same logic path used by the email/password flow.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectParam = searchParams.get("redirect");

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // Google sign-in is also how an invited user can accept their
    // invitation (see InvitationAcceptForm's "Continue with Google") —
    // flip status from 'invited' to 'active' here too. Harmless no-op for
    // an already-active user's ordinary login.
    if (data.user) {
      await supabase.from("users").update({ status: "active" }).eq("id", data.user.id).eq("status", "invited");
    }
  }

  const loginUrl = new URL("/login", origin);
  if (redirectParam) loginUrl.searchParams.set("redirect", redirectParam);

  return NextResponse.redirect(loginUrl);
}
