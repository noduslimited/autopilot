"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, FieldLabel } from "@/components/ui/Input";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";

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
}

export interface RotaClient {
  id: string;
  first_name: string;
  last_name: string;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function formatDayNumber(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDate();
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
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
}

const EMPTY_FORM: FormState = { staffId: "", date: "", startTime: "", endTime: "", clientIds: [] };

export function RotaGrid({
  staff,
  shifts,
  clients,
  weekDates,
  todayISO,
}: {
  staff: RotaStaff[];
  shifts: RotaShift[];
  clients: RotaClient[];
  weekDates: string[];
  todayISO: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [conflictConfirm, setConflictConfirm] = useState<{ existingId: string; staffName: string; dayLabel: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [detailShift, setDetailShift] = useState<RotaShift | null>(null);

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

  const isCurrentWeek = weekDates.includes(todayISO);
  const isPastWeek = new Date(`${weekDates[6]}T00:00:00Z`) < new Date(`${todayISO}T00:00:00Z`) && !isCurrentWeek;

  const supabase = createClient();

  function openAddShift(staffId?: string, date?: string) {
    setEditingShiftId(null);
    setForm({ ...EMPTY_FORM, staffId: staffId ?? "", date: date ?? weekDates[0] });
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
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setEditingShiftId(null);
    setFormError(null);
  }

  async function saveShift(overwrite = false) {
    if (!form.staffId || !form.date || !form.startTime || !form.endTime) return;

    setSaving(true);
    setFormError(null);
    const shiftType = isWeekend(form.date) ? "weekend" : "weekday";

    try {
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
        closeForm();
        router.refresh();
        return;
      }

      // Look up any existing shift for this staff member/day with a live
      // query rather than the locally-loaded `shifts` prop — that prop
      // only covers the currently displayed week, so a date picked
      // outside it (the modal's date field isn't restricted to the
      // visible week) would otherwise be invisible to a client-side-only
      // check and hit the rota_shifts_staff_date_key unique constraint
      // unhandled at save time.
      const { data: existing, error: lookupError } = await withTimeout(
        supabase.from("rota_shifts").select("id").eq("staff_id", form.staffId).eq("shift_date", form.date).maybeSingle(),
      );
      if (lookupError) throw lookupError;

      if (existing && !overwrite) {
        const staffName = staff.find((s) => s.id === form.staffId)?.name ?? "This carer";
        const dayLabel = new Date(`${form.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long" });
        setConflictConfirm({ existingId: existing.id, staffName, dayLabel });
        return;
      }

      if (existing) {
        const { error } = await withTimeout(
          supabase
            .from("rota_shifts")
            .update({
              start_time: form.startTime,
              end_time: form.endTime,
              shift_type: shiftType,
              assigned_client_ids: form.clientIds,
            })
            .eq("id", existing.id),
        );
        if (error) throw error;
      } else {
        const { data: userData } = await withTimeout(supabase.auth.getUser());
        const { data: userRow, error: orgError } = await withTimeout(
          supabase.from("users").select("org_id").eq("id", userData.user!.id).single(),
        );
        if (orgError) throw orgError;
        const { error } = await withTimeout(
          supabase.from("rota_shifts").insert({
            org_id: userRow!.org_id,
            staff_id: form.staffId,
            shift_date: form.date,
            start_time: form.startTime,
            end_time: form.endTime,
            shift_type: shiftType,
            assigned_client_ids: form.clientIds,
          }),
        );
        if (error) throw error;
      }

      setConflictConfirm(null);
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
      // A shift already exists on the target day — treat as a conflict too.
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

  function renderCell(staffMember: RotaStaff, date: string) {
    const shift = shiftByStaffAndDate.get(`${staffMember.id}|${date}`);
    const isToday = date === todayISO;
    const editable = !isPastWeek;

    if (!shift) {
      if (!editable) return <span className="text-secondary text-text-muted">—</span>;
      return (
        <button
          type="button"
          onClick={() => openAddShift(staffMember.id, date)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragFrom && dragFrom.staffId === staffMember.id && dragFrom.date !== date) {
              setMoveConfirm({ staffId: staffMember.id, staffName: staffMember.name, fromDate: dragFrom.date, toDate: date });
            }
            setDragFrom(null);
          }}
          className="w-full rounded-btn border border-dashed border-border-default py-2 text-center text-secondary text-text-muted hover:border-nhs-blue hover:text-nhs-blue"
        >
          + Add
        </button>
      );
    }

    if (shift.shift_type === "off") {
      return <span className="text-secondary text-text-muted">Off</span>;
    }

    if (shift.shift_type === "sick_leave") {
      return (
        <button
          type="button"
          onClick={() => editable && setDetailShift(shift)}
          className="w-full rounded-[20px] bg-danger-red-light px-2 py-1.5 text-center text-secondary font-medium text-danger-red"
        >
          Sick
        </button>
      );
    }

    const pillClasses = isToday
      ? "bg-nhs-blue text-white"
      : shift.shift_type === "weekend"
        ? "bg-[#EAF3DE] text-[#27500A]"
        : "bg-ai-blue-light text-[#0C447C]";

    return (
      <button
        type="button"
        draggable={editable}
        onDragStart={() => setDragFrom({ staffId: staffMember.id, date })}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          if (dragFrom && dragFrom.staffId === staffMember.id && dragFrom.date !== date) {
            setMoveConfirm({ staffId: staffMember.id, staffName: staffMember.name, fromDate: dragFrom.date, toDate: date });
          }
          setDragFrom(null);
        }}
        onClick={() => editable && setDetailShift(shift)}
        className={["w-full rounded-[20px] px-2 py-1.5 text-center text-secondary font-medium", pillClasses].join(" ")}
      >
        {formatTimeRange(shift.start_time, shift.end_time)}
      </button>
    );
  }

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-page-heading text-text-primary">Rota</h1>
          <p className="mt-1 text-secondary text-text-secondary">{weekRangeLabel(weekDates)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-btn border border-border-default bg-card-bg p-0.5 text-[12px] font-medium">
            <span className="rounded-[6px] bg-nhs-blue px-3 py-1.5 text-white">Week</span>
            <span className="cursor-not-allowed px-3 py-1.5 text-text-muted" title="Coming soon">
              Day
            </span>
            <span className="cursor-not-allowed px-3 py-1.5 text-text-muted" title="Coming soon">
              Month
            </span>
          </div>
          <Link
            href={`/rota?week=${addDaysISO(weekDates[0], -7)}`}
            className="rounded-btn border border-border-default bg-card-bg px-3 py-[7px] text-text-secondary"
            aria-label="Previous week"
          >
            <i className="ti ti-chevron-left" aria-hidden="true" />
          </Link>
          <Link
            href={`/rota?week=${addDaysISO(weekDates[0], 7)}`}
            className="rounded-btn border border-border-default bg-card-bg px-3 py-[7px] text-text-secondary"
            aria-label="Next week"
          >
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </Link>
          <Button onClick={() => openAddShift()} disabled={isPastWeek}>
            Add shift
          </Button>
        </div>
      </div>

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

      <div className="mt-4 overflow-x-auto rounded-card border border-border-default bg-card-bg">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-border-default">
              <th className="w-[130px] shrink-0 py-2.5 px-3 text-left text-label text-text-secondary">Carer</th>
              {weekDates.map((date, i) => {
                const isToday = date === todayISO;
                return (
                  <th
                    key={date}
                    className={[
                      "py-2.5 px-2 text-center text-label",
                      isToday ? "bg-[rgba(0,94,184,0.04)]" : "",
                      isWeekend(date) ? "text-text-muted" : "text-text-secondary",
                    ].join(" ")}
                  >
                    <div className={isToday ? "font-medium text-nhs-blue" : ""}>
                      {DAY_LABELS[i]} {formatDayNumber(date)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-body text-text-secondary">
                  No staff yet. Invite your first team member from the Staff page.
                </td>
              </tr>
            ) : (
              staff.map((member) => (
                <tr key={member.id} className="border-b border-border-default last:border-b-0">
                  <td className="py-2.5 px-3 text-body text-text-primary">{member.name}</td>
                  {weekDates.map((date) => (
                    <td key={date} className={["py-2 px-2", date === todayISO ? "bg-[rgba(0,94,184,0.04)]" : ""].join(" ")}>
                      {renderCell(member, date)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Shift details popover */}
      <Modal open={!!detailShift} onClose={() => setDetailShift(null)}>
        {detailShift ? (
          <div className="space-y-3">
            <h2 className="text-section-heading text-text-primary">
              {staff.find((s) => s.id === detailShift.staff_id)?.name}
            </h2>
            <p className="text-body text-text-secondary">
              {new Date(`${detailShift.shift_date}T00:00:00Z`).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            {detailShift.shift_type !== "sick_leave" ? (
              <p className="text-body text-text-primary">{formatTimeRange(detailShift.start_time, detailShift.end_time)}</p>
            ) : (
              <p className="text-body text-danger-red">On sick leave</p>
            )}
            <p className="text-body text-text-secondary">
              {detailShift.assigned_client_ids.length > 0
                ? `${detailShift.assigned_client_ids.length} client${detailShift.assigned_client_ids.length === 1 ? "" : "s"} assigned`
                : "No clients assigned"}
            </p>
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
                Delete
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
            <Select
              required
              value={form.staffId}
              onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
              disabled={!!editingShiftId}
            >
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
            <Input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              disabled={!!editingShiftId}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Start time</FieldLabel>
              <Input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel required>End time</FieldLabel>
              <Input
                type="time"
                required
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
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
                          clientIds: e.target.checked
                            ? [...f.clientIds, client.id]
                            : f.clientIds.filter((id) => id !== client.id),
                        }))
                      }
                      className="h-4 w-4 accent-nhs-blue"
                    />
                    {client.first_name} {client.last_name}
                  </label>
                ))
              )}
            </div>
          </div>
          {formError ? <p className="text-body text-nhs-red">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save shift"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!conflictConfirm}
        title="Shift already exists"
        message={
          conflictConfirm
            ? `${conflictConfirm.staffName} already has a shift on ${conflictConfirm.dayLabel}. Save anyway?`
            : ""
        }
        confirmLabel="Save anyway"
        onConfirm={() => saveShift(true)}
        onCancel={() => setConflictConfirm(null)}
      />

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
}
