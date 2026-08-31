import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import {
  isAuthRoute,
  isProtectedRoute,
  isBillingRoute,
  canAccessRoute,
  getRoleHomePage,
  type UserRole,
} from "@/lib/utils/permissions";

const LAST_ACTIVE_COOKIE = "ap_last_active";
const INACTIVITY_LIMIT_MS = 24 * 60 * 60 * 1000; // AUTH-05: 24 hours of inactivity

export async function proxy(request: NextRequest) {
  const { supabase, getResponse } = createMiddlewareClient(request);
  const pathname = request.nextUrl.pathname;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated
  if (!user) {
    if (isProtectedRoute(pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return getResponse();
  }

  // 24-hour inactivity expiry (AUTH-05). Supabase's own refresh-token
  // lifetime is longer-lived, so this is enforced separately via a rolling
  // "last active" cookie rather than relying on JWT/refresh expiry alone.
  const lastActiveRaw = request.cookies.get(LAST_ACTIVE_COOKIE)?.value;
  const lastActive = lastActiveRaw ? Number(lastActiveRaw) : null;
  const now = Date.now();

  if (lastActive && now - lastActive > INACTIVITY_LIMIT_MS) {
    await supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    loginUrl.searchParams.set("notice", "session-expired");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(LAST_ACTIVE_COOKIE);
    return response;
  }

  const response = getResponse();
  response.cookies.set(LAST_ACTIVE_COOKIE, String(now), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  const { data: userRow } = await supabase
    .from("users")
    .select("role, org_id, status")
    .eq("id", user.id)
    .single();

  // No matching `users` row yet (e.g. a brief window during account
  // creation before the auth trigger has run) — let the request through
  // rather than redirect-looping.
  if (!userRow) {
    return response;
  }

  // Deactivated staff/family members retain their records (Database
  // Schema Document: "access is revoked but records are retained") but
  // must not be able to use the app — Settings' "Deactivate" action (PRD
  // 4.10) is meaningless without this actually being enforced.
  if (userRow.status === "deactivated") {
    await supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("notice", "account-deactivated");
    const deactivatedResponse = NextResponse.redirect(loginUrl);
    deactivatedResponse.cookies.delete(LAST_ACTIVE_COOKIE);
    return deactivatedResponse;
  }

  const role = userRow.role as UserRole;

  // Authenticated users are redirected away from auth routes (login,
  // register, reset-password, update-password) to their role home, or to
  // the originally requested page if one was captured in `redirect`.
  if (isAuthRoute(pathname)) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const target = redirectParam && isProtectedRoute(redirectParam) ? redirectParam : getRoleHomePage(role);
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Role-based route access
  if (isProtectedRoute(pathname) && !canAccessRoute(role, pathname)) {
    return NextResponse.redirect(new URL(getRoleHomePage(role), request.url));
  }

  // Trial expiry — managers only (PRD section 12 / TRD section 10.2): all
  // manager routes redirect to /settings/billing except billing itself.
  // Computed directly from trial_end_date, not just the `trial_expired`
  // status flag — the flag is now kept accurate by Session 11's daily
  // pg_cron job, but the direct date comparison stays as the primary
  // check since it can never lag behind by up to a day the way a
  // once-daily job can.
  if (role === "manager" && isProtectedRoute(pathname) && !isBillingRoute(pathname)) {
    const { data: org } = await supabase
      .from("organisations")
      .select("status, trial_end_date, billing_issue_started_at")
      .eq("id", userRow.org_id)
      .single();

    const trialExpired =
      org?.status === "trial_expired" ||
      (org?.status === "trial" && org.trial_end_date && new Date(org.trial_end_date) < new Date());

    // Payment failed / suspended — Gokul, direct request (2026-08-31):
    // 48 hours' grace from the moment the billing issue actually began
    // (billing_issue_started_at, set/cleared by the Stripe webhook — see
    // lib/stripe/webhook route), not an immediate lockout. A null
    // billing_issue_started_at (e.g. data predating this feature) means
    // the grace period hasn't started, so access is never blocked for
    // that case rather than locking someone out with no warning.
    const billingGraceExpired =
      (org?.status === "payment_failed" || org?.status === "suspended") &&
      org.billing_issue_started_at &&
      Date.now() - new Date(org.billing_issue_started_at).getTime() > 48 * 60 * 60 * 1000;

    if (trialExpired || billingGraceExpired) {
      return NextResponse.redirect(new URL("/settings/billing", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
