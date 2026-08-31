// Role-based route access. Source: Roles & Permissions Matrix section 5
// ("Next.js Route Guards") and Information Architecture Document sections 6, 9.

export type UserRole = "manager" | "carer" | "family_nok" | "service_user";

const MANAGER_PREFIXES = [
  "/dashboard",
  "/clients",
  "/rota",
  "/staff",
  "/incidents",
  "/finance",
  "/reports",
  "/copilot",
  "/settings",
];

const CARER_PREFIXES = ["/my-day", "/visit", "/schedule", "/report-incident", "/carer"];

const FAMILY_PREFIXES = ["/family"];

// Auth routes: unauthenticated only — an authenticated session is redirected
// away from these to its role home page.
const AUTH_ROUTES = ["/login", "/register", "/reset-password", "/update-password"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAuthRoute(pathname: string): boolean {
  return matchesPrefix(pathname, AUTH_ROUTES);
}

export function isProtectedRoute(pathname: string): boolean {
  return (
    matchesPrefix(pathname, MANAGER_PREFIXES) ||
    matchesPrefix(pathname, CARER_PREFIXES) ||
    matchesPrefix(pathname, FAMILY_PREFIXES)
  );
}

export function isBillingRoute(pathname: string): boolean {
  return pathname === "/settings/billing" || pathname.startsWith("/settings/billing/");
}

// Returns true if the role is permitted on this pathname. Routes with no
// role association (auth routes, public pages) are not checked here.
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  if (matchesPrefix(pathname, MANAGER_PREFIXES)) return role === "manager";
  if (matchesPrefix(pathname, CARER_PREFIXES)) return role === "carer";
  if (matchesPrefix(pathname, FAMILY_PREFIXES)) return role === "family_nok";
  return true;
}

// Post-login redirect target per role.
// service_user has no defined V1 routes (Information Architecture Document
// section 6 marks it "future — not in V1") — falls back to /login.
export function getRoleHomePage(role: UserRole): string {
  switch (role) {
    case "manager":
      return "/dashboard";
    case "carer":
      return "/my-day";
    case "family_nok":
      return "/family/overview";
    default:
      return "/login";
  }
}
