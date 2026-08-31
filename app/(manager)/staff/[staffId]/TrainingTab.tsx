import { createClient } from "@/lib/supabase/server";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { TrainingLogForm } from "./TrainingLogForm";

const MODULE_LABELS: Record<string, string> = {
  manual_handling: "Manual handling",
  medication_awareness: "Medication awareness",
  fire_safety: "Fire safety",
  safeguarding_adults: "Safeguarding adults",
  first_aid: "First aid",
  other: "Other",
};

function statusBadge(expiryDate: string, todayISO: string): { label: string; variant: BadgeVariant } {
  const days = Math.round((new Date(expiryDate).getTime() - new Date(todayISO).getTime()) / 86400000);
  if (days < 0) return { label: "Overdue", variant: "atRisk" };
  if (days <= 60) return { label: "Due soon", variant: "dueSoon" };
  return { label: "Valid", variant: "valid" };
}

// Source: PRD section 4.5 (Staff Profile — Training tab); STF-03/STF-04.
export async function TrainingTab({ staffId, orgId }: { staffId: string; orgId: string }) {
  const supabase = await createClient();
  const { data: records } = await supabase
    .from("training_records")
    .select("id, module_name, module_label, completed_date, expiry_date")
    .eq("staff_id", staffId)
    .order("completed_date", { ascending: false });

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Training records</h2>
        {!records || records.length === 0 ? (
          <p className="mt-2 text-body text-text-secondary">No training logged yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse">
              <thead>
                <tr className="border-b border-border-default text-left text-label text-text-secondary">
                  <th className="py-2 pr-4">Module</th>
                  <th className="py-2 pr-4">Completed</th>
                  <th className="py-2 pr-4">Expires</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const badge = statusBadge(r.expiry_date, todayISO);
                  return (
                    <tr key={r.id} className="border-b border-border-default last:border-b-0">
                      <td className="py-2 pr-4 text-body text-text-primary">
                        {r.module_name === "other" ? r.module_label : MODULE_LABELS[r.module_name] ?? r.module_name}
                      </td>
                      <td className="py-2 pr-4 text-body text-text-secondary">
                        {new Date(r.completed_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-2 pr-4 text-body text-text-secondary">
                        {new Date(r.expiry_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TrainingLogForm staffId={staffId} orgId={orgId} />
    </div>
  );
}
