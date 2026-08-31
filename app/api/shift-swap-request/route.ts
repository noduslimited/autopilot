import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAndMaybeEmail } from "@/lib/notifications/notify";

// Source: PRD section 5.4 ("Submits to manager as a notification"). No
// dedicated shift-swap-request table exists in the Database Schema
// Document — the `notifications` table already has a `shift_swap` type
// built for exactly this, so the request's details are stored in the
// notification's title/body rather than a new table. notifications RLS
// (see supabase/migrations/20260828121100_rls_policies.sql) has no direct
// INSERT policy — "inserts are made by security definer triggers/
// functions, not directly by authenticated users" — so this write has to
// go through a server route using the admin client, same reasoning as
// /api/settings/resend-invite needing the admin client for auth writes.
interface ShiftSwapBody {
  date: string;
  reason: string;
  swapWith: string | null;
}

function isShiftSwapBody(value: unknown): value is ShiftSwapBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return typeof body.date === "string" && typeof body.reason === "string" && (body.swapWith === null || typeof body.swapWith === "string");
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isShiftSwapBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: carer } = await supabase.from("users").select("org_id, role, first_name, last_name").eq("id", user.id).single();
  if (!carer || carer.role !== "carer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: managers } = await admin.from("users").select("id").eq("org_id", carer.org_id).eq("role", "manager");

  const dateLabel = new Date(`${body.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const title = `Shift swap request from ${carer.first_name} ${carer.last_name}`;
  const bodyText = `${carer.first_name} ${carer.last_name} has requested a shift swap or time off for ${dateLabel}. Reason: ${body.reason}`;

  await notifyAndMaybeEmail(admin, {
    orgId: carer.org_id,
    userIds: (managers ?? []).map((m) => m.id),
    type: "shift_swap",
    title,
    body: bodyText,
    link: "/rota",
  });

  return NextResponse.json({ success: true });
}
