import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPreVisitInsight } from "@/lib/ai/preVisitInsight";
import { Header } from "@/components/layout/Header";
import { ClientAvatar } from "@/components/clients/ClientAvatar";
import { CriticalBadges, type CriticalBadgesClient } from "@/components/clients/CriticalBadges";
import { AiInsightPanel } from "@/components/ai/AiInsightPanel";
import { VisitDetailClient, type VisitTaskItem, type MedicationItem, type EmarLogEntry } from "./VisitDetailClient";

// Source: PRD section 5.3 (Visit Detail)

function timeRange(start: string, end: string): string {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default async function VisitDetailPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: carer } = await supabase.from("users").select("id, org_id").eq("id", authUser!.id).single();

  // RLS (carers_own_visits) scopes this to the calling carer's own visit.
  const { data: visit } = await supabase
    .from("visits")
    .select(
      "id, scheduled_start, scheduled_end, status, visit_notes, client:clients(id, first_name, last_name, address, allergies, dietary_requirements, dnacpr, risk_level, assigned_carer_id)",
    )
    .eq("id", visitId)
    .maybeSingle();

  if (!visit) notFound();

  const rawClient = Array.isArray(visit.client) ? visit.client[0] : visit.client;
  // Belt-and-braces on top of the RLS fix (20260915090000) for a carer
  // covering a reassigned visit whose client isn't their own — a null
  // embedded client here would otherwise crash the whole page rendering
  // client.first_name below.
  if (!rawClient) notFound();
  const client = rawClient as CriticalBadgesClient & {
    id: string;
    first_name: string;
    last_name: string;
    address: string;
  };

  const [{ data: taskRows }, { data: medicationRows }, { data: emarRows }, insight] = await Promise.all([
    supabase.from("visit_tasks").select("id, task_type, task_label, task_order, requires_emar, completed").eq("visit_id", visitId).order("task_order", { ascending: true }),
    supabase.from("medications").select("id, medication_name, dose").eq("client_id", client.id).eq("active", true),
    supabase.from("emar_records").select("id, medication_id, administered, reason_not_administered, reason_detail").eq("visit_id", visitId),
    getPreVisitInsight(supabase, admin, carer!.org_id, client.id),
  ]);

  const tasks: VisitTaskItem[] = (taskRows ?? []) as VisitTaskItem[];
  const medications: MedicationItem[] = (medicationRows ?? []) as MedicationItem[];
  const existingEmarLog: Record<string, EmarLogEntry> = {};
  for (const row of emarRows ?? []) {
    existingEmarLog[row.medication_id] = {
      id: row.id,
      administered: row.administered,
      reasonNotAdministered: row.reason_not_administered,
      reasonDetail: row.reason_detail,
    };
  }

  return (
    <div>
      <Header
        title="Visit detail"
        backHref="/my-day"
        right={<ClientAvatar firstName={client.first_name} lastName={client.last_name} size="md" />}
      >
        <div>
          <p className="text-[16px] font-bold text-white">
            {client.first_name} {client.last_name}
          </p>
          <p className="text-secondary text-white/70">
            {client.address} · {timeRange(visit.scheduled_start, visit.scheduled_end)}
            {visit.status === "in_progress" ? " · In progress" : ""}
          </p>
          <CriticalBadges client={client} className="mt-2" />
        </div>
      </Header>

      {insight ? (
        <div className="px-4 pt-4">
          <AiInsightPanel italic>{insight}</AiInsightPanel>
        </div>
      ) : null}

      <VisitDetailClient
        visitId={visit.id}
        clientId={client.id}
        carerId={carer!.id}
        orgId={carer!.org_id}
        clientFirstName={client.first_name}
        initialStatus={visit.status}
        initialTasks={tasks}
        medications={medications}
        initialEmarLog={existingEmarLog}
        initialNotes={visit.visit_notes ?? ""}
      />
    </div>
  );
}
