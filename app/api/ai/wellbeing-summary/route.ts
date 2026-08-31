import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWellbeingSummary } from "@/lib/ai/wellbeingSummary";
import { getLinkedClientId } from "@/lib/family/getLinkedClient";

// app/(family)/overview/page.tsx calls getWellbeingSummary() directly
// (server component, auto-fires on render, same pattern as every other
// server-rendered AI feature in this app) — this route exists for API
// consistency with the rest of the AI routes.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!userRow || userRow.role !== "family_nok") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientId = await getLinkedClientId(supabase, user.id);
  if (!clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: client } = await supabase.from("clients").select("first_name").eq("id", clientId).single();
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const summary = await getWellbeingSummary(supabase, admin, userRow.org_id, clientId, client.first_name);

  return NextResponse.json({ summary });
}
