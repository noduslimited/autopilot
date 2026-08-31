import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Source: CLAUDE.md section 16a. Stores the browser's PushSubscription so
// the shift-notifications Edge Function can send to it later. RLS
// (users_own_push_subscriptions) already scopes this to the caller's own
// row — no admin client needed.
interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function isSubscribeBody(value: unknown): value is SubscribeBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  if (typeof body.endpoint !== "string") return false;
  if (typeof body.keys !== "object" || body.keys === null) return false;
  const keys = body.keys as Record<string, unknown>;
  return typeof keys.p256dh === "string" && typeof keys.auth === "string";
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isSubscribeBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase.from("users").select("org_id").eq("id", user.id).single();
  if (!userRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      org_id: userRow.org_id,
      user_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: "Could not save subscription." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
