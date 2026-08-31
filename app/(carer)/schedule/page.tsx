import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { ScheduleClient, type ScheduleVisit } from "./ScheduleClient";

// Source: PRD section 5.4 (My Schedule)

function startOfWeekUTC(date: Date): Date {
  const day = date.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday-start week
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff));
  return monday;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: carer } = await supabase.from("users").select("id, first_name, last_name").eq("id", authUser!.id).single();

  const selectedDate = date ? new Date(`${date}T00:00:00Z`) : new Date(startOfTodayUTC());
  const weekStart = startOfWeekUTC(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

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
  const selectedKey = toDateKey(selectedDate);

  return (
    <div>
      <Header title="My schedule" subtitle={`${carer!.first_name} ${carer!.last_name} · ${weekLabel}`}>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {weekDays.map((d) => {
            const key = toDateKey(d);
            const isSelected = key === selectedKey;
            const isOff = offDays.has(key) || d.getUTCDay() === 0 || d.getUTCDay() === 6;
            return (
              <a
                key={key}
                href={`/schedule?date=${key}`}
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
      </Header>

      <ScheduleClient visits={visits} weekDays={weekDays.map((d) => toDateKey(d))} selectedDate={selectedKey} />
    </div>
  );
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
