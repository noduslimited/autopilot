import { createClient } from "@/lib/supabase/server";
import { RotaGrid, type RotaStaff, type RotaShift, type RotaClient, type RotaVisit } from "./RotaGrid";

// Source: PRD section 4.4 (Rota) + Gokul's full-redesign request, 2026-09-03
// (see CLAUDE.md section 16a for the amendment this session adds).

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Monday-start week, matching the mockup ("Week of 25-31 August" = Mon-Sun).
function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

function firstOfMonth(monthParam?: string): Date {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export default async function RotaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string; date?: string; month?: string }>;
}) {
  const { view: rawView, week, date: dateParam, month: monthParam } = await searchParams;
  const view = rawView === "day" || rawView === "month" ? rawView : "week";
  const todayISO = toISODate(new Date());

  const requestedMonday = week && !Number.isNaN(Date.parse(week)) ? mondayOf(new Date(week)) : mondayOf(new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysISO(toISODate(requestedMonday), i));

  const selectedDate = dateParam && !Number.isNaN(Date.parse(dateParam)) ? dateParam : todayISO;

  const monthStart = firstOfMonth(monthParam);
  const monthStartISO = toISODate(monthStart);
  const nextMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const monthEndISO = toISODate(new Date(nextMonthStart.getTime() - 1));

  const supabase = await createClient();

  // Date range actually needed for shifts/visits, depending on the active
  // view — kept separate so Month view (which only needs a per-day shift
  // count, not full visit detail) stays a cheap query.
  const rangeStart = view === "day" ? selectedDate : view === "month" ? monthStartISO : weekDates[0];
  const rangeEnd = view === "day" ? selectedDate : view === "month" ? monthEndISO : weekDates[6];

  const [{ data: staffRows }, { data: shiftRows }, { data: clientRows }, { data: visitRows }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, role, users(first_name, last_name)")
      .order("id"),
    supabase
      .from("rota_shifts")
      .select("id, staff_id, shift_date, start_time, end_time, shift_type, assigned_client_ids, recurrence, recurrence_group_id")
      .gte("shift_date", rangeStart)
      .lte("shift_date", rangeEnd),
    supabase.from("clients").select("id, first_name, last_name, visit_duration_minutes").eq("status", "active").order("first_name"),
    view === "month"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("visits")
          .select("id, client_id, assigned_carer_id, scheduled_start, scheduled_end, status, clients(first_name, last_name)")
          .gte("scheduled_start", `${rangeStart}T00:00:00`)
          .lt("scheduled_start", `${addDaysISO(rangeEnd, 1)}T00:00:00`),
  ]);

  const staff: RotaStaff[] = (staffRows ?? [])
    .map((row) => {
      const user = Array.isArray(row.users) ? row.users[0] : row.users;
      return {
        id: row.id,
        name: user ? `${user.first_name} ${user.last_name}` : "Unknown",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const shifts: RotaShift[] = shiftRows ?? [];
  const clients: RotaClient[] = clientRows ?? [];
  const visits: RotaVisit[] = (visitRows ?? []).map((v) => {
    const client = Array.isArray(v.clients) ? v.clients[0] : v.clients;
    return {
      id: v.id,
      client_id: v.client_id,
      clientName: client ? `${client.first_name} ${client.last_name}` : "Unknown client",
      assigned_carer_id: v.assigned_carer_id,
      scheduled_start: v.scheduled_start,
      scheduled_end: v.scheduled_end,
      status: v.status,
    };
  });

  return (
    <RotaGrid
      view={view}
      staff={staff}
      shifts={shifts}
      clients={clients}
      visits={visits}
      weekDates={weekDates}
      selectedDate={selectedDate}
      monthStartISO={monthStartISO}
      todayISO={todayISO}
    />
  );
}
