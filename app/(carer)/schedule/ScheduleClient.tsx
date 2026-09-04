"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PushNotificationPrompt } from "@/components/carer/PushNotificationPrompt";
import { ManageMyShiftsPanel, type MyShiftOption, type ColleagueOption } from "./ManageMyShiftsPanel";
import type { LeaveType } from "./page";

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

const LEAVE_CARD: Record<LeaveType, { label: string; classes: string; icon: string }> = {
  sick: { label: "Sick leave", classes: "border-danger-red-border bg-danger-red-light text-danger-red", icon: "thermometer" },
  holiday: { label: "Approved holiday", classes: "border-amber-text/20 bg-amber-light text-amber-text", icon: "beach" },
  time_off: { label: "Approved time off", classes: "border-amber-text/20 bg-amber-light text-amber-text", icon: "calendar-off" },
};

export function ScheduleClient({
  visits,
  weekDays,
  selectedDate,
  weekStartKey,
  selectedDayLeave,
  myShifts,
  colleagues,
}: {
  visits: ScheduleVisit[];
  weekDays: string[];
  selectedDate: string;
  weekStartKey: string;
  selectedDayLeave: LeaveType | null;
  myShifts: MyShiftOption[];
  colleagues: ColleagueOption[];
}) {
  const router = useRouter();

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
        {selectedLabel} {selectedDayLeave ? "" : `· ${selectedVisits.length} visit${selectedVisits.length === 1 ? "" : "s"}`}
      </p>

      {selectedDayLeave ? (
        <div className={["box-border flex w-full items-center gap-2.5 rounded-input border p-4", LEAVE_CARD[selectedDayLeave].classes].join(" ")}>
          <i className={`ti ti-${LEAVE_CARD[selectedDayLeave].icon} text-[20px]`} aria-hidden="true" />
          <p className="font-medium">{LEAVE_CARD[selectedDayLeave].label}</p>
        </div>
      ) : (
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
      )}

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

      <ManageMyShiftsPanel myShifts={myShifts} colleagues={colleagues} />
    </div>
  );
}
