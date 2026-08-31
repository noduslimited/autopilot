import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Source: PRD section 4.10 ("Resend invitation" for pending invites).
// Re-inviting an email still pending (not yet confirmed) is accepted by
// Supabase Auth and re-sends the invite — confirmed in Session 5/6 testing.
interface ResendInviteBody {
  userId: string;
}

function isResendInviteBody(value: unknown): value is ResendInviteBody {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).userId === "string";
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isResendInviteBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: managerRow } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!managerRow || managerRow.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // RLS-scoped read confirms the target belongs to this manager's org and
  // is genuinely still pending.
  const { data: target } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, role, status")
    .eq("id", body.userId)
    .single();

  if (!target || target.status !== "invited") {
    return NextResponse.json({ error: "This person does not have a pending invitation." }, { status: 400 });
  }

  const { data: staffRow } = await supabase.from("staff").select("role").eq("id", target.id).maybeSingle();

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(target.email, {
    data: {
      first_name: target.first_name,
      last_name: target.last_name,
      org_id: managerRow.org_id,
      role: target.role,
      status: "invited",
      ...(staffRow ? { staff_role: staffRow.role } : {}),
    },
  });

  if (error) {
    console.error("resend invite failed:", error);
    return NextResponse.json({ error: "Could not resend the invitation." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
