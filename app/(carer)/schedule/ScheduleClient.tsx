"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Select, Textarea, FieldLabel } from "@/components/ui/Input";
import { PushNotificationPrompt } from "@/components/carer/PushNotificationPrompt";

// Source: PRD section 5.4 (My Schedule)

export interface ScheduleVisit {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  tasks_total: number;
  tasks_completed: number;
  client: { first_name: string; last_name: string };
}

function timeRange(start: string, end: string): string {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

const BORDER_CLASSES: Record<string, string> = {
  completed: "border-l-nhs-green",
  in_progress: "border-l-nhs-blue bg-ai-blue-light",
  scheduled: "border-l-border-default",
  missed: "border-l-danger-red",
  cancelled: "border-l-border-default",
};

function statusLabel(visit: ScheduleVisit): string {
  if (visit.status === "completed") return "Completed";
  if (visit.status === "in_progress") return `In progress (${visit.tasks_completed}/${visit.tasks_total})`;
  return `${visit.tasks_total} tasks`;
}

export function ScheduleClient({
  visits,
  weekDays,
  selectedDate,
  weekStartKey,
}: {
  visits: ScheduleVisit[];
  weekDays: string[];
  selectedDate: string;
  weekStartKey: string;
}) {
  const router = useRouter();
  const [swapOpen, setSwapOpen] = useState(false);

  const dayVisits = (day: string) => visits.filter((v) => v.scheduled_start.slice(0, 10) === day);
  const selectedVisits = dayVisits(selectedDate);
  const laterDays = weekDays.filter((d) => d > selectedDate);

  const selectedLabel = new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="box-border w-full min-w-0 max-w-full overflow-x-hidden px-4 py-4">
      <PushNotificationPrompt />

      <p className="mb-2 text-body font-medium text-text-primary">
        {selectedLabel} · {selectedVisits.length} visit{selectedVisits.length === 1 ? "" : "s"}
      </p>

      <div className="flex w-full min-w-0 flex-col gap-2">
        {selectedVisits.map((visit) => (
          <button
            key={visit.id}
            type="button"
            onClick={() => router.push(`/visit/${visit.id}`)}
            className={[
              "box-border w-full min-w-0 max-w-full overflow-hidden rounded-input border-l-4 border-y border-r border-border-default bg-card-bg p-3 text-left",
              BORDER_CLASSES[visit.status] ?? BORDER_CLASSES.scheduled,
            ].join(" ")}
          >
            <p className="truncate text-body font-medium text-text-primary">
              {visit.client.first_name} {visit.client.last_name}
            </p>
            <p className="truncate text-secondary text-text-secondary">
              {timeRange(visit.scheduled_start, visit.scheduled_end)} · {statusLabel(visit)}
            </p>
          </button>
        ))}
        {selectedVisits.length === 0 ? <p className="py-4 text-center text-body text-text-secondary">No visits scheduled.</p> : null}
      </div>

      {laterDays.length > 0 ? (
        <div className="mt-4 flex w-full min-w-0 flex-col gap-1.5">
          {laterDays.map((day) => {
            const count = dayVisits(day).length;
            if (count === 0) return null;
            return (
              <Link
                key={day}
                href={`/schedule?week=${weekStartKey}&date=${day}`}
                className="box-border flex w-full min-w-0 max-w-full items-center justify-between gap-2 overflow-hidden rounded-input border border-border-default bg-card-bg px-3 py-2.5"
              >
                <span className="truncate text-body text-text-primary">
                  {new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                </span>
                <span className="shrink-0 text-secondary text-text-secondary">
                  {count} visit{count === 1 ? "" : "s"} assigned
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setSwapOpen(true)}
        className="mt-5 w-full rounded-btn border border-border-default bg-card-bg py-[10px] text-[13px] font-medium text-text-primary"
      >
        Request shift swap or time off
      </button>

      {swapOpen ? <ShiftSwapForm onClose={() => setSwapOpen(false)} /> : null}
    </div>
  );
}

function ShiftSwapForm({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [swapWith, setSwapWith] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!date || !reason) {
      setError("Please give a date and reason.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const response = await fetch("/api/shift-swap-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, reason, swapWith: swapWith || null }),
    }).catch(() => null);
    setSubmitting(false);
    if (!response?.ok) {
      setError("Could not submit your request. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-[480px] rounded-t-card bg-card-bg p-5" onClick={(event) => event.stopPropagation()}>
        {submitted ? (
          <div className="py-4 text-center">
            <i className="ti ti-circle-check text-[32px] text-nhs-green" aria-hidden="true" />
            <p className="mt-2 text-body font-medium text-text-primary">Your manager has been notified.</p>
            <button type="button" onClick={onClose} className="mt-4 w-full rounded-btn bg-nhs-blue py-[9px] text-[13px] font-medium text-white">
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-section-heading text-text-primary">Request shift swap or time off</h2>
            <div className="mt-3">
              <FieldLabel required>Date</FieldLabel>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 w-full rounded-input border border-border-default px-3 py-[7px] text-body"
              />
            </div>
            <div className="mt-3">
              <FieldLabel required>Reason</FieldLabel>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Let your manager know why…" className="mt-1" />
            </div>
            <div className="mt-3">
              <FieldLabel>Swap with (optional)</FieldLabel>
              <Select value={swapWith} onChange={(event) => setSwapWith(event.target.value)} className="mt-1">
                <option value="">No specific swap</option>
              </Select>
            </div>
            {error ? <p className="mt-2 text-secondary text-nhs-red">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-btn border border-border-default bg-card-bg py-[9px] text-[13px] font-medium text-text-primary">
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="flex-1 rounded-btn bg-nhs-blue py-[9px] text-[13px] font-medium text-white disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
