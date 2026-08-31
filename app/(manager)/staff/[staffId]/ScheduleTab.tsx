import { createClient } from "@/lib/supabase/server";

// Source: PRD section 4.5 (Staff Profile — Schedule tab): "This staff
// member's shifts for the current month — Calendar view." Read-only —
// editing shifts happens on the Rota page.
function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export async function ScheduleTab({ staffId }: { staffId: string }) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  const supabase = await createClient();
  const { data: shifts } = await supabase
    .from("rota_shifts")
    .select("shift_date, start_time, end_time, shift_type")
    .eq("staff_id", staffId)
    .gte("shift_date", toISODate(monthStart))
    .lte("shift_date", toISODate(monthEnd));

  const shiftByDate = new Map((shifts ?? []).map((s) => [s.shift_date, s]));

  // Leading blanks so day 1 lines up under its correct weekday column (Mon-start week).
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7;
  const totalDays = monthEnd.getUTCDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
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
  );
}
