import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StaffHoursClient, type StaffOption } from "./StaffHoursClient";

// Item 1, Gokul's direct request 2026-09-06 — Staff Hours Report, a new
// sub-page off /staff (rather than an inline section on that already-busy
// page) since it needs its own date-range/selection/results state, the
// same "dedicated sub-page for a heavier flow" precedent as /clients/new.

export default async function StaffHoursPage() {
  const supabase = await createClient();
  const { data: staffRows } = await supabase
    .from("staff")
    .select("id, role, users(first_name, last_name)")
    .order("id");

  const staff: StaffOption[] = (staffRows ?? [])
    .map((row) => {
      const user = Array.isArray(row.users) ? row.users[0] : row.users;
      return {
        id: row.id,
        name: user ? `${user.first_name} ${user.last_name}` : "Unknown",
        role: row.role as "carer" | "senior_carer" | "manager",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-5">
      <Link href="/staff" className="inline-flex items-center gap-1 text-secondary text-nhs-blue">
        <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
        Back to staff
      </Link>
      <h1 className="mt-2 text-page-heading text-text-primary">Staff hours report</h1>
      <p className="mt-1 text-secondary text-text-secondary">
        Scheduled vs. actual hours worked, for payroll and compliance checks.
      </p>

      <StaffHoursClient staff={staff} />
    </div>
  );
}
