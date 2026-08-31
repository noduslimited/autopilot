// Source: PRD section 4.10 (Users & access — Roles & permissions):
// "Display-only matrix of role permissions (links to the agreed
// permissions matrix)." A condensed summary of the full Roles &
// Permissions Matrix document's section 3 — reproducing all 13
// sub-tables verbatim would be a document viewer, not a settings page;
// this covers the same module-by-module shape at a glance.
const ROWS: { area: string; manager: string; carer: string; family: string }[] = [
  { area: "Dashboard", manager: "✅ Full", carer: "❌", family: "❌" },
  { area: "Clients", manager: "✅ Full", carer: "🔒 Own only", family: "🔒 Own only" },
  { area: "Rota & scheduling", manager: "✅ Full", carer: "🔒 Own only", family: "❌" },
  { area: "Staff management", manager: "✅ Full", carer: "❌", family: "❌" },
  { area: "Incidents", manager: "✅ Full", carer: "🔒 File only", family: "❌" },
  { area: "Finance & invoicing", manager: "✅ Full", carer: "❌", family: "❌" },
  { area: "Reports", manager: "✅ Full", carer: "❌", family: "❌" },
  { area: "AI Copilot", manager: "✅ Full", carer: "❌", family: "❌" },
  { area: "Settings", manager: "✅ Full", carer: "❌", family: "❌" },
];

export default function PermissionsSettingsPage() {
  return (
    <div className="rounded-card border border-border-default bg-card-bg py-4 px-5">
      <h1 className="text-page-heading text-text-primary">Roles & permissions</h1>
      <p className="mt-1 text-secondary text-text-secondary">
        Role permissions are fixed in V1. Contact support to discuss custom roles.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-border-default text-left text-label text-text-secondary">
              <th className="py-2 pr-4">Area</th>
              <th className="py-2 pr-4">Manager</th>
              <th className="py-2 pr-4">Carer</th>
              <th className="py-2 pr-4">Family / NOK</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.area} className="border-b border-border-default last:border-b-0">
                <td className="py-2.5 pr-4 text-body font-medium text-text-primary">{row.area}</td>
                <td className="py-2.5 pr-4 text-body text-text-secondary">{row.manager}</td>
                <td className="py-2.5 pr-4 text-body text-text-secondary">{row.carer}</td>
                <td className="py-2.5 pr-4 text-body text-text-secondary">{row.family}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-secondary text-text-secondary">
        ✅ Full access · 👁 View only · 🔒 Own/assigned records only · ❌ No access
      </p>
    </div>
  );
}
