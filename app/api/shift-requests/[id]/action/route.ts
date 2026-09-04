import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Source: Gokul, direct request 2026-09-04 — carer mobile portal item 5's
// manager-side approve/decline, plus the "approved request visual
// reflection" addendum. Runs as application code, not a database
// trigger, deliberately: moving a swapped shift needs a real conflict
// check with a user-facing error if it can't be done automatically, and
// marking multiple days sick/on-leave needs a loop with per-day
// insert-or-update logic — exactly the class of "real business logic,
// not a simple fan-out insert" this project already keeps out of
// triggers (see rota's ensureVisitsForShift, invoice creation, etc.).
// The actual "request was actioned" notification still comes from the
// shift_requests UPDATE trigger (notify_on_shift_request_response) —
// this route only ever does the UPDATE plus the real rota_shifts/visits
// side-effects; it never writes to notifications directly.

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateRange(from: string, to: string | null): string[] {
  const end = to ?? from;
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return dates;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const decision = body && typeof body === "object" && (body as { decision?: unknown }).decision;
  if (decision !== "approved" && decision !== "declined") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: manager } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!manager || manager.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: shiftRequest } = await supabase
    .from("shift_requests")
    .select("*")
    .eq("id", id)
    .eq("org_id", manager.org_id)
    .single();

  if (!shiftRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (shiftRequest.status !== "pending") {
    return NextResponse.json({ error: "This request has already been actioned." }, { status: 409 });
  }

  if (decision === "approved") {
    if (shiftRequest.request_type === "sick" || shiftRequest.request_type === "holiday" || shiftRequest.request_type === "time_off") {
      const shiftType = shiftRequest.request_type === "sick" ? "sick_leave" : "annual_leave";
      const dates = dateRange(shiftRequest.date_from, shiftRequest.date_to);

      for (const date of dates) {
        const { data: existing } = await supabase
          .from("rota_shifts")
          .select("id")
          .eq("staff_id", shiftRequest.staff_id)
          .eq("shift_date", date)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("rota_shifts")
            .update({ shift_type: shiftType, start_time: null, end_time: null, assigned_client_ids: [] })
            .eq("id", existing.id);
        } else {
          await supabase.from("rota_shifts").insert({
            org_id: manager.org_id,
            staff_id: shiftRequest.staff_id,
            shift_date: date,
            shift_type: shiftType,
            start_time: null,
            end_time: null,
            assigned_client_ids: [],
          });
        }

        // Cancel (not delete — preserves history) any visits already on
        // the books for that carer that day, same reasoning as
        // ensureVisitsForShift: a carer marked off/sick shouldn't still
        // show a live visit their client-side app expects them to run.
        await supabase
          .from("visits")
          .update({ status: "cancelled" })
          .eq("assigned_carer_id", shiftRequest.staff_id)
          .gte("scheduled_start", `${date}T00:00:00`)
          .lt("scheduled_start", `${addDaysISO(date, 1)}T00:00:00`)
          .eq("status", "scheduled");
      }
    } else if (shiftRequest.request_type === "shift_swap") {
      if (!shiftRequest.shift_id || !shiftRequest.swap_with_staff_id) {
        return NextResponse.json({ error: "This swap request is missing the shift or colleague to swap with." }, { status: 400 });
      }

      const { data: shift } = await supabase.from("rota_shifts").select("*").eq("id", shiftRequest.shift_id).single();
      if (!shift) {
        return NextResponse.json({ error: "The original shift could no longer be found." }, { status: 404 });
      }

      const { data: conflict } = await supabase
        .from("rota_shifts")
        .select("id")
        .eq("staff_id", shiftRequest.swap_with_staff_id)
        .eq("shift_date", shift.shift_date)
        .maybeSingle();

      if (conflict) {
        return NextResponse.json(
          { error: "The colleague already has a shift on that date — resolve this manually on the Rota before approving." },
          { status: 409 },
        );
      }

      await supabase.from("rota_shifts").update({ staff_id: shiftRequest.swap_with_staff_id }).eq("id", shift.id);

      // Move the underlying visits too — a real, previously-known gap
      // elsewhere in this app (dragging a shift on the Rota grid doesn't
      // move its visits either, see CLAUDE.md's Post-Launch Checklist)
      // that a swap absolutely cannot leave unfixed, since "the shift
      // disappears from one carer's schedule and appears on the
      // colleague's" is the entire point of this feature.
      await supabase
        .from("visits")
        .update({ assigned_carer_id: shiftRequest.swap_with_staff_id })
        .eq("assigned_carer_id", shiftRequest.staff_id)
        .gte("scheduled_start", `${shift.shift_date}T00:00:00`)
        .lt("scheduled_start", `${addDaysISO(shift.shift_date, 1)}T00:00:00`)
        .in("status", ["scheduled", "in_progress"]);
    }
    // shift_issue: no rota_shifts/visits side-effect — approving simply
    // records that the manager has seen and actioned the report.
  }

  await supabase
    .from("shift_requests")
    .update({ status: decision, actioned_by: user.id, actioned_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
