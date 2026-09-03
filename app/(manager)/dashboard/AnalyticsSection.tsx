// Source: Gokul, direct request 2026-09-03 — dashboard analytics.
// Every figure computed live from real data by the parent server
// component (page.tsx); this is display-only.
export interface StaffAnalyticsRow {
  staffId: string;
  name: string;
  avgLatenessMin: number | null;
  activeClientCount: number;
  completedVisitsThisWeek: number;
}

export function AnalyticsSection({
  staffRows,
  avgVisitMinutes,
  avgWellbeingLabel,
  avgWellbeingScore,
  avgIncidentsPerClientPerMonth,
}: {
  staffRows: StaffAnalyticsRow[];
  avgVisitMinutes: number | null;
  avgWellbeingLabel: string | null;
  avgWellbeingScore: number | null;
  avgIncidentsPerClientPerMonth: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Staff analytics</h2>
        <p className="mt-0.5 text-secondary text-text-secondary">This week, per carer</p>

        {staffRows.length === 0 ? (
          <p className="mt-3 text-body text-text-secondary">No staff to show yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-secondary">
              <thead>
                <tr className="border-b border-border-default text-left">
                  <th className="py-1.5 pr-3">Carer</th>
                  <th className="py-1.5 pr-3">Active clients</th>
                  <th className="py-1.5 pr-3">Completed visits</th>
                  <th className="py-1.5">Avg. lateness</th>
                </tr>
              </thead>
              <tbody>
                {staffRows.map((row) => (
                  <tr key={row.staffId} className="border-b border-border-default last:border-0">
                    <td className="py-1.5 pr-3 text-text-primary">{row.name}</td>
                    <td className="py-1.5 pr-3">{row.activeClientCount}</td>
                    <td className="py-1.5 pr-3">{row.completedVisitsThisWeek}</td>
                    <td className="py-1.5">{row.avgLatenessMin === null ? "—" : `${row.avgLatenessMin} min`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Client analytics</h2>
        <p className="mt-0.5 text-secondary text-text-secondary">Organisation-wide</p>

        <div className="mt-3 divide-y divide-border-default">
          <div className="flex items-center justify-between py-2">
            <span className="text-body text-text-secondary">Avg. time per care visit</span>
            <span className="text-body font-medium text-text-primary">{avgVisitMinutes === null ? "—" : `${avgVisitMinutes} min`}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-body text-text-secondary">Avg. wellbeing this week</span>
            <span className="text-body font-medium text-text-primary">
              {avgWellbeingLabel ?? "—"}
              {avgWellbeingScore !== null ? ` (${avgWellbeingScore.toFixed(1)}/3)` : ""}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-body text-text-secondary">Avg. incidents per client / month</span>
            <span className="text-body font-medium text-text-primary">{avgIncidentsPerClientPerMonth}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
