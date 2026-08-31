import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface UnsubscribeBody {
  endpoint: string;
}

function isUnsubscribeBody(value: unknown): value is UnsubscribeBody {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).endpoint === "string";
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isUnsubscribeBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS (users_own_push_subscriptions) scopes this delete to the
  // caller's own subscriptions only.
  await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);

  return NextResponse.json({ success: true });
}
