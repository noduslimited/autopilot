import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Item 1, Gokul's direct request 2026-09-06 — Staff Hours Report.
// Scheduled hours/shift counts come from rota_shifts, actual hours from
// visits.check_in_time/check_out_time, both strictly org_id-scoped via
// each query below (never trust staffIds from the request body alone —
// every staff row is re-checked against the caller's own org_id).

interface HoursReportBody {
  staffIds: string[];
  dateFrom: string;
  dateTo: string;
}

function isHoursReportBody(value: unknown): value is HoursReportBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    Array.isArray(body.staffIds) &&
    body.staffIds.every((id) => typeof id === "string") &&
    typeof body.dateFrom === "string" &&
    typeof body.dateTo === "string"
  );
}

// rota_shifts.start_time/end_time are plain `time` values ("HH:MM:SS"),
// not timestamps — parsed and diffed in minutes here, adding 24h for a
// shift that crosses midnight (end clock-time earlier than start).
function shiftHours(startTime: string, endTime: string): number {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let minutes = toMinutes(endTime) - toMinutes(startTime);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}

function hoursBetween(start: string, end: string): number {
  return Math.round(((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60)) * 100) / 100;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isHoursReportBody(body) || body.staffIds.length === 0) {
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

  const { data: staffRows } = await supabase
    .from("staff")
    .select("id, role, users(first_name, last_name)")
    .eq("org_id", manager.org_id)
    .in("id", body.staffIds);

  if (!staffRows || staffRows.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  const staffIds = staffRows.map((s) => s.id);
  const rangeStart = new Date(`${body.dateFrom}T00:00:00.000Z`);
  const rangeEndExclusive = new Date(`${body.dateTo}T00:00:00.000Z`);
  rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);

  const [{ data: shiftRows }, { data: visitRows }] = await Promise.all([
    supabase
      .from("rota_shifts")
      .select("staff_id, start_time, end_time")
      .eq("org_id", manager.org_id)
      .in("staff_id", staffIds)
      .gte("shift_date", body.dateFrom)
      .lte("shift_date", body.dateTo),
    supabase
      .from("visits")
      .select("assigned_carer_id, status, check_in_time, check_out_time")
      .eq("org_id", manager.org_id)
      .in("assigned_carer_id", staffIds)
      .gte("scheduled_start", rangeStart.toISOString())
      .lt("scheduled_start", rangeEndExclusive.toISOString()),
  ]);

  const rows = staffRows.map((staff) => {
    const user = Array.isArray(staff.users) ? staff.users[0] : staff.users;
    const shifts = (shiftRows ?? []).filter((s) => s.staff_id === staff.id && s.start_time && s.end_time);
    const scheduledHours = shifts.reduce((sum, s) => sum + shiftHours(s.start_time!, s.end_time!), 0);

    const visits = (visitRows ?? []).filter((v) => v.assigned_carer_id === staff.id);
    const completedVisits = visits.filter((v) => v.status === "completed");
    const actualHours = completedVisits.reduce((sum, v) => {
      if (!v.check_in_time || !v.check_out_time) return sum;
      return sum + hoursBetween(v.check_in_time, v.check_out_time);
    }, 0);

    const difference = Math.round((actualHours - scheduledHours) * 100) / 100;

    return {
      staffId: staff.id,
      name: user ? `${user.first_name} ${user.last_name}` : "Unknown",
      role: staff.role,
      totalShifts: shifts.length,
      scheduledHours: Math.round(scheduledHours * 100) / 100,
      actualHours: Math.round(actualHours * 100) / 100,
      difference,
      visitsCompleted: completedVisits.length,
    };
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ rows });
}
