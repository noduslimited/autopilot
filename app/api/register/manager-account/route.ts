import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ManagerAccountBody {
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

function isManagerAccountBody(value: unknown): value is ManagerAccountBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.orgId === "string" &&
    typeof body.firstName === "string" &&
    typeof body.lastName === "string" &&
    typeof body.email === "string" &&
    typeof body.password === "string"
  );
}

// Creates the first manager account for a newly-registered organisation.
// Uses the admin API with email_confirm: true rather than client-side
// auth.signUp(), because this Supabase project has "Confirm email" enabled
// — signUp() would return session: null and leave the manager stuck on an
// auth route with no way in. The Product Vision Statement lists "Instant
// self-serve onboarding" as an explicit competitive differentiator (no
// sales call, no waiting), so gating first access behind an email click
// would contradict the product's own stated positioning. The client signs
// in immediately after this succeeds, using the password just set.
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  if (!isManagerAccountBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.firstName.trim() || !body.lastName.trim() || !body.email.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (body.password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.createUser({
    email: body.email.trim(),
    password: body.password,
    email_confirm: true,
    user_metadata: {
      first_name: body.firstName.trim(),
      last_name: body.lastName.trim(),
      org_id: body.orgId,
      role: "manager",
    },
  });

  if (error) {
    const message =
      error.code === "email_exists"
        ? "An account with this email already exists."
        : "Could not create your account. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
