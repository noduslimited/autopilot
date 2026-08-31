import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface InviteNokBody {
  clientId: string;
  email: string;
  relationship: string;
  nokName: string;
}

function isInviteNokBody(value: unknown): value is InviteNokBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.clientId === "string" &&
    typeof body.email === "string" &&
    typeof body.relationship === "string" &&
    typeof body.nokName === "string"
  );
}

// users.first_name/last_name are NOT NULL, but the add-client form only
// collects one combined "Next of kin name" field (PRD section 4.3, Step
// 4) — split on the first space so handle_new_auth_user has something
// valid to insert.
function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed, lastName: "" };
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1) };
}

// Sends the family portal invitation email (PRD section 4.3, Step 4:
// "Send family portal invitation on save"). Uses the admin API per TRD
// section 6.4 ("admin operations: invitation sending"). The family_nok
// link row is created later, when the invitee actually accepts (see
// handle_new_auth_user — no user_id exists yet at invite-send time).
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isInviteNokBody(body)) {
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

  // RLS-scoped read confirms the client belongs to this manager's org.
  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("id", body.clientId)
    .single();
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const { firstName, lastName } = splitName(body.nokName);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(body.email, {
    data: {
      first_name: firstName,
      last_name: lastName,
      org_id: managerRow.org_id,
      role: "family_nok",
      client_id: client.id,
      relationship: body.relationship || null,
      status: "invited",
    },
  });

  if (error) {
    console.error("inviteUserByEmail (NOK) failed:", error);
    // Surface a specific, actionable message when the email already
    // belongs to an existing account — a plain "could not send" would
    // hide the actual reason from the manager. Any other failure (e.g.
    // the Supabase Auth email-service issue documented in CLAUDE.md)
    // keeps the generic message.
    const alreadyRegistered = error.code === "email_exists";
    return NextResponse.json(
      {
        error: alreadyRegistered
          ? "This email address is already registered with an Autopilot account. Use a different email, or ask them to be linked manually."
          : "Could not send invitation.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
