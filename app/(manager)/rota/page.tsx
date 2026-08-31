import { createClient } from "@/lib/supabase/server";
import { RotaGrid, type RotaStaff, type RotaShift, type RotaClient } from "./RotaGrid";

// Source: PRD section 4.4 (Rota)

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

export default async function RotaPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;

  const requestedMonday = week && !Number.isNaN(Date.parse(week)) ? mondayOf(new Date(week)) : mondayOf(new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(requestedMonday);
    d.setUTCDate(d.getUTCDate() + i);
    return toISODate(d);
  });

  const supabase = await createClient();

  const [{ data: staffRows }, { data: shiftRows }, { data: clientRows }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, role, users(first_name, last_name)")
      .order("id"),
    supabase
      .from("rota_shifts")
      .select("id, staff_id, shift_date, start_time, end_time, shift_type, assigned_client_ids")
      .gte("shift_date", weekDates[0])
      .lte("shift_date", weekDates[6]),
    supabase.from("clients").select("id, first_name, last_name").eq("status", "active").order("first_name"),
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

  return (
    <RotaGrid
      staff={staff}
      shifts={shifts}
      clients={clients}
      weekDates={weekDates}
      todayISO={toISODate(new Date())}
    />
  );
}
