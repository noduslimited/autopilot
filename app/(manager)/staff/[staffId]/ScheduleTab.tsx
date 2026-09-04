import { createClient } from "@/lib/supabase/server";
import { ShiftRequestsPanel, type ShiftRequestRow } from "@/components/manager/ShiftRequestsPanel";

// Source: PRD section 4.5 (Staff Profile — Schedule tab): "This staff
// member's shifts for the current month — Calendar view." Read-only —
// editing shifts happens on the Rota page. Extended per Gokul's direct
// request 2026-09-04 (carer mobile portal item 5's "visual reflection"
// addendum) with an approved-absence summary and this staff member's own
// pending requests, actionable inline.
function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export async function ScheduleTab({ staffId }: { staffId: string }) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const nextMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0));

  const supabase = await createClient();
  const [{ data: shifts }, { data: approvedRequests }, { data: pendingRows }] = await Promise.all([
    supabase
      .from("rota_shifts")
      .select("shift_date, start_time, end_time, shift_type")
      .eq("staff_id", staffId)
      .gte("shift_date", toISODate(monthStart))
      .lte("shift_date", toISODate(monthEnd)),
    supabase
      .from("shift_requests")
      .select("request_type, date_from, date_to")
      .eq("staff_id", staffId)
      .eq("status", "approved")
      .in("request_type", ["sick", "holiday", "time_off"])
      .lte("date_from", toISODate(nextMonthEnd))
      .or(`date_to.gte.${toISODate(monthStart)},date_to.is.null`),
    supabase
      .from("shift_requests")
      .select(
        "id, request_type, date_from, date_to, category, notes, requested_at, swap_with:swap_with_staff_id(users(first_name, last_name))",
      )
      .eq("staff_id", staffId)
      .eq("status", "pending")
      .order("requested_at", { ascending: true }),
  ]);

  const shiftByDate = new Map((shifts ?? []).map((s) => [s.shift_date, s]));

  function daysInRange(from: string, to: string | null, rangeStart: Date, rangeEnd: Date): number {
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to ?? from}T00:00:00Z`);
    const clampedStart = start < rangeStart ? rangeStart : start;
    const clampedEnd = end > rangeEnd ? rangeEnd : end;
    if (clampedEnd < clampedStart) return 0;
    return Math.round((clampedEnd.getTime() - clampedStart.getTime()) / 86400000) + 1;
  }

  const twoMonthEnd = new Date(Date.UTC(nextMonthEnd.getUTCFullYear(), nextMonthEnd.getUTCMonth(), nextMonthEnd.getUTCDate(), 23, 59, 59));
  let holidayDays = 0;
  let sickDaysThisMonth = 0;
  for (const req of approvedRequests ?? []) {
    if (req.request_type === "holiday" || req.request_type === "time_off") {
      holidayDays += daysInRange(req.date_from, req.date_to, monthStart, twoMonthEnd);
    } else if (req.request_type === "sick") {
      sickDaysThisMonth += daysInRange(req.date_from, req.date_to, monthStart, new Date(Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth(), monthEnd.getUTCDate(), 23, 59, 59)));
    }
  }

  const pendingRequests: ShiftRequestRow[] = (pendingRows ?? []).map((r) => {
    const swapRow = Array.isArray(r.swap_with) ? r.swap_with[0] : r.swap_with;
    const swapUser = swapRow ? (Array.isArray(swapRow.users) ? swapRow.users[0] : swapRow.users) : null;
    return {
      id: r.id,
      staffName: "",
      requestType: r.request_type as ShiftRequestRow["requestType"],
      dateFrom: r.date_from,
      dateTo: r.date_to,
      category: r.category,
      notes: r.notes,
      swapWithName: swapUser ? `${swapUser.first_name} ${swapUser.last_name}` : null,
      requestedAt: r.requested_at,
    };
  });

  // Leading blanks so day 1 lines up under its correct weekday column (Mon-start week).
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7;
  const totalDays = monthEnd.getUTCDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Absences — this and next month</h2>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="rounded-input border border-border-default p-3">
            <p className="text-label text-text-secondary">Holiday days approved</p>
            <p className="mt-1 text-section-heading text-text-primary">{holidayDays}</p>
          </div>
          <div className="rounded-input border border-border-default p-3">
            <p className="text-label text-text-secondary">Sick days this month</p>
            <p className="mt-1 text-section-heading text-text-primary">{sickDaysThisMonth}</p>
          </div>
        </div>
      </div>

      {pendingRequests.length > 0 ? (
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <h2 className="text-subsection-heading text-text-primary">Pending requests ({pendingRequests.length})</h2>
          <div className="mt-2.5">
            <ShiftRequestsPanel requests={pendingRequests} emptyMessage="No pending requests." />
          </div>
        </div>
      ) : null}

      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
      <h2 className="text-subsection-heading text-text-primary">{monthLabel}</h2>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-label text-text-secondary">
            {label}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;
          const iso = toISODate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day)));
          const shift = shiftByDate.get(iso);
          const isToday = iso === toISODate(now);

          let content: string | null = null;
          let tone = "text-text-muted";
          if (shift) {
            if (shift.shift_type === "sick_leave") {
              content = "Sick";
              tone = "text-danger-red";
            } else if (shift.shift_type === "annual_leave") {
              content = "Holiday";
              tone = "text-amber-text";
            } else if (shift.shift_type === "off") {
              content = "Off";
            } else if (shift.start_time && shift.end_time) {
              content = `${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`;
              tone = "text-nhs-blue";
            }
          }

          return (
            <div
              key={iso}
              className={["rounded-input border p-1.5 text-center", isToday ? "border-nhs-blue" : "border-border-default"].join(" ")}
            >
              <div className="text-secondary text-text-secondary">{day}</div>
              <div className={["mt-0.5 text-[10px]", tone].join(" ")}>{content ?? ""}</div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
