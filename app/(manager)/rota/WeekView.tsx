"use client";

import type { DragEvent } from "react";
import type { RotaStaff, RotaShift, RotaVisit } from "./RotaGrid";
import { formatTimeRange, isWeekend } from "./RotaGrid";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDayNumber(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDate();
}

const STATUS_DOT: Record<string, string> = {
  completed: "bg-nhs-green",
  in_progress: "bg-nhs-blue",
  missed: "bg-nhs-red",
  scheduled: "bg-text-muted",
};

export function WeekView({
  staff,
  weekDates,
  todayISO,
  isPastWeek,
  shiftByStaffAndDate,
  visitsByStaffAndDate,
  leaveTypeByStaffDate,
  onAddShift,
  onOpenDetail,
  onDragStart,
  onDrop,
}: {
  staff: RotaStaff[];
  weekDates: string[];
  todayISO: string;
  isPastWeek: boolean;
  shiftByStaffAndDate: Map<string, RotaShift>;
  visitsByStaffAndDate: Map<string, RotaVisit[]>;
  leaveTypeByStaffDate: Record<string, "holiday" | "time_off">;
  onAddShift: (staffId?: string, date?: string) => void;
  onOpenDetail: (shift: RotaShift) => void;
  onDragStart: (staffId: string, date: string) => void;
  onDrop: (staffId: string, date: string) => void;
}) {
  const editable = !isPastWeek;

  function renderCell(staffMember: RotaStaff, date: string) {
    const shift = shiftByStaffAndDate.get(`${staffMember.id}|${date}`);
    const isToday = date === todayISO;
    const cellVisits = visitsByStaffAndDate.get(`${staffMember.id}|${date}`) ?? [];

    if (!shift) {
      if (!editable) return <span className="text-secondary text-text-muted">—</span>;
      return (
        <button
          type="button"
          onClick={() => onAddShift(staffMember.id, date)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(staffMember.id, date)}
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
        <button type="button" onClick={() => editable && onOpenDetail(shift)} className="w-full rounded-[20px] bg-danger-red-light px-2 py-1.5 text-center text-secondary font-medium text-danger-red">
          Sick
        </button>
      );
    }

    if (shift.shift_type === "annual_leave") {
      const leaveType = leaveTypeByStaffDate[`${staffMember.id}|${date}`];
      return (
        <button type="button" onClick={() => editable && onOpenDetail(shift)} className="w-full rounded-[20px] bg-amber-light px-2 py-1.5 text-center text-secondary font-medium text-amber-text">
          {leaveType === "holiday" ? "Holiday" : "Time off"}
        </button>
      );
    }

    const wrapperProps = {
      draggable: editable,
      onDragStart: () => onDragStart(staffMember.id, date),
      onDragOver: (e: DragEvent) => e.preventDefault(),
      onDrop: () => onDrop(staffMember.id, date),
    };

    if (cellVisits.length === 0) {
      const pillClasses = isToday ? "bg-nhs-blue text-white" : shift.shift_type === "weekend" ? "bg-[#EAF3DE] text-[#27500A]" : "bg-ai-blue-light text-[#0C447C]";
      return (
        <button type="button" {...wrapperProps} onClick={() => editable && onOpenDetail(shift)} className={["w-full rounded-[20px] px-2 py-1.5 text-center text-secondary font-medium", pillClasses].join(" ")}>
          {formatTimeRange(shift.start_time, shift.end_time)}
        </button>
      );
    }

    const visible = cellVisits.slice(0, 3);
    const hiddenCount = cellVisits.length - visible.length;

    return (
      <div {...wrapperProps} className="w-full space-y-1">
        {visible.map((visit) => (
          <button
            key={visit.id}
            type="button"
            onClick={() => editable && onOpenDetail(shift)}
            className={[
              "flex w-full items-center gap-1 rounded-[8px] px-1.5 py-1 text-left text-[11px] leading-tight",
              isToday ? "bg-nhs-blue text-white" : shift.shift_type === "weekend" ? "bg-[#EAF3DE] text-[#27500A]" : "bg-ai-blue-light text-[#0C447C]",
            ].join(" ")}
            title={`${visit.scheduled_start.slice(11, 16)}–${visit.scheduled_end.slice(11, 16)} ${visit.clientName}`}
          >
            <span className={["h-1.5 w-1.5 shrink-0 rounded-full", isToday ? "bg-white" : STATUS_DOT[visit.status] ?? "bg-text-muted"].join(" ")} aria-hidden="true" />
            <span className="truncate">
              {visit.scheduled_start.slice(11, 16)} {visit.clientName}
            </span>
          </button>
        ))}
        {hiddenCount > 0 ? (
          <button type="button" onClick={() => editable && onOpenDetail(shift)} className="w-full rounded-[8px] px-1.5 py-0.5 text-left text-[11px] text-text-secondary hover:text-nhs-blue">
            +{hiddenCount} more
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-card border border-border-default bg-card-bg">
      <table className="w-full min-w-[820px] border-collapse">
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
                    isToday ? "border-x border-nhs-blue/30 bg-[rgba(0,94,184,0.06)]" : "",
                    isWeekend(date) ? "text-text-muted" : "text-text-secondary",
                  ].join(" ")}
                >
                  <div className={isToday ? "font-semibold text-nhs-blue" : ""}>
                    {DAY_LABELS[i]} {formatDayNumber(date)}
                    {isToday ? <span className="ml-1 rounded-[10px] bg-nhs-blue px-1.5 py-0.5 text-[9px] font-medium uppercase text-white">Today</span> : null}
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
                No carers match your search.
              </td>
            </tr>
          ) : (
            staff.map((member) => (
              <tr key={member.id} className="border-b border-border-default last:border-b-0">
                <td className="py-2.5 px-3 text-body text-text-primary">{member.name}</td>
                {weekDates.map((date) => (
                  <td key={date} className={["py-2 px-2 align-top", date === todayISO ? "bg-[rgba(0,94,184,0.04)]" : ""].join(" ")}>
                    {renderCell(member, date)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
