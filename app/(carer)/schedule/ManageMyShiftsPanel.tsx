"use client";

import { useState } from "react";
import { Select, Textarea, FieldLabel, Input } from "@/components/ui/Input";

// Source: Gokul, direct request 2026-09-04 — carer mobile portal item 5.
// Replaces the single "Request shift swap or time off" button with 5
// distinct, purpose-built forms, each a full-screen bottom sheet (this
// app's established mobile-modal pattern — see the old ShiftSwapForm
// this replaces, and PushNotificationPrompt/other carer sheets).

export interface MyShiftOption {
  id: string;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
}

export interface ColleagueOption {
  id: string;
  first_name: string;
  last_name: string;
}

type PanelKind = "time_off" | "shift_swap" | "sick" | "holiday" | "shift_issue" | null;

function shiftLabel(shift: MyShiftOption): string {
  const dateLabel = new Date(`${shift.shift_date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const timeLabel = shift.start_time && shift.end_time ? `${shift.start_time.slice(0, 5)} to ${shift.end_time.slice(0, 5)}` : "";
  return timeLabel ? `${dateLabel} — ${timeLabel}` : dateLabel;
}

function workingDaysBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  let count = 0;
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

const BUTTONS: { kind: Exclude<PanelKind, null>; icon: string; label: string }[] = [
  { kind: "time_off", icon: "calendar-off", label: "Request time off" },
  { kind: "shift_swap", icon: "arrows-exchange", label: "Swap a shift" },
  { kind: "sick", icon: "thermometer", label: "Report sick" },
  { kind: "holiday", icon: "beach", label: "Request holiday" },
  { kind: "shift_issue", icon: "flag", label: "Report an issue with a shift" },
];

export function ManageMyShiftsPanel({ myShifts, colleagues }: { myShifts: MyShiftOption[]; colleagues: ColleagueOption[] }) {
  const [open, setOpen] = useState<PanelKind>(null);

  return (
    <div className="mt-5">
      <h2 className="mb-2 text-body font-medium text-text-primary">Manage my shifts</h2>
      <div className="grid grid-cols-1 gap-2">
        {BUTTONS.map((btn) => (
          <button
            key={btn.kind}
            type="button"
            onClick={() => setOpen(btn.kind)}
            className="flex w-full items-center gap-2.5 rounded-btn border border-border-default bg-card-bg py-[10px] px-3.5 text-left text-[13px] font-medium text-text-primary"
          >
            <i className={`ti ti-${btn.icon} text-[18px] text-nhs-blue`} aria-hidden="true" />
            {btn.label}
          </button>
        ))}
      </div>

      {open === "time_off" ? <TimeOffForm onClose={() => setOpen(null)} /> : null}
      {open === "shift_swap" ? <ShiftSwapForm myShifts={myShifts} colleagues={colleagues} onClose={() => setOpen(null)} /> : null}
      {open === "sick" ? <SickReportForm onClose={() => setOpen(null)} /> : null}
      {open === "holiday" ? <HolidayForm onClose={() => setOpen(null)} /> : null}
      {open === "shift_issue" ? <ShiftIssueForm myShifts={myShifts} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-t-card bg-card-bg p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-section-heading text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <i className="ti ti-x text-[18px] text-text-muted" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Confirmation({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div className="py-4 text-center">
      <i className="ti ti-circle-check text-[32px] text-nhs-green" aria-hidden="true" />
      <p className="mt-2 text-body font-medium text-text-primary">{message}</p>
      <button type="button" onClick={onDone} className="mt-4 w-full rounded-btn bg-nhs-blue py-[9px] text-[13px] font-medium text-white">
        Done
      </button>
    </div>
  );
}

async function submitRequest(payload: {
  requestType: string;
  dateFrom: string;
  dateTo: string | null;
  category: string | null;
  notes: string | null;
  swapWithStaffId: string | null;
  shiftId: string | null;
}): Promise<boolean> {
  const response = await fetch("/api/shift-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);
  return !!response?.ok;
}

const TIME_OFF_REASONS = ["Holiday", "Personal", "Medical", "Family", "Other"];

function TimeOffForm({ onClose }: { onClose: () => void }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState(TIME_OFF_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!dateFrom || !dateTo) {
      setError("Please give a start and end date.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const ok = await submitRequest({ requestType: "time_off", dateFrom, dateTo, category: reason, notes: notes || null, swapWithStaffId: null, shiftId: null });
    setSubmitting(false);
    if (!ok) {
      setError("Could not submit your request. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  return (
    <Sheet title="Request time off" onClose={onClose}>
      {submitted ? (
        <Confirmation message="Your time off request has been sent to your manager." onDone={onClose} />
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel required>Date from</FieldLabel>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <FieldLabel required>Date to</FieldLabel>
              <Input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div>
            <FieldLabel required>Reason</FieldLabel>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {TIME_OFF_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Additional notes (optional)</FieldLabel>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          {error ? <p className="text-secondary text-nhs-red">{error}</p> : null}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-btn border border-border-default bg-card-bg py-[9px] text-[13px] font-medium text-text-primary">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit} className="flex-1 rounded-btn bg-nhs-blue py-[9px] text-[13px] font-medium text-white disabled:opacity-50">
              {submitting ? "Sending…" : "Send request"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function ShiftSwapForm({ myShifts, colleagues, onClose }: { myShifts: MyShiftOption[]; colleagues: ColleagueOption[]; onClose: () => void }) {
  const [shiftId, setShiftId] = useState("");
  const [swapWith, setSwapWith] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!shiftId || !swapWith) {
      setError("Please choose your shift and a colleague to swap with.");
      return;
    }
    const shift = myShifts.find((s) => s.id === shiftId);
    if (!shift) return;
    setSubmitting(true);
    setError(null);
    const ok = await submitRequest({
      requestType: "shift_swap",
      dateFrom: shift.shift_date,
      dateTo: shift.shift_date,
      category: null,
      notes: message || null,
      swapWithStaffId: swapWith,
      shiftId,
    });
    setSubmitting(false);
    if (!ok) {
      setError("Could not submit your request. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  return (
    <Sheet title="Swap a shift" onClose={onClose}>
      {submitted ? (
        <Confirmation message="Your swap request has been sent to your manager." onDone={onClose} />
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <FieldLabel required>My shift</FieldLabel>
            <Select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
              <option value="">Select a shift…</option>
              {myShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {shiftLabel(s)}
                </option>
              ))}
            </Select>
            {myShifts.length === 0 ? <p className="mt-1 text-secondary text-text-secondary">No upcoming shifts in the next 4 weeks.</p> : null}
          </div>
          <div>
            <FieldLabel required>Swap with colleague</FieldLabel>
            <Select value={swapWith} onChange={(e) => setSwapWith(e.target.value)}>
              <option value="">Select a colleague…</option>
              {colleagues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Message to colleague (optional)</FieldLabel>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Let them know why…" />
          </div>
          {error ? <p className="text-secondary text-nhs-red">{error}</p> : null}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-btn border border-border-default bg-card-bg py-[9px] text-[13px] font-medium text-text-primary">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit} className="flex-1 rounded-btn bg-nhs-blue py-[9px] text-[13px] font-medium text-white disabled:opacity-50">
              {submitting ? "Sending…" : "Send swap request"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function SickReportForm({ onClose }: { onClose: () => void }) {
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [returnDate, setReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!dateFrom) {
      setError("Please give the date(s) affected.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const ok = await submitRequest({
      requestType: "sick",
      dateFrom,
      dateTo: returnDate || dateTo || dateFrom,
      category: null,
      notes: notes || null,
      swapWithStaffId: null,
      shiftId: null,
    });
    setSubmitting(false);
    if (!ok) {
      setError("Could not submit your report. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  return (
    <Sheet title="Report sick" onClose={onClose}>
      {submitted ? (
        <Confirmation message="Your sick report has been sent. Please rest and get well soon." onDone={onClose} />
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel required>Date(s) from</FieldLabel>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Date(s) to</FieldLabel>
              <Input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div>
            <FieldLabel>Expected return date (optional)</FieldLabel>
            <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Brief note (optional)</FieldLabel>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          {error ? <p className="text-secondary text-nhs-red">{error}</p> : null}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-btn border border-border-default bg-card-bg py-[9px] text-[13px] font-medium text-text-primary">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit} className="flex-1 rounded-btn bg-nhs-red py-[9px] text-[13px] font-medium text-white disabled:opacity-50">
              {submitting ? "Sending…" : "Report sick"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function HolidayForm({ onClose }: { onClose: () => void }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDays = workingDaysBetween(dateFrom, dateTo);

  async function handleSubmit() {
    if (!dateFrom || !dateTo) {
      setError("Please give a start and end date.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const ok = await submitRequest({ requestType: "holiday", dateFrom, dateTo, category: null, notes: notes || null, swapWithStaffId: null, shiftId: null });
    setSubmitting(false);
    if (!ok) {
      setError("Could not submit your request. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  return (
    <Sheet title="Request holiday" onClose={onClose}>
      {submitted ? (
        <Confirmation message="Your holiday request has been sent to your manager for approval." onDone={onClose} />
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel required>Holiday from</FieldLabel>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <FieldLabel required>Holiday to</FieldLabel>
              <Input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          {dateFrom && dateTo ? <p className="text-secondary text-text-secondary">Total days requested: {totalDays} working day{totalDays === 1 ? "" : "s"}</p> : null}
          <div>
            <FieldLabel>Notes (optional)</FieldLabel>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          {error ? <p className="text-secondary text-nhs-red">{error}</p> : null}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-btn border border-border-default bg-card-bg py-[9px] text-[13px] font-medium text-text-primary">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit} className="flex-1 rounded-btn bg-nhs-blue py-[9px] text-[13px] font-medium text-white disabled:opacity-50">
              {submitting ? "Sending…" : "Send holiday request"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

const ISSUE_TYPES = ["Wrong time", "Wrong client", "Wrong location", "Missing shift", "Duplicate shift", "Other"];

function ShiftIssueForm({ myShifts, onClose }: { myShifts: MyShiftOption[]; onClose: () => void }) {
  const [shiftId, setShiftId] = useState("");
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!shiftId || !description.trim()) {
      setError("Please choose the shift and describe the issue.");
      return;
    }
    const shift = myShifts.find((s) => s.id === shiftId);
    if (!shift) return;
    setSubmitting(true);
    setError(null);
    const ok = await submitRequest({
      requestType: "shift_issue",
      dateFrom: shift.shift_date,
      dateTo: shift.shift_date,
      category: issueType,
      notes: description,
      swapWithStaffId: null,
      shiftId,
    });
    setSubmitting(false);
    if (!ok) {
      setError("Could not submit your report. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  return (
    <Sheet title="Report an issue with a shift" onClose={onClose}>
      {submitted ? (
        <Confirmation message="Your shift issue has been reported to your manager." onDone={onClose} />
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <FieldLabel required>Which shift</FieldLabel>
            <Select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
              <option value="">Select a shift…</option>
              {myShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {shiftLabel(s)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel required>Issue type</FieldLabel>
            <Select value={issueType} onChange={(e) => setIssueType(e.target.value)}>
              {ISSUE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel required>Description</FieldLabel>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe what's wrong…" />
          </div>
          {error ? <p className="text-secondary text-nhs-red">{error}</p> : null}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-btn border border-border-default bg-card-bg py-[9px] text-[13px] font-medium text-text-primary">
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleSubmit} className="flex-1 rounded-btn bg-nhs-blue py-[9px] text-[13px] font-medium text-white disabled:opacity-50">
              {submitting ? "Sending…" : "Report issue"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
