// Shared shift-conflict helpers (Gokul, Rota redesign, 2026-09-03).
//
// rota_shifts keeps its one-shift-ENVELOPE-per-carer-per-day uniqueness
// (rota_shifts_staff_date_key) — the redesign's "multiple client visits
// stacked in time order" comes from the visits table (one row per client
// visit, its own scheduled_start/scheduled_end), not from allowing
// multiple shift rows per day. So "double booking" in practice means
// "this staff member already has a shift envelope on this date" — the
// thing worth surfacing is WHAT that existing shift is (a normal working
// shift to merge into, or sick/off/annual leave which almost certainly
// shouldn't be overwritten silently) — most relevant when adding a
// recurring shift across several dates at once, where some dates may
// already be occupied and others not.
//
// Travel-time conflict checking (distance between consecutive visit
// addresses) is explicitly deferred — see CLAUDE.md section 19 (Post-
// Launch Checklist), added 2026-09-03. It needs a paid geocoding/distance
// API Gokul hasn't set up yet.

export interface ShiftLike {
  id: string;
  staff_id: string;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  shift_type: string;
}

export interface DateConflict {
  date: string;
  existingShiftId: string;
  message: string;
}

const LEAVE_LABELS: Record<string, string> = {
  off: "a day off",
  sick_leave: "sick leave",
  annual_leave: "annual leave",
};

export function describeExistingShift(existing: ShiftLike, staffName: string): DateConflict {
  const leaveLabel = LEAVE_LABELS[existing.shift_type];
  const message = leaveLabel
    ? `${staffName} is marked as ${leaveLabel} on ${existing.shift_date}.`
    : existing.start_time && existing.end_time
      ? `${staffName} already has a shift ${existing.start_time.slice(0, 5)}–${existing.end_time.slice(0, 5)} on ${existing.shift_date}.`
      : `${staffName} already has a shift on ${existing.shift_date}.`;
  return { date: existing.shift_date, existingShiftId: existing.id, message };
}

export interface VisitTimeLike {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  clientName?: string;
}

// Informational only (not a hard block) — used when a manager manually
// edits one visit's time within the shift-detail modal, to flag if it now
// overlaps a sibling visit in the same shift.
export function findOverlappingVisit(
  proposedStart: string,
  proposedEnd: string,
  siblings: VisitTimeLike[],
  excludeVisitId?: string,
): VisitTimeLike | null {
  const start = new Date(proposedStart).getTime();
  const end = new Date(proposedEnd).getTime();
  for (const sibling of siblings) {
    if (sibling.id === excludeVisitId) continue;
    const sStart = new Date(sibling.scheduled_start).getTime();
    const sEnd = new Date(sibling.scheduled_end).getTime();
    if (start < sEnd && sStart < end) return sibling;
  }
  return null;
}

export type Recurrence = "once" | "daily" | "weekly" | "custom";

// Generates the concrete dates a recurrence pattern covers, starting from
// (and including) startDate through endDate inclusive. "custom" uses
// weekdays (0=Sun..6=Sat) explicitly picked by the manager.
export function generateRecurrenceDates(
  recurrence: Recurrence,
  startDate: string,
  endDate: string | null,
  customWeekdays?: number[],
): string[] {
  if (recurrence === "once" || !endDate) return [startDate];

  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const startWeekday = cursor.getUTCDay();
  const weekdaySet = new Set(customWeekdays ?? []);

  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    if (recurrence === "daily") {
      dates.push(iso);
    } else if (recurrence === "weekly") {
      if (cursor.getUTCDay() === startWeekday) dates.push(iso);
    } else if (recurrence === "custom") {
      if (weekdaySet.has(cursor.getUTCDay())) dates.push(iso);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates.length > 0 ? dates : [startDate];
}
