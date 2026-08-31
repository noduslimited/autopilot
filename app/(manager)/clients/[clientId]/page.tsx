import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClientAvatar } from "@/components/clients/ClientAvatar";
import { CriticalBadges } from "@/components/clients/CriticalBadges";
import { OverviewTab } from "./OverviewTab";
import { CarePlanTab } from "./CarePlanTab";
import { VisitsTab } from "./VisitsTab";
import { IncidentsTab } from "./IncidentsTab";
import { MedicationTab } from "./MedicationTab";
import { DocumentsTab } from "./DocumentsTab";
import { MessagesTab } from "./MessagesTab";

// Source: PRD section 4.3 (Client Profile) + section 6.6 ("Manager replies
// from within the client profile (Messages tab)"). Messages wasn't in the
// IA doc's original 6-tab list for this screen — added per Session 10's
// decision (see CLAUDE.md log) since the family messages feature this
// session builds is untestable without a working manager-side reply.
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "care-plan", label: "Care Plan" },
  { key: "visits", label: "Visits" },
  { key: "incidents", label: "Incidents" },
  { key: "medication", label: "Medication" },
  { key: "documents", label: "Documents" },
  { key: "messages", label: "Messages" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const CARE_TYPE_LABELS: Record<string, string> = {
  domiciliary: "Domiciliary",
  residential: "Residential",
  supported_living: "Supported living",
};

export default async function ClientProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ tab?: string; created?: string; nokInviteError?: string }>;
}) {
  const { clientId } = await params;
  const { tab, created, nokInviteError } = await searchParams;
  const activeTab: TabKey = (TABS.find((t) => t.key === tab)?.key ?? "overview") as TabKey;

  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: manager } = await supabase.from("users").select("id, first_name, last_name").eq("id", authUser!.id).single();

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, client_ref, org_id, first_name, last_name, date_of_birth, nhs_number, address, care_type, assigned_carer_id, risk_level, allergies, dietary_requirements, dnacpr, biography, nok_name, nok_relationship, nok_email, nok_phone, gp_name, gp_practice, gp_phone, visit_frequency, visit_duration_minutes, status, users:assigned_carer_id(first_name, last_name)",
    )
    .eq("id", clientId)
    .single();

  if (!client) {
    return (
      <div className="p-5">
        <p className="text-body text-text-secondary">This page doesn&apos;t exist.</p>
        <Link href="/clients" className="text-body text-nhs-blue">
          Go home
        </Link>
      </div>
    );
  }

  const carer = single(client.users);

  return (
    <div className="p-5">
      <Link href="/clients" className="text-secondary text-nhs-blue">
        ← Back to clients
      </Link>

      {created ? (
        <div className="mt-3 rounded-card border border-success-green-text/20 bg-success-green-light py-2.5 px-4 text-body text-success-green-text">
          {client.first_name} {client.last_name} has been added. Client ID: {client.client_ref}
        </div>
      ) : null}

      {nokInviteError ? (
        <div className="mt-3 rounded-card border border-amber-text/20 bg-amber-light py-2.5 px-4 text-body text-amber-text">
          Family portal invitation not sent: {nokInviteError}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ClientAvatar firstName={client.first_name} lastName={client.last_name} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-section-heading text-text-primary">
                {client.first_name} {client.last_name}
              </h1>
              <span className="font-mono text-body font-medium text-nhs-blue">{client.client_ref}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <CriticalBadges
                client={{
                  allergies: client.allergies,
                  dietary_requirements: client.dietary_requirements,
                  dnacpr: client.dnacpr,
                  risk_level: client.risk_level as "low" | "medium" | "high",
                  assigned_carer_id: client.assigned_carer_id,
                }}
              />
            </div>
            <p className="mt-1 text-secondary text-text-secondary">
              {calculateAge(client.date_of_birth)} yrs · {CARE_TYPE_LABELS[client.care_type] ?? client.care_type} ·{" "}
              {carer ? `${carer.first_name} ${carer.last_name}` : "No carer assigned"}
            </p>
          </div>
        </div>
        <Link
          href={`/clients/${client.id}?tab=${activeTab}&edit=1`}
          className="rounded-btn border border-border-default bg-card-bg px-3.5 py-[7px] text-[12px] font-medium text-text-primary"
        >
          Edit
        </Link>
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-border-default">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/clients/${client.id}?tab=${t.key}`}
            className={[
              "shrink-0 border-b-2 px-3 py-2.5 text-body font-medium",
              activeTab === t.key ? "border-nhs-blue text-nhs-blue" : "border-transparent text-text-secondary",
            ].join(" ")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === "overview" ? <OverviewTab client={client} carerName={carer ? `${carer.first_name} ${carer.last_name}` : null} /> : null}
        {activeTab === "care-plan" ? <CarePlanTab clientId={client.id} clientFirstName={client.first_name} /> : null}
        {activeTab === "visits" ? <VisitsTab clientId={client.id} /> : null}
        {activeTab === "incidents" ? <IncidentsTab clientId={client.id} /> : null}
        {activeTab === "medication" ? <MedicationTab clientId={client.id} /> : null}
        {activeTab === "documents" ? <DocumentsTab clientId={client.id} /> : null}
        {activeTab === "messages" ? (
          <MessagesTab orgId={client.org_id} clientId={client.id} managerId={manager!.id} managerName={`${manager!.first_name} ${manager!.last_name}`} />
        ) : null}
      </div>
    </div>
  );
}
