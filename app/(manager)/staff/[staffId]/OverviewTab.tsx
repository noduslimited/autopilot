import { createClient } from "@/lib/supabase/server";
import { EditStaffDetailsButton } from "./EditStaffDetailsButton";

// Source: PRD section 4.5 (Staff Profile — Overview tab). Per the user's
// explicit decision, this stays lean (contact/DBS/start date/emergency
// contact/assigned clients only) — training content lives exclusively on
// the Training tab, not merged in here as the mockup's flattened export
// happens to show.
export async function OverviewTab({
  staffId,
  email,
  phone,
  dbsNumber,
  dbsExpiry,
  startDate,
  emergencyContactName,
  emergencyContactPhone,
}: {
  staffId: string;
  email: string;
  phone: string | null;
  dbsNumber: string | null;
  dbsExpiry: string | null;
  startDate: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}) {
  const supabase = await createClient();
  const { data: assignedClients } = await supabase
    .from("clients")
    .select("first_name, last_name")
    .eq("assigned_carer_id", staffId)
    .eq("status", "active");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-subsection-heading text-text-primary">Contact details</h2>
          <EditStaffDetailsButton
            staffId={staffId}
            phone={phone}
            dbsNumber={dbsNumber}
            dbsExpiry={dbsExpiry}
            startDate={startDate}
            emergencyContactName={emergencyContactName}
            emergencyContactPhone={emergencyContactPhone}
          />
        </div>
        <div className="mt-2 space-y-2">
          <div className="flex justify-between text-body">
            <span className="text-text-secondary">Email</span>
            <span className="text-text-primary">{email}</span>
          </div>
          <div className="flex justify-between text-body">
            <span className="text-text-secondary">Phone</span>
            <span className="text-text-primary">{phone ?? "—"}</span>
          </div>
          <div className="flex justify-between text-body">
            <span className="text-text-secondary">Emergency contact</span>
            <span className="text-text-primary">{emergencyContactName ?? "—"}</span>
          </div>
          <div className="flex justify-between text-body">
            <span className="text-text-secondary">Emergency phone</span>
            <span className="text-text-primary">{emergencyContactPhone ?? "—"}</span>
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Compliance</h2>
        <div className="mt-2 space-y-2">
          <div className="flex justify-between text-body">
            <span className="text-text-secondary">DBS number</span>
            <span className="text-text-primary">{dbsNumber ?? "—"}</span>
          </div>
          <div className="flex justify-between text-body">
            <span className="text-text-secondary">DBS expiry</span>
            <span className="text-text-primary">
              {dbsExpiry ? new Date(dbsExpiry).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
            </span>
          </div>
          <div className="flex justify-between text-body">
            <span className="text-text-secondary">Start date</span>
            <span className="text-text-primary">
              {startDate ? new Date(startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
            </span>
          </div>
          <div className="flex justify-between text-body">
            <span className="text-text-secondary">Assigned clients</span>
            <span className="text-text-primary">
              {assignedClients && assignedClients.length > 0
                ? assignedClients.map((c) => `${c.first_name} ${c.last_name}`).join(", ")
                : "None"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
