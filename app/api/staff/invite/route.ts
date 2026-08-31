import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface InviteStaffBody {
  firstName: string;
  lastName: string;
  email: string;
  role: "carer" | "senior_carer" | "manager";
}

function isInviteStaffBody(value: unknown): value is InviteStaffBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.firstName === "string" &&
    typeof body.lastName === "string" &&
    typeof body.email === "string" &&
    (body.role === "carer" || body.role === "senior_carer" || body.role === "manager")
  );
}

// users.role is portal-access level (a senior carer uses the same /my-day
// carer portal as any carer); staff.role is the care-sector job title. The
// invite dropdown's three options collapse to two users.role values here —
// see the staff_row_on_signup migration for the full reasoning.
function toUsersRole(role: InviteStaffBody["role"]): "carer" | "manager" {
  return role === "manager" ? "manager" : "carer";
}

// Source: PRD section 3.2 (Staff Invitation Flow). Mirrors Session 5's
// invite-nok route pattern exactly.
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isInviteStaffBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: managerRow } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!managerRow || managerRow.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(body.email, {
    data: {
      first_name: body.firstName,
      last_name: body.lastName,
      org_id: managerRow.org_id,
      role: toUsersRole(body.role),
      staff_role: body.role,
      status: "invited",
    },
  });

  if (error) {
    console.error("inviteUserByEmail (staff) failed:", error);
    return NextResponse.json({ error: "Could not send invitation." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
