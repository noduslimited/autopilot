import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { CarerHeaderIcons } from "@/components/carer/CarerHeaderIcons";
import { ScheduleClient, type ScheduleVisit } from "./ScheduleClient";

// Source: PRD section 5.4 (My Schedule), extended per Gokul's direct
// request 2026-09-04 (items 3 and 4 — visit card overflow, and real
// week-at-a-time navigation up to 4 weeks either side of today).

function startOfWeekUTC(date: Date): Date {
  const day = date.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday-start week
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff));
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const NAV_RANGE_WEEKS = 4;

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string; week?: string }> }) {
  const { date, week } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: carer } = await supabase.from("users").select("id, first_name, last_name").eq("id", authUser!.id).single();

  const todayStart = startOfTodayUTC();
  const currentWeekStart = startOfWeekUTC(todayStart);
  const minWeekStart = addDays(currentWeekStart, -7 * NAV_RANGE_WEEKS);
  const maxWeekStart = addDays(currentWeekStart, 7 * NAV_RANGE_WEEKS);

  let weekStart = week && !Number.isNaN(Date.parse(week)) ? startOfWeekUTC(new Date(`${week}T00:00:00Z`)) : currentWeekStart;
  if (weekStart < minWeekStart) weekStart = minWeekStart;
  if (weekStart > maxWeekStart) weekStart = maxWeekStart;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 7);
  const weekDayKeys = weekDays.map(toDateKey);

  const requestedDate = date && !Number.isNaN(Date.parse(date)) ? toDateKey(new Date(`${date}T00:00:00Z`)) : null;
  const todayKey = toDateKey(todayStart);
  // No explicit ?date= (the common case — opening Schedule fresh from the
  // bottom nav): default to today if it falls within the displayed week,
  // not the week's first day — a carer opening this mid-week should land
  // on today, not Monday.
  const selectedKey = requestedDate && weekDayKeys.includes(requestedDate) ? requestedDate : weekDayKeys.includes(todayKey) ? todayKey : weekDayKeys[0];

  const [{ data: visitRows }, { data: shiftRows }] = await Promise.all([
    supabase
      .from("visits")
      .select("id, scheduled_start, scheduled_end, status, tasks_total, tasks_completed, client:clients(first_name, last_name)")
      .eq("assigned_carer_id", carer!.id)
      .gte("scheduled_start", weekStart.toISOString())
      .lt("scheduled_start", weekEnd.toISOString())
      .order("scheduled_start", { ascending: true }),
    supabase
      .from("rota_shifts")
      .select("shift_date, shift_type")
      .eq("staff_id", carer!.id)
      .gte("shift_date", toDateKey(weekStart))
      .lt("shift_date", toDateKey(weekEnd)),
  ]);

  const visits: ScheduleVisit[] = (visitRows ?? []).map((v) => {
    const client = Array.isArray(v.client) ? v.client[0] : v.client;
    return { ...v, client } as ScheduleVisit;
  });

  const offDays = new Set(
    (shiftRows ?? []).filter((s) => s.shift_type === "off" || s.shift_type === "sick_leave" || s.shift_type === "annual_leave").map((s) => s.shift_date),
  );

  const weekLabel = `Week of ${weekDays[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}–${weekDays[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  const canGoBack = weekStart > minWeekStart;
  const canGoForward = weekStart < maxWeekStart;
  const prevWeekKey = toDateKey(addDays(weekStart, -7));
  const nextWeekKey = toDateKey(addDays(weekStart, 7));

  return (
    <div>
      <Header
        title="My schedule"
        subtitle={`${carer!.first_name} ${carer!.last_name} · ${weekLabel}`}
        right={<CarerHeaderIcons userId={carer!.id} firstName={carer!.first_name} lastName={carer!.last_name} />}
      >
        <div className="flex items-center gap-1">
          <a
            href={canGoBack ? `/schedule?week=${prevWeekKey}` : undefined}
            aria-label="Previous week"
            aria-disabled={!canGoBack}
            className={["flex h-7 w-6 shrink-0 items-center justify-center", canGoBack ? "text-white" : "pointer-events-none text-white/30"].join(" ")}
          >
            <i className="ti ti-chevron-left text-[16px]" aria-hidden="true" />
          </a>
          <div className="flex flex-1 gap-1.5 overflow-x-auto pb-1">
            {weekDays.map((d) => {
              const key = toDateKey(d);
              const isSelected = key === selectedKey;
              const isOff = offDays.has(key) || d.getUTCDay() === 0 || d.getUTCDay() === 6;
              return (
                <a
                  key={key}
                  href={`/schedule?week=${toDateKey(weekStart)}&date=${key}`}
                  className={[
                    "flex min-w-[44px] flex-col items-center rounded-input px-2 py-1.5",
                    isSelected ? "bg-nhs-light-blue text-nhs-dark-blue" : "bg-white/10 text-white",
                    isOff && !isSelected ? "opacity-50" : "",
                  ].join(" ")}
                >
                  <span className="text-tiny uppercase">{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
                  <span className="text-[15px] font-bold">{d.getUTCDate()}</span>
                </a>
              );
            })}
          </div>
          <a
            href={canGoForward ? `/schedule?week=${nextWeekKey}` : undefined}
            aria-label="Next week"
            aria-disabled={!canGoForward}
            className={["flex h-7 w-6 shrink-0 items-center justify-center", canGoForward ? "text-white" : "pointer-events-none text-white/30"].join(" ")}
          >
            <i className="ti ti-chevron-right text-[16px]" aria-hidden="true" />
          </a>
        </div>
      </Header>

      <ScheduleClient visits={visits} weekDays={weekDayKeys} selectedDate={selectedKey} weekStartKey={toDateKey(weekStart)} />
    </div>
  );
}
