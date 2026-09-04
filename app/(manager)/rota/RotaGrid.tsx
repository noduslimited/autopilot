"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, FieldLabel } from "@/components/ui/Input";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import {
  describeExistingShift,
  findOverlappingVisit,
  generateRecurrenceDates,
  type DateConflict,
  type Recurrence,
} from "@/lib/rota/conflicts";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { MonthView } from "./MonthView";
import { AiScheduleForm } from "./AiScheduleForm";

export interface RotaStaff {
  id: string;
  name: string;
}

export interface RotaShift {
  id: string;
  staff_id: string;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  shift_type: string;
  assigned_client_ids: string[];
  recurrence: string;
  recurrence_group_id: string | null;
}

export interface RotaClient {
  id: string;
  first_name: string;
  last_name: string;
  visit_duration_minutes: number | null;
}

export interface RotaVisit {
  id: string;
  client_id: string;
  clientName: string;
  assigned_carer_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
}

export function formatTimeRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

export function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

// Supabase JS's underlying fetch has no built-in timeout — a stalled
// network request (this dev environment's WSL/Windows networking has
// documented flakiness, see CLAUDE.md session logs) would otherwise leave
// a "Saving…" button hung indefinitely with no feedback. Bound every
// mutating rota_shifts call so it fails visibly instead.
const SAVE_TIMEOUT_MS = 15_000;
function withTimeout<T>(promise: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Request timed out. Please try again.")), SAVE_TIMEOUT_MS)),
  ]);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Maps a care need's key (AddClientForm's CARE_NEED_OPTIONS, care_plans.
// what_we_help_with) onto visit_tasks' narrower task_type CHECK constraint
// ('meal_prep' | 'medication' | 'moving' | 'personal_care' | 'log_notes' |
// 'custom') and reuses the exact display labels already established in
// CarePlanContent.tsx, so a generated task reads identically to how the
// same need is shown on the client's own care plan.
const TASK_TYPE_MAP: Record<string, string> = {
  meal_prep: "meal_prep",
  medication: "medication",
  moving: "moving",
  personal_care: "personal_care",
};
const CARE_NEED_LABELS: Record<string, string> = {
  meal_prep: "Meal preparation",
  medication: "Medication administration",
  moving: "Moving and handling",
  personal_care: "Personal care",
  companionship: "Companionship",
  housekeeping: "Housekeeping",
};

