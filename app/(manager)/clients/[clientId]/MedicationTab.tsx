import { createClient } from "@/lib/supabase/server";
import { AddMedicationButton } from "./AddMedicationButton";

// Source: PRD section 4.3 (Medication tab)
export async function MedicationTab({ clientId }: { clientId: string }) {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: manager } = await supabase.from("users").select("org_id").eq("id", authUser!.id).single();

  const [{ data: medications }, { data: emarRecords }] = await Promise.all([
    supabase
      .from("medications")
      .select("id, medication_name, dose, frequency, prescribed_by, active")
      .eq("client_id", clientId)
      .order("medication_name"),
    supabase
      .from("emar_records")
      .select("medication_id, administered, administered_at")
      .eq("client_id", clientId),
  ]);

  const recordsByMed = new Map<string, { administered: boolean; administered_at: string | null }[]>();
  for (const record of emarRecords ?? []) {
    const list = recordsByMed.get(record.medication_id) ?? [];
    list.push(record);
    recordsByMed.set(record.medication_id, list);
  }

  return (
    <div>
      <div className="flex justify-end">
        <AddMedicationButton clientId={clientId} orgId={manager!.org_id} />
      </div>

      {!medications || medications.length === 0 ? (
        <p className="mt-4 text-body text-text-secondary">No medications recorded for this client.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-border-default bg-card-bg">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-default bg-surface-secondary">
                <th className="py-2.5 px-4 text-label text-text-secondary">Medication</th>
                <th className="py-2.5 px-4 text-label text-text-secondary">Dose</th>
                <th className="py-2.5 px-4 text-label text-text-secondary">Frequency</th>
                <th className="py-2.5 px-4 text-label text-text-secondary">Prescribed by</th>
                <th className="py-2.5 px-4 text-label text-text-secondary">Last administered</th>
                <th className="py-2.5 px-4 text-label text-text-secondary">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {medications.map((med) => {
                const records = recordsByMed.get(med.id) ?? [];
                const administeredCount = records.filter((r) => r.administered).length;
                const compliance = records.length > 0 ? Math.round((administeredCount / records.length) * 100) : null;
                const lastAdministered = records
                  .filter((r) => r.administered_at)
                  .sort((a, b) => new Date(b.administered_at!).getTime() - new Date(a.administered_at!).getTime())[0];

                return (
                  <tr key={med.id} className="border-b border-border-default last:border-0">
                    <td className="py-3 px-4 text-body text-text-primary">{med.medication_name}</td>
                    <td className="py-3 px-4 text-body text-text-primary">{med.dose}</td>
                    <td className="py-3 px-4 text-body text-text-primary">{med.frequency}</td>
                    <td className="py-3 px-4 text-body text-text-primary">{med.prescribed_by ?? "—"}</td>
                    <td className="py-3 px-4 text-body text-text-primary">
                      {lastAdministered ? new Date(lastAdministered.administered_at!).toLocaleString("en-GB") : "—"}
                    </td>
                    <td className="py-3 px-4 text-body text-text-primary">{compliance !== null ? `${compliance}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
