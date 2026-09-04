import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAndMaybeEmail } from "@/lib/notifications/notify";

// Source: Gokul, direct request 2026-09-04 — carer mobile portal item 5
// ("Manage my shifts"). One route backs all 5 request types (time off,
// holiday, sick, shift swap, shift issue) since they share the same
// underlying shift_requests row shape — request_type is what
// distinguishes them, not five separate endpoints.
type RequestType = "time_off" | "holiday" | "sick" | "shift_swap" | "shift_issue";

interface CreateRequestBody {
  requestType: RequestType;
  dateFrom: string;
  dateTo: string | null;
  category: string | null;
  notes: string | null;
  swapWithStaffId: string | null;
  shiftId: string | null;
}

function isCreateRequestBody(value: unknown): value is CreateRequestBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.requestType === "string" &&
    ["time_off", "holiday", "sick", "shift_swap", "shift_issue"].includes(body.requestType) &&
    typeof body.dateFrom === "string" &&
    (body.dateTo === null || typeof body.dateTo === "string") &&
    (body.category === null || typeof body.category === "string") &&
    (body.notes === null || typeof body.notes === "string") &&
    (body.swapWithStaffId === null || typeof body.swapWithStaffId === "string") &&
    (body.shiftId === null || typeof body.shiftId === "string")
  );
}

const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  time_off: "time off",
  holiday: "holiday",
  sick: "sick leave",
  shift_swap: "shift swap",
  shift_issue: "shift issue",
};

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isCreateRequestBody(body)) {
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

  // Insert goes through the RLS-scoped client (carers_create_own_requests
  // policy) rather than the admin client — a carer creating their own
  // request is exactly what RLS is meant to allow directly, no need to
  // route around it.
  const { data: created, error: insertError } = await supabase
    .from("shift_requests")
    .insert({
      org_id: carer.org_id,
      staff_id: user.id,
      request_type: body.requestType,
      date_from: body.dateFrom,
      date_to: body.dateTo,
      category: body.category,
      notes: body.notes,
      swap_with_staff_id: body.swapWithStaffId,
      shift_id: body.shiftId,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return NextResponse.json({ error: "Could not submit your request. Please try again." }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: managers } = await admin.from("users").select("id").eq("org_id", carer.org_id).eq("role", "manager");

  const carerName = `${carer.first_name} ${carer.last_name}`;
  const dateLabel = new Date(`${body.dateFrom}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const rangeLabel = body.dateTo && body.dateTo !== body.dateFrom
    ? `${dateLabel} to ${new Date(`${body.dateTo}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
    : dateLabel;

  await notifyAndMaybeEmail(admin, {
    orgId: carer.org_id,
    userIds: (managers ?? []).map((m) => m.id),
    type: "shift_request_created",
    title: `${carerName} — ${REQUEST_TYPE_LABEL[body.requestType]} request`,
    body: `${carerName} has requested ${REQUEST_TYPE_LABEL[body.requestType]} for ${rangeLabel}.${body.notes ? ` Note: ${body.notes}` : ""}`,
    link: "/rota",
  });

  return NextResponse.json({ success: true, id: created.id });
}
