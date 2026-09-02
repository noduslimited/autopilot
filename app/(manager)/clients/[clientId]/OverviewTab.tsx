import { NokMessagingToggle } from "./NokMessagingToggle";

// Source: PRD section 4.3 (Client Profile — Overview tab)
interface OverviewClient {
  id: string;
  address: string;
  biography: string | null;
  nok_name: string | null;
  nok_relationship: string | null;
  nok_email: string | null;
  nok_phone: string | null;
  gp_name: string | null;
  gp_practice: string | null;
  gp_phone: string | null;
  care_type: string;
  visit_frequency: string | null;
  visit_duration_minutes: number | null;
  nok_messaging_enabled: boolean;
}

const CARE_TYPE_LABELS: Record<string, string> = {
  domiciliary: "Domiciliary",
  residential: "Residential",
  supported_living: "Supported living",
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  twice_daily: "Twice daily",
  three_times_daily: "Three times daily",
  weekly: "Weekly",
  custom: "Custom",
};

// Session 9 (Carer Mobile) builds the shared lib/utils/maps.ts version of
// this — kept local here since only one link needs it this session.
function mapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function OverviewTab({ client, carerName }: { client: OverviewClient; carerName: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">About</h2>
        <p className="mt-2 text-body text-text-primary">{client.biography || "No biography recorded yet."}</p>
      </div>

      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Address</h2>
        <p className="mt-2 text-body text-text-primary">{client.address}</p>
        <a href={mapsUrl(client.address)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-body text-nhs-blue">
          <i className="ti ti-map-pin text-[14px]" aria-hidden="true" />
          Get directions
        </a>
      </div>

      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Key contacts</h2>
        <div className="mt-2 space-y-3">
          <div>
            <p className="text-label text-text-secondary">Next of kin</p>
            <p className="text-body text-text-primary">
              {client.nok_name || "—"}
              {client.nok_relationship ? ` (${client.nok_relationship})` : ""}
            </p>
            <p className="text-secondary text-text-secondary">
              {client.nok_phone ?? "—"} {client.nok_email ? `· ${client.nok_email}` : ""}
            </p>
          </div>
          <div>
            <p className="text-label text-text-secondary">GP</p>
            <p className="text-body text-text-primary">{client.gp_name || "—"}</p>
            <p className="text-secondary text-text-secondary">
              {client.gp_practice ?? "—"} {client.gp_phone ? `· ${client.gp_phone}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Care package</h2>
        <p className="mt-2 text-body text-text-primary">
          {CARE_TYPE_LABELS[client.care_type] ?? client.care_type} care
          {carerName ? ` · ${carerName}` : ""}
        </p>
        <p className="mt-1 text-secondary text-text-secondary">
          {client.visit_frequency ? FREQUENCY_LABELS[client.visit_frequency] ?? client.visit_frequency : "Frequency not set"}
          {client.visit_duration_minutes ? ` · ${client.visit_duration_minutes} mins per visit` : ""}
        </p>
      </div>

      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Family portal</h2>
        <NokMessagingToggle clientId={client.id} initialEnabled={client.nok_messaging_enabled} />
      </div>
    </div>
  );
}
