import { createClient } from "@/lib/supabase/server";
import { StaffPageActions } from "./StaffPageActions";
import { StaffListClient, type StaffListItem } from "./StaffListClient";

// Source: PRD section 4.5 (Staff)

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const DBS_EXPIRING_SOON_DAYS = 30;
const TRAINING_DUE_SOON_DAYS = 60;

function daysUntil(dateStr: string, todayISO: string): number {
  const ms = new Date(`${dateStr}T00:00:00Z`).getTime() - new Date(`${todayISO}T00:00:00Z`).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export default async function StaffPage() {
  const supabase = await createClient();
  const todayISO = toISODate(new Date());

  const [{ data: staffRows }, { data: shiftsToday }, { data: trainingRows }] = await Promise.all([
    supabase.from("staff").select("id, role, dbs_expiry, start_date, users(first_name, last_name)"),
    supabase.from("rota_shifts").select("staff_id, shift_type").eq("shift_date", todayISO),
    supabase.from("training_records").select("staff_id, expiry_date"),
  ]);

  const shiftByStaff = new Map((shiftsToday ?? []).map((s) => [s.staff_id, s.shift_type]));
  const trainingByStaff = new Map<string, string[]>();
  for (const t of trainingRows ?? []) {
    const list = trainingByStaff.get(t.staff_id) ?? [];
    list.push(t.expiry_date);
    trainingByStaff.set(t.staff_id, list);
  }

  const staffList: StaffListItem[] = (staffRows ?? []).map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;

    let dbsStatus: "valid" | "expiring_soon" | "expired";
    if (!row.dbs_expiry) {
      dbsStatus = "expired";
    } else {
      const days = daysUntil(row.dbs_expiry, todayISO);
      dbsStatus = days < 0 ? "expired" : days <= DBS_EXPIRING_SOON_DAYS ? "expiring_soon" : "valid";
    }

    const expiries = trainingByStaff.get(row.id) ?? [];
    let trainingStatus: "current" | "due_soon" | "overdue";
    if (expiries.length === 0) {
      trainingStatus = "overdue";
    } else if (expiries.some((d) => daysUntil(d, todayISO) < 0)) {
      trainingStatus = "overdue";
    } else if (expiries.some((d) => daysUntil(d, todayISO) <= TRAINING_DUE_SOON_DAYS)) {
      trainingStatus = "due_soon";
    } else {
      trainingStatus = "current";
    }

    const shiftType = shiftByStaff.get(row.id);
    let status: "on_shift" | "off_today" | "sick_leave" | "on_leave";
    if (shiftType === "sick_leave") status = "sick_leave";
    else if (shiftType === "annual_leave") status = "on_leave";
    else if (shiftType === "weekday" || shiftType === "weekend") status = "on_shift";
    else status = "off_today";

    return {
      id: row.id,
      name: user ? `${user.first_name} ${user.last_name}` : "Unknown",
      role: row.role as "carer" | "senior_carer" | "manager",
      dbsStatus,
      trainingStatus,
      status,
    };
  });

  const total = staffList.length;
  const onShift = staffList.filter((s) => s.status === "on_shift").length;
  const onSickLeave = staffList.filter((s) => s.status === "sick_leave").length;
  const dbsValidCount = staffList.filter((s) => s.dbsStatus === "valid").length;
  const trainingOverdueCount = staffList.filter((s) => s.trainingStatus === "overdue").length;

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-page-heading text-text-primary">Staff</h1>
          <p className="mt-1 text-secondary text-text-secondary">
            {total} active · {onSickLeave} on sick leave · {trainingOverdueCount} training overdue
          </p>
        </div>
        <StaffPageActions />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">Total staff</p>
          <p className="mt-1 text-section-heading text-text-primary">{total}</p>
        </div>
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">On shift today</p>
          <p className="mt-1 text-section-heading text-text-primary">{onShift}</p>
        </div>
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">DBS valid</p>
          <p className={["mt-1 text-section-heading", dbsValidCount === total && total > 0 ? "text-success-green-text" : "text-text-primary"].join(" ")}>
            {dbsValidCount}/{total}
          </p>
        </div>
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">Training overdue</p>
          <p className={["mt-1 text-section-heading", trainingOverdueCount > 0 ? "text-nhs-red" : "text-text-primary"].join(" ")}>
            {trainingOverdueCount}
          </p>
        </div>
      </div>

      <StaffListClient staff={staffList} />
    </div>
  );
}
