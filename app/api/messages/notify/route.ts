import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAndMaybeEmail } from "@/lib/notifications/notify";

// Source: PRD section 8.1 ("Family message received" notification type).
// The message itself is inserted directly by MessageComposer.tsx (RLS
// permits it — family_own_message_thread is FOR ALL), but the resulting
// notification row needs the admin client, same reasoning as every other
// notification-writing route in this app (incident report, shift swap).
// Only fires when a family member sent the message — a manager sending
// doesn't need to notify anyone in this app's V1 scope.
interface NotifyBody {
  clientId: string;
  senderName: string;
  bodyPreview: string;
}

function isNotifyBody(value: unknown): value is NotifyBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return typeof body.clientId === "string" && typeof body.senderName === "string" && typeof body.bodyPreview === "string";
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isNotifyBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: familyUser } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!familyUser || familyUser.role !== "family_nok") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: client } = await supabase.from("clients").select("first_name, last_name").eq("id", body.clientId).single();
  if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });

  const admin = createAdminClient();
  const { data: managers } = await admin.from("users").select("id").eq("org_id", familyUser.org_id).eq("role", "manager");

  const title = `New message from ${body.senderName}`;
  const preview = body.bodyPreview.length > 120 ? `${body.bodyPreview.slice(0, 117)}...` : body.bodyPreview;

  await notifyAndMaybeEmail(admin, {
    orgId: familyUser.org_id,
    userIds: (managers ?? []).map((m) => m.id),
    type: "family_message",
    title,
    body: `${body.senderName} (family of ${client.first_name} ${client.last_name}): ${preview}`,
    link: `/clients/${body.clientId}?tab=messages`,
  });

  return NextResponse.json({ success: true });
}
