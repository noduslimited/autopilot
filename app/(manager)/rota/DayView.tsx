"use client";

import type { RotaStaff, RotaShift, RotaVisit } from "./RotaGrid";
import { formatTimeRange } from "./RotaGrid";

// Source: PRD section 4.4 ("Day view — single column for the selected
// day. Rows per carer — each row shows all visits for that carer on that
// day. Visit blocks are proportional to duration.")

const DAY_START_MIN = 7 * 60; // 07:00
const DAY_END_MIN = 20 * 60; // 20:00
const TOTAL_MIN = DAY_END_MIN - DAY_START_MIN;

function minutesSinceMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

const STATUS_COLOURS: Record<string, string> = {
  completed: "bg-nhs-green/15 border-nhs-green text-[#0A4A24]",
  in_progress: "bg-ai-blue-light border-nhs-blue text-[#0C447C]",
  missed: "bg-danger-red-light border-danger-red text-danger-red",
  scheduled: "bg-ai-blue-light border-nhs-blue text-[#0C447C]",
};

export function DayView({
  staff,
  date,
  isPast,
  shiftByStaffAndDate,
  visitsByStaffAndDate,
  onAddShift,
  onOpenDetail,
}: {
  staff: RotaStaff[];
  date: string;
  isPast: boolean;
  shiftByStaffAndDate: Map<string, RotaShift>;
  visitsByStaffAndDate: Map<string, RotaVisit[]>;
  onAddShift: (staffId?: string, date?: string) => void;
  onOpenDetail: (shift: RotaShift) => void;
}) {
  const hourMarks = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 }, (_, i) => DAY_START_MIN + i * 60);

  return (
    <div className="mt-4 rounded-card border border-border-default bg-card-bg">
      <div className="flex border-b border-border-default">
        <div className="w-[130px] shrink-0 py-2 px-3 text-label text-text-secondary">Carer</div>
        <div className="relative flex-1 py-2">
          <div className="flex">
            {hourMarks.map((min) => (
              <div key={min} className="flex-1 text-center text-[10px] text-text-muted">
                {String(Math.floor(min / 60)).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>
      </div>

      {staff.length === 0 ? (
        <p className="py-8 text-center text-body text-text-secondary">No carers match your search.</p>
      ) : (
        staff.map((member) => {
          const shift = shiftByStaffAndDate.get(`${member.id}|${date}`);
          const visits = visitsByStaffAndDate.get(`${member.id}|${date}`) ?? [];

          return (
            <div key={member.id} className="flex border-b border-border-default last:border-b-0">
              <div className="w-[130px] shrink-0 py-3 px-3 text-body text-text-primary">{member.name}</div>
              <div className="relative flex-1 py-3 pr-2">
                {!shift ? (
                  <button type="button" onClick={() => onAddShift(member.id, date)} disabled={isPast} className="text-secondary text-text-muted hover:text-nhs-blue disabled:cursor-not-allowed">
                    + Add shift
                  </button>
                ) : shift.shift_type === "off" ? (
                  <span className="text-secondary text-text-muted">Off</span>
                ) : shift.shift_type === "sick_leave" ? (
                  <button type="button" onClick={() => onOpenDetail(shift)} className="rounded-[20px] bg-danger-red-light px-2.5 py-1 text-secondary font-medium text-danger-red">
                    Sick leave
                  </button>
                ) : (
                  <div className="relative h-8 rounded-[6px] bg-page-bg">
                    {/* Shift envelope, faint background */}
                    <div
                      className="absolute top-0 h-8 rounded-[6px] border border-dashed border-border-default"
                      style={{
                        left: `${Math.max(0, (((shift.start_time ? Number(shift.start_time.slice(0, 2)) * 60 + Number(shift.start_time.slice(3, 5)) : DAY_START_MIN) - DAY_START_MIN) / TOTAL_MIN) * 100)}%`,
                        width: `${(((shift.end_time ? Number(shift.end_time.slice(0, 2)) * 60 + Number(shift.end_time.slice(3, 5)) : DAY_END_MIN) - (shift.start_time ? Number(shift.start_time.slice(0, 2)) * 60 + Number(shift.start_time.slice(3, 5)) : DAY_START_MIN)) / TOTAL_MIN) * 100}%`,
                      }}
                      title={formatTimeRange(shift.start_time, shift.end_time)}
                    />
                    {visits.map((visit) => {
                      const start = minutesSinceMidnight(visit.scheduled_start);
                      const end = minutesSinceMidnight(visit.scheduled_end);
                      const left = Math.max(0, ((start - DAY_START_MIN) / TOTAL_MIN) * 100);
                      const width = Math.max(3, ((end - start) / TOTAL_MIN) * 100);
                      return (
                        <button
                          key={visit.id}
                          type="button"
                          onClick={() => onOpenDetail(shift)}
                          className={["absolute top-0 h-8 overflow-hidden rounded-[6px] border px-1.5 text-left text-[11px] leading-tight", STATUS_COLOURS[visit.status] ?? STATUS_COLOURS.scheduled].join(" ")}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${visit.scheduled_start.slice(11, 16)}–${visit.scheduled_end.slice(11, 16)} ${visit.clientName}`}
                        >
                          <span className="block truncate font-medium">{visit.clientName}</span>
                          <span className="block truncate">{visit.scheduled_start.slice(11, 16)}</span>
                        </button>
                      );
                    })}
                    {visits.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => onOpenDetail(shift)}
                        className="absolute inset-y-0 flex items-center px-2 text-secondary text-text-secondary"
                        style={{
                          left: `${Math.max(0, (((shift.start_time ? Number(shift.start_time.slice(0, 2)) * 60 + Number(shift.start_time.slice(3, 5)) : DAY_START_MIN) - DAY_START_MIN) / TOTAL_MIN) * 100)}%`,
                        }}
                      >
                        On duty {formatTimeRange(shift.start_time, shift.end_time)} — no clients assigned
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