// One visit per assigned client per shift-day, staggered sequentially from
// the shift's start time using each client's own visit_duration_minutes —
// skips any client that already has a non-cancelled visit that day so
// re-saving a shift (or the AI scheduler proposing an already-covered day)
// doesn't duplicate it. Also cancels (status='cancelled', not deleted —
// preserves history) any visit for a client who's been REMOVED from the
// shift's client list, so editing a shift's assignment actually reflects
// in what the carer sees, instead of a phantom visit surviving the edit.
export async function ensureVisitsForShift(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  staffId: string,
  date: string,
  startTime: string,
  clientIds: string[],
) {
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${addDaysISO(date, 1)}T00:00:00`;

  const { data: existingDayVisits } = await supabase
    .from("visits")
    .select("id, client_id, status")
    .eq("assigned_carer_id", staffId)
    .gte("scheduled_start", dayStart)
    .lt("scheduled_start", dayEnd);

  const clientIdSet = new Set(clientIds);
  for (const visit of existingDayVisits ?? []) {
    if (!clientIdSet.has(visit.client_id) && visit.status === "scheduled") {
      await supabase.from("visits").update({ status: "cancelled" }).eq("id", visit.id);
    }
  }

  let cursorTime = startTime;
  for (const clientId of clientIds) {
    const existingVisit = (existingDayVisits ?? []).find((v) => v.client_id === clientId && v.status !== "cancelled");

    const { data: client } = await supabase
      .from("clients")
      .select("visit_duration_minutes")
      .eq("id", clientId)
      .maybeSingle();
    const durationMinutes = client?.visit_duration_minutes ?? 60;

    if (existingVisit) {
      cursorTime = new Date(new Date(`${date}T${cursorTime}`).getTime() + durationMinutes * 60_000)
        .toISOString()
        .slice(11, 16);
      continue;
    }

    const { data: carePlan } = await supabase
      .from("care_plans")
      .select("what_we_help_with")
      .eq("client_id", clientId)
      .maybeSingle();

    const scheduledStart = new Date(`${date}T${cursorTime}`);
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60_000);
    cursorTime = scheduledEnd.toISOString().slice(11, 16);

    const needs = carePlan?.what_we_help_with ?? [];
    const tasks = needs.map((need, index) => ({
      task_type: TASK_TYPE_MAP[need] ?? "custom",
      task_label: CARE_NEED_LABELS[need] ?? need,
      task_order: index,
      requires_emar: need === "medication",
    }));

    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .insert({
        org_id: orgId,
        client_id: clientId,
        assigned_carer_id: staffId,
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        status: "scheduled",
        tasks_total: tasks.length,
      })
      .select("id")
      .single();

    if (visitError || !visit) continue;

    if (tasks.length > 0) {
      await supabase.from("visit_tasks").insert(tasks.map((task) => ({ ...task, visit_id: visit.id, org_id: orgId })));
    }
  }
}

function weekRangeLabel(weekDates: string[]): string {
  const start = new Date(`${weekDates[0]}T00:00:00Z`);
  const end = new Date(`${weekDates[6]}T00:00:00Z`);
  const startLabel = start.toLocaleDateString("en-GB", { day: "numeric" });
  const endLabel = end.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `Week of ${startLabel}–${endLabel}`;
}

interface FormState {
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  clientIds: string[];
  recurrence: Recurrence;
  recurrenceEnd: string;
  customWeekdays: number[];
}

const EMPTY_FORM: FormState = {
  staffId: "",
  date: "",
  startTime: "",
  endTime: "",
  clientIds: [],
  recurrence: "once",
  recurrenceEnd: "",
  customWeekdays: [],
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RotaGrid({
  view,
  staff,
  shifts,
  clients,
  visits,
  weekDates,
  selectedDate,
  monthStartISO,
  todayISO,
}: {
  view: "week" | "day" | "month";
  staff: RotaStaff[];
  shifts: RotaShift[];
  clients: RotaClient[];
  visits: RotaVisit[];
  weekDates: string[];
  selectedDate: string;
  monthStartISO: string;
  todayISO: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [dateConflicts, setDateConflicts] = useState<DateConflict[]>([]);
  const [checkedConflicts, setCheckedConflicts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [detailShift, setDetailShift] = useState<RotaShift | null>(null);
  const [visitEditId, setVisitEditId] = useState<string | null>(null);
  const [visitEditStart, setVisitEditStart] = useState("");
  const [visitEditEnd, setVisitEditEnd] = useState("");
  const [visitEditWarning, setVisitEditWarning] = useState<string | null>(null);

  const [dragFrom, setDragFrom] = useState<{ staffId: string; date: string } | null>(null);
  const [moveConfirm, setMoveConfirm] = useState<{ staffId: string; staffName: string; fromDate: string; toDate: string } | null>(null);

  const [aiSuggestion, setAiSuggestion] = useState<{
    text: string;
    suggestedStaffId: string | null;
    clientIds: string[];
    sickShiftId: string;
    date: string;
  } | null>(null);
  const [aiDismissed, setAiDismissed] = useState(false);
  const [aiApplying, setAiApplying] = useState(false);

  const shiftByStaffAndDate = useMemo(() => {
    const map = new Map<string, RotaShift>();
    for (const shift of shifts) map.set(`${shift.staff_id}|${shift.shift_date}`, shift);
    return map;
  }, [shifts]);

  const visitsByStaffAndDate = useMemo(() => {
    const map = new Map<string, RotaVisit[]>();
    for (const visit of visits) {
      if (!visit.assigned_carer_id || visit.status === "cancelled") continue;
      const key = `${visit.assigned_carer_id}|${visit.scheduled_start.slice(0, 10)}`;
      const list = map.get(key) ?? [];
      list.push(visit);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
    return map;
  }, [visits]);

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staff;
    const q = search.trim().toLowerCase();
    return staff.filter((s) => s.name.toLowerCase().includes(q));
  }, [staff, search]);

  const isCurrentWeek = weekDates.includes(todayISO);
  const isPastWeek = new Date(`${weekDates[6]}T00:00:00Z`) < new Date(`${todayISO}T00:00:00Z`) && !isCurrentWeek;
  const isPastDate = (date: string) => new Date(`${date}T00:00:00Z`) < new Date(`${todayISO}T00:00:00Z`);

  const supabase = createClient();

  function openAddShift(staffId?: string, date?: string) {
    setEditingShiftId(null);
    setForm({ ...EMPTY_FORM, staffId: staffId ?? "", date: date ?? (view === "day" ? selectedDate : weekDates[0]) });
    setDateConflicts([]);
    setCheckedConflicts(false);
    setFormOpen(true);
  }

  function openEditShift(shift: RotaShift) {
    setDetailShift(null);
    setEditingShiftId(shift.id);
    setForm({
      staffId: shift.staff_id,
      date: shift.shift_date,
      startTime: shift.start_time?.slice(0, 5) ?? "",
      endTime: shift.end_time?.slice(0, 5) ?? "",
      clientIds: shift.assigned_client_ids,
      recurrence: "once",
      recurrenceEnd: "",
      customWeekdays: [],
    });
    setDateConflicts([]);
    setCheckedConflicts(false);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setEditingShiftId(null);
    setFormError(null);
    setDateConflicts([]);
    setCheckedConflicts(false);
  }

  async function saveShift(overwrite = false) {
    if (!form.staffId || !form.date || !form.startTime || !form.endTime) return;

    setSaving(true);
    setFormError(null);
    const staffName = staff.find((s) => s.id === form.staffId)?.name ?? "This carer";

    try {
      const { data: userData } = await withTimeout(supabase.auth.getUser());
      const { data: userRow, error: orgError } = await withTimeout(
        supabase.from("users").select("org_id").eq("id", userData.user!.id).single(),
      );
      if (orgError) throw orgError;
      const orgId = userRow!.org_id;

      if (editingShiftId) {
        const { error } = await withTimeout(
          supabase
            .from("rota_shifts")
            .update({
              start_time: form.startTime,
              end_time: form.endTime,
              assigned_client_ids: form.clientIds,
            })
            .eq("id", editingShiftId),
        );
        if (error) throw error;
        await ensureVisitsForShift(supabase, orgId, form.staffId, form.date, form.startTime, form.clientIds);
        closeForm();
        router.refresh();
        return;
      }

      const targetDates = generateRecurrenceDates(form.recurrence, form.date, form.recurrenceEnd || null, form.customWeekdays);

      if (!overwrite && !checkedConflicts) {
        const { data: existingOnDates } = await withTimeout(
          supabase
            .from("rota_shifts")
            .select("id, staff_id, shift_date, start_time, end_time, shift_type")
            .eq("staff_id", form.staffId)
            .in("shift_date", targetDates),
        );
        const conflicts = (existingOnDates ?? []).map((row) => describeExistingShift(row, staffName));
        if (conflicts.length > 0) {
          setDateConflicts(conflicts);
          setCheckedConflicts(true);
          setSaving(false);
          return;
        }
      }

      const shiftType = (d: string) => (isWeekend(d) ? "weekend" : "weekday");
      const recurrenceGroupId = targetDates.length > 1 ? crypto.randomUUID() : null;
      const conflictedDates = new Set(dateConflicts.map((c) => c.date));

      for (const date of targetDates) {
        const { data: existing } = await withTimeout(
          supabase.from("rota_shifts").select("id").eq("staff_id", form.staffId).eq("shift_date", date).maybeSingle(),
        );

        if (existing) {
          // Only touch dates the manager actually confirmed overwriting —
          // a recurring range might have some clear dates and some
          // conflicted ones; conflicted-but-unconfirmed dates are skipped
          // entirely rather than silently overwritten.
          if (targetDates.length > 1 && !conflictedDates.has(date) && !overwrite) continue;
          const { error } = await withTimeout(
            supabase
              .from("rota_shifts")
              .update({
                start_time: form.startTime,
                end_time: form.endTime,
                shift_type: shiftType(date),
                assigned_client_ids: form.clientIds,
                recurrence: form.recurrence,
                recurrence_group_id: recurrenceGroupId,
              })
              .eq("id", existing.id),
          );
          if (error) throw error;
        } else {
          const { error } = await withTimeout(
            supabase.from("rota_shifts").insert({
              org_id: orgId,
              staff_id: form.staffId,
              shift_date: date,
              start_time: form.startTime,
              end_time: form.endTime,
              shift_type: shiftType(date),
              assigned_client_ids: form.clientIds,
              recurrence: form.recurrence,
              recurrence_group_id: recurrenceGroupId,
            }),
          );
          if (error) throw error;
        }

        await ensureVisitsForShift(supabase, orgId, form.staffId, date, form.startTime, form.clientIds);
      }

      closeForm();
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save this shift. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteShift(shiftId: string) {
    setDetailShift(null);
    try {
      const { error } = await withTimeout(supabase.from("rota_shifts").delete().eq("id", shiftId));
      if (error) throw error;
    } catch (err) {
      console.error("Could not delete shift:", err);
    } finally {
      router.refresh();
    }
  }

  async function cancelVisit(visitId: string, shift: RotaShift, clientId: string) {
    try {
      await withTimeout(supabase.from("visits").update({ status: "cancelled" }).eq("id", visitId));
      await withTimeout(
        supabase
          .from("rota_shifts")
          .update({ assigned_client_ids: shift.assigned_client_ids.filter((id) => id !== clientId) })
          .eq("id", shift.id),
      );
    } catch (err) {
      console.error("Could not cancel visit:", err);
    } finally {
      setDetailShift(null);
      router.refresh();
    }
  }

  function startEditVisit(visit: RotaVisit) {
    setVisitEditId(visit.id);
    setVisitEditStart(visit.scheduled_start.slice(11, 16));
    setVisitEditEnd(visit.scheduled_end.slice(11, 16));
    setVisitEditWarning(null);
  }

  async function saveVisitTime(visit: RotaVisit, shiftDate: string, siblings: RotaVisit[]) {
    const newStart = new Date(`${shiftDate}T${visitEditStart}`).toISOString();
    const newEnd = new Date(`${shiftDate}T${visitEditEnd}`).toISOString();

    const overlap = findOverlappingVisit(newStart, newEnd, siblings, visit.id);
    if (overlap && !visitEditWarning) {
      setVisitEditWarning(`This overlaps ${overlap.clientName}'s visit — save anyway?`);
      return;
    }

    try {
      await withTimeout(supabase.from("visits").update({ scheduled_start: newStart, scheduled_end: newEnd }).eq("id", visit.id));
    } catch (err) {
      console.error("Could not update visit time:", err);
    } finally {
      setVisitEditId(null);
      setVisitEditWarning(null);
      router.refresh();
    }
  }

  async function markSickLeave(shift: RotaShift) {
    setDetailShift(null);
    try {
      const { error } = await withTimeout(
        supabase.from("rota_shifts").update({ shift_type: "sick_leave", start_time: null, end_time: null }).eq("id", shift.id),
      );
      if (error) throw error;
      if (shift.assigned_client_ids.length > 0) {
        requestAiSuggestion(shift);
      }
    } catch (err) {
      console.error("Could not mark sick leave:", err);
    } finally {
      router.refresh();
    }
  }

  async function requestAiSuggestion(sickShift: RotaShift) {
    const staffName = staff.find((s) => s.id === sickShift.staff_id)?.name ?? "This carer";
    const response = await fetch("/api/ai/rota-suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sickStaffId: sickShift.staff_id, sickStaffName: staffName, date: sickShift.shift_date }),
    }).catch(() => null);

    const data: { text?: string | null; suggestedStaffId?: string | null } =
      response && response.ok ? await response.json() : { text: null };

    if (data.text) {
      setAiSuggestion({
        text: data.text,
        suggestedStaffId: data.suggestedStaffId ?? null,
        clientIds: sickShift.assigned_client_ids,
        sickShiftId: sickShift.id,
        date: sickShift.shift_date,
      });
      setAiDismissed(false);
    }
  }

  async function acceptSuggestion() {
    if (!aiSuggestion || !aiSuggestion.suggestedStaffId) return;
    setAiApplying(true);

    try {
      const coveringShift = shiftByStaffAndDate.get(`${aiSuggestion.suggestedStaffId}|${aiSuggestion.date}`);
      if (coveringShift) {
        const merged = Array.from(new Set([...coveringShift.assigned_client_ids, ...aiSuggestion.clientIds]));
        const { error } = await withTimeout(
          supabase.from("rota_shifts").update({ assigned_client_ids: merged }).eq("id", coveringShift.id),
        );
        if (error) throw error;
      }
      const { error } = await withTimeout(
        supabase.from("rota_shifts").update({ assigned_client_ids: [] }).eq("id", aiSuggestion.sickShiftId),
      );
      if (error) throw error;
    } catch (err) {
      console.error("Could not apply AI suggestion:", err);
    } finally {
      setAiApplying(false);
      setAiSuggestion(null);
      router.refresh();
    }
  }

  async function confirmMove() {
    if (!moveConfirm) return;
    const shift = shiftByStaffAndDate.get(`${moveConfirm.staffId}|${moveConfirm.fromDate}`);
    if (!shift) {
      setMoveConfirm(null);
      return;
    }
    const targetExisting = shiftByStaffAndDate.get(`${moveConfirm.staffId}|${moveConfirm.toDate}`);
    if (targetExisting) {
      setMoveConfirm(null);
      return;
    }
    try {
      const { error } = await withTimeout(
        supabase
          .from("rota_shifts")
          .update({ shift_date: moveConfirm.toDate, shift_type: isWeekend(moveConfirm.toDate) ? "weekend" : "weekday" })
          .eq("id", shift.id),
      );
      if (error) throw error;
    } catch (err) {
      console.error("Could not move shift:", err);
    } finally {
      setMoveConfirm(null);
      router.refresh();
    }
  }

  function onDragStart(staffId: string, date: string) {
    setDragFrom({ staffId, date });
  }
  function onDrop(staffId: string, date: string) {
    if (dragFrom && dragFrom.staffId === staffId && dragFrom.date !== date) {
      const staffName = staff.find((s) => s.id === staffId)?.name ?? "This carer";
      setMoveConfirm({ staffId, staffName, fromDate: dragFrom.date, toDate: date });
    }
    setDragFrom(null);
  }

  const detailVisits = detailShift ? (visitsByStaffAndDate.get(`${detailShift.staff_id}|${detailShift.shift_date}`) ?? []) : [];

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-page-heading text-text-primary">Rota</h1>
          <p className="mt-1 text-secondary text-text-secondary">
            {view === "week" ? weekRangeLabel(weekDates) : view === "day" ? new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : new Date(`${monthStartISO}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-btn border border-border-default bg-card-bg p-0.5 text-[12px] font-medium">
            <Link href={`/rota?view=week&week=${weekDates[0]}`} className={["rounded-[6px] px-3 py-1.5", view === "week" ? "bg-nhs-blue text-white" : "text-text-secondary"].join(" ")}>
              Week
            </Link>
            <Link href={`/rota?view=day&date=${selectedDate}`} className={["rounded-[6px] px-3 py-1.5", view === "day" ? "bg-nhs-blue text-white" : "text-text-secondary"].join(" ")}>
              Day
            </Link>
            <Link href={`/rota?view=month&month=${monthStartISO.slice(0, 7)}`} className={["rounded-[6px] px-3 py-1.5", view === "month" ? "bg-nhs-blue text-white" : "text-text-secondary"].join(" ")}>
              Month
            </Link>
          </div>
          {view === "week" ? (
            <>
              <Link href={`/rota?view=week&week=${addDaysISO(weekDates[0], -7)}`} className="rounded-btn border border-border-default bg-card-bg px-3 py-[7px] text-text-secondary" aria-label="Previous week">
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </Link>
              <Link href={`/rota?view=week&week=${addDaysISO(weekDates[0], 7)}`} className="rounded-btn border border-border-default bg-card-bg px-3 py-[7px] text-text-secondary" aria-label="Next week">
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </Link>
            </>
          ) : view === "day" ? (
            <>
              <Link href={`/rota?view=day&date=${addDaysISO(selectedDate, -1)}`} className="rounded-btn border border-border-default bg-card-bg px-3 py-[7px] text-text-secondary" aria-label="Previous day">
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </Link>
              <Link href={`/rota?view=day&date=${addDaysISO(selectedDate, 1)}`} className="rounded-btn border border-border-default bg-card-bg px-3 py-[7px] text-text-secondary" aria-label="Next day">
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              <Link href={`/rota?view=month&month=${addDaysISO(monthStartISO, -1).slice(0, 7)}`} className="rounded-btn border border-border-default bg-card-bg px-3 py-[7px] text-text-secondary" aria-label="Previous month">
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </Link>
              <Link href={`/rota?view=month&month=${addDaysISO(monthStartISO, 32).slice(0, 7)}`} className="rounded-btn border border-border-default bg-card-bg px-3 py-[7px] text-text-secondary" aria-label="Next month">
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </Link>
            </>
          )}
          <Button onClick={() => openAddShift()} disabled={view === "week" ? isPastWeek : view === "day" ? isPastDate(selectedDate) : false}>
            Add shift
          </Button>
        </div>
      </div>

      {view !== "month" ? (
        <div className="mt-3 max-w-xs">
          <Input
            type="search"
            placeholder="Search carers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      ) : null}

      <AiScheduleForm staff={staff} clients={clients} onCreated={() => router.refresh()} createOrUpdateShift={saveShiftDirect} />

      {aiSuggestion && !aiDismissed ? (
        <div className="mt-4 rounded-[10px] border border-ai-blue-border bg-ai-blue-light py-3 px-3.5">
          <div className="flex items-start gap-2">
            <i className="ti ti-sparkles mt-0.5 text-[14px] text-nhs-blue" aria-hidden="true" />
            <p className="text-body text-ai-blue-text">{aiSuggestion.text}</p>
          </div>
          <div className="mt-2 flex items-center gap-3">
            {aiSuggestion.suggestedStaffId ? (
              <Button onClick={acceptSuggestion} disabled={aiApplying}>
                {aiApplying ? "Applying…" : "Accept suggestion"}
              </Button>
            ) : null}
            <button type="button" onClick={() => setAiDismissed(true)} className="text-body text-text-secondary">
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {view === "week" ? (
        <WeekView
          staff={filteredStaff}
          weekDates={weekDates}
          todayISO={todayISO}
          isPastWeek={isPastWeek}
          shiftByStaffAndDate={shiftByStaffAndDate}
          visitsByStaffAndDate={visitsByStaffAndDate}
          onAddShift={openAddShift}
          onOpenDetail={setDetailShift}
          onDragStart={onDragStart}
          onDrop={onDrop}
        />
      ) : view === "day" ? (
        <DayView
          staff={filteredStaff}
          date={selectedDate}
          isPast={isPastDate(selectedDate)}
          shiftByStaffAndDate={shiftByStaffAndDate}
          visitsByStaffAndDate={visitsByStaffAndDate}
          onAddShift={openAddShift}
          onOpenDetail={setDetailShift}
        />
      ) : (
        <MonthView monthStartISO={monthStartISO} todayISO={todayISO} shifts={shifts} />
      )}

      {/* Shift details modal — whole-shift actions + stacked per-client visits */}
      <Modal open={!!detailShift} onClose={() => { setDetailShift(null); setVisitEditId(null); }}>
        {detailShift ? (
          <div className="space-y-3">
            <h2 className="text-section-heading text-text-primary">{staff.find((s) => s.id === detailShift.staff_id)?.name}</h2>
            <p className="text-body text-text-secondary">
              {new Date(`${detailShift.shift_date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            {detailShift.shift_type !== "sick_leave" ? (
              <p className="text-body text-text-primary">{formatTimeRange(detailShift.start_time, detailShift.end_time)}</p>
            ) : (
              <p className="text-body text-danger-red">On sick leave</p>
            )}

            {detailShift.shift_type !== "sick_leave" ? (
              detailVisits.length === 0 ? (
                <p className="text-body text-text-secondary">No clients assigned.</p>
              ) : (
                <div className="space-y-2 rounded-input border border-border-default p-2">
                  {detailVisits.map((visit) => (
                    <div key={visit.id} className="flex items-center justify-between gap-2 border-b border-border-default pb-2 last:border-0 last:pb-0">
                      {visitEditId === visit.id ? (
                        <div className="flex flex-1 flex-wrap items-center gap-1.5">
                          <span className="text-body text-text-primary">{visit.clientName}</span>
                          <input type="time" value={visitEditStart} onChange={(e) => setVisitEditStart(e.target.value)} className="rounded-input border border-border-default px-1.5 py-0.5 text-secondary" />
                          <span className="text-text-muted">–</span>
                          <input type="time" value={visitEditEnd} onChange={(e) => setVisitEditEnd(e.target.value)} className="rounded-input border border-border-default px-1.5 py-0.5 text-secondary" />
                          <button type="button" onClick={() => saveVisitTime(visit, detailShift.shift_date, detailVisits)} className="text-secondary font-medium text-nhs-blue">
                            {visitEditWarning ? "Save anyway" : "Save"}
                          </button>
                          <button type="button" onClick={() => { setVisitEditId(null); setVisitEditWarning(null); }} className="text-secondary text-text-secondary">
                            Cancel
                          </button>
                          {visitEditWarning ? <p className="w-full text-secondary text-nhs-amber">{visitEditWarning}</p> : null}
                        </div>
                      ) : (
                        <>
                          <span className="text-body text-text-primary">
                            {visit.scheduled_start.slice(11, 16)}–{visit.scheduled_end.slice(11, 16)} {visit.clientName}
                          </span>
                          <span className="flex items-center gap-2 text-secondary">
                            <button type="button" onClick={() => startEditVisit(visit)} className="text-nhs-blue">
                              Edit
                            </button>
                            <button type="button" onClick={() => cancelVisit(visit.id, detailShift, visit.client_id)} className="text-nhs-red">
                              Cancel
                            </button>
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {detailShift.shift_type !== "sick_leave" ? (
                <Button variant="danger" onClick={() => markSickLeave(detailShift)}>
                  Mark as sick leave
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => openEditShift(detailShift)}>
                Edit
              </Button>
              <Button variant="secondary" onClick={() => deleteShift(detailShift.id)}>
                Delete shift
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Add / edit shift modal */}
      <Modal open={formOpen} onClose={closeForm}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveShift();
          }}
          className="space-y-3"
        >
          <h2 className="text-section-heading text-text-primary">{editingShiftId ? "Edit shift" : "Add shift"}</h2>
          <div>
            <FieldLabel required>Carer</FieldLabel>
            <Select required value={form.staffId} onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))} disabled={!!editingShiftId}>
              <option value="">Select a carer…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel required>Day</FieldLabel>
            <Input type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} disabled={!!editingShiftId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Start time</FieldLabel>
              <Input type="time" required value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div>
              <FieldLabel required>End time</FieldLabel>
              <Input type="time" required value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>

          {!editingShiftId ? (
            <div>
              <FieldLabel>Repeats</FieldLabel>
              <Select value={form.recurrence} onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value as Recurrence, recurrenceEnd: "" }))}>
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom days</option>
              </Select>
              {form.recurrence !== "once" ? (
                <div className="mt-2 space-y-2">
                  {form.recurrence === "custom" ? (
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_LABELS.map((label, idx) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              customWeekdays: f.customWeekdays.includes(idx)
                                ? f.customWeekdays.filter((d) => d !== idx)
                                : [...f.customWeekdays, idx],
                            }))
                          }
                          className={[
                            "rounded-[20px] border px-2.5 py-1 text-secondary",
                            form.customWeekdays.includes(idx) ? "border-nhs-blue bg-ai-blue-light text-nhs-blue" : "border-border-default text-text-secondary",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div>
                    <FieldLabel required>Ends on</FieldLabel>
                    <Input type="date" required min={form.date} value={form.recurrenceEnd} onChange={(e) => setForm((f) => ({ ...f, recurrenceEnd: e.target.value }))} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <FieldLabel>Assign clients</FieldLabel>
            <div className="max-h-[160px] space-y-1.5 overflow-y-auto rounded-input border border-border-default p-2">
              {clients.length === 0 ? (
                <p className="text-secondary text-text-secondary">No active clients yet.</p>
              ) : (
                clients.map((client) => (
                  <label key={client.id} className="flex items-center gap-2 text-body text-text-primary">
                    <input
                      type="checkbox"
                      checked={form.clientIds.includes(client.id)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          clientIds: e.target.checked ? [...f.clientIds, client.id] : f.clientIds.filter((id) => id !== client.id),
                        }))
                      }
                      className="h-4 w-4 accent-nhs-blue"
                    />
                    {client.first_name} {client.last_name}
                  </label>
                ))
              )}
            </div>
            {form.clientIds.length > 0 && form.startTime ? (
              <p className="mt-1.5 text-secondary text-text-secondary">
                Preview: {(() => {
                  let cursor = form.startTime;
                  return form.clientIds
                    .map((id) => {
                      const client = clients.find((c) => c.id === id);
                      if (!client) return null;
                      const duration = client.visit_duration_minutes ?? 60;
                      const start = cursor;
                      const end = new Date(new Date(`2000-01-01T${cursor}`).getTime() + duration * 60_000).toISOString().slice(11, 16);
                      cursor = end;
                      return `${start}–${end} ${client.first_name}`;
                    })
                    .filter(Boolean)
                    .join(", ");
                })()}
              </p>
            ) : null}
          </div>

          {dateConflicts.length > 0 ? (
            <div className="rounded-[10px] border border-danger-red-border bg-danger-red-light p-2.5">
              <p className="text-body font-medium text-danger-red">
                {dateConflicts.length === 1 ? "This date already has a shift:" : `${dateConflicts.length} of the selected dates already have a shift:`}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-secondary text-danger-red">
                {dateConflicts.slice(0, 5).map((c) => (
                  <li key={c.date}>{c.message}</li>
                ))}
                {dateConflicts.length > 5 ? <li>…and {dateConflicts.length - 5} more.</li> : null}
              </ul>
              <p className="mt-1.5 text-secondary text-text-secondary">
                Other, unaffected dates in this series will still be created normally. Save anyway to overwrite the conflicting dates too.
              </p>
            </div>
          ) : null}

          {formError ? <p className="text-body text-nhs-red">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} onClick={dateConflicts.length > 0 ? () => saveShift(true) : undefined}>
              {saving ? "Saving…" : dateConflicts.length > 0 ? "Save anyway" : "Save shift"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!moveConfirm}
        title="Move shift?"
        message={
          moveConfirm
            ? `Move ${moveConfirm.staffName}'s shift from ${new Date(`${moveConfirm.fromDate}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long" })} to ${new Date(`${moveConfirm.toDate}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long" })}? This will reassign their clients.`
            : ""
        }
        confirmLabel="Move shift"
        onConfirm={confirmMove}
        onCancel={() => setMoveConfirm(null)}
      />
    </div>
  );

  // Reusable single-shift create/update, shared with the AI scheduling
  // panel below (AiScheduleForm) so an AI-proposed shift goes through the
  // exact same conflict-aware, visit-generating path a manually-created
  // one does — never a shortcut that skips conflict checks.
  async function saveShiftDirect(proposal: {
    staffId: string;
    date: string;
    startTime: string;
    endTime: string;
    clientIds: string[];
  }): Promise<{ ok: boolean; conflict?: string }> {
    const staffName = staff.find((s) => s.id === proposal.staffId)?.name ?? "This carer";
    const { data: userData } = await supabase.auth.getUser();
    const { data: userRow } = await supabase.from("users").select("org_id").eq("id", userData.user!.id).single();
    if (!userRow) return { ok: false, conflict: "Could not resolve your organisation." };

    const { data: existing } = await supabase
      .from("rota_shifts")
      .select("id, staff_id, shift_date, start_time, end_time, shift_type")
      .eq("staff_id", proposal.staffId)
      .eq("shift_date", proposal.date)
      .maybeSingle();

    if (existing) {
      return { ok: false, conflict: describeExistingShift(existing, staffName).message };
    }

    const { error } = await supabase.from("rota_shifts").insert({
      org_id: userRow.org_id,
      staff_id: proposal.staffId,
      shift_date: proposal.date,
      start_time: proposal.startTime,
      end_time: proposal.endTime,
      shift_type: isWeekend(proposal.date) ? "weekend" : "weekday",
      assigned_client_ids: proposal.clientIds,
    });
    if (error) return { ok: false, conflict: error.message };

    await ensureVisitsForShift(supabase, userRow.org_id, proposal.staffId, proposal.date, proposal.startTime, proposal.clientIds);
    return { ok: true };
  }
}
