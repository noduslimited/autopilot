"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { RotaShift } from "./RotaGrid";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function MonthView({
  monthStartISO,
  todayISO,
  shifts,
}: {
  monthStartISO: string;
  todayISO: string;
  shifts: RotaShift[];
}) {
  const cells = useMemo(() => {
    const monthStart = new Date(`${monthStartISO}T00:00:00Z`);
    const monthIndex = monthStart.getUTCMonth();
    const firstWeekday = monthStart.getUTCDay(); // 0 = Sunday
    const leadingBlanks = firstWeekday === 0 ? 6 : firstWeekday - 1;
    const gridStart = new Date(monthStart);
    gridStart.setUTCDate(gridStart.getUTCDate() - leadingBlanks);

    const countByDate = new Map<string, { total: number; sick: number }>();
    for (const shift of shifts) {
      const entry = countByDate.get(shift.shift_date) ?? { total: 0, sick: 0 };
      entry.total += 1;
      if (shift.shift_type === "sick_leave") entry.sick += 1;
      countByDate.set(shift.shift_date, entry);
    }

    const days: { iso: string; inMonth: boolean; total: number; sick: number }[] = [];
    const cursor = new Date(gridStart);
    for (let i = 0; i < 42; i += 1) {
      const iso = toISODate(cursor);
      const counts = countByDate.get(iso) ?? { total: 0, sick: 0 };
      days.push({ iso, inMonth: cursor.getUTCMonth() === monthIndex, total: counts.total, sick: counts.sick });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (days.length >= 35 && cursor.getUTCMonth() !== monthIndex && i >= 34) break;
    }
    return days;
  }, [monthStartISO, shifts]);

  return (
    <div className="mt-4 overflow-hidden rounded-card border border-border-default bg-card-bg">
      <div className="grid grid-cols-7 border-b border-border-default">
        {DAY_LABELS.map((label) => (
          <div key={label} className="py-2 text-center text-label text-text-secondary">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const isToday = day.iso === todayISO;
          return (
            <Link
              key={day.iso}
              href={`/rota?view=day&date=${day.iso}`}
              className={[
                "flex min-h-[84px] flex-col gap-1 border-b border-r border-border-default p-2 last:border-r-0",
                day.inMonth ? "bg-card-bg" : "bg-page-bg text-text-muted",
                isToday ? "ring-1 ring-inset ring-nhs-blue" : "",
              ].join(" ")}
            >
              <span className={["text-secondary", isToday ? "font-semibold text-nhs-blue" : day.inMonth ? "text-text-primary" : "text-text-muted"].join(" ")}>
                {Number(day.iso.slice(8, 10))}
              </span>
              {day.total > 0 ? (
                <span className="flex flex-wrap gap-1">
                  <span className="rounded-[10px] bg-ai-blue-light px-1.5 py-0.5 text-[10px] font-medium text-[#0C447C]">
                    {day.total} shift{day.total === 1 ? "" : "s"}
                  </span>
                  {day.sick > 0 ? <span className="rounded-[10px] bg-danger-red-light px-1.5 py-0.5 text-[10px] font-medium text-danger-red">{day.sick} sick</span> : null}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
