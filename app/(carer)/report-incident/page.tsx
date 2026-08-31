import { createClient } from "@/lib/supabase/server";
import { ReportIncidentClient, type IncidentClientOption } from "./ReportIncidentClient";

// Source: PRD section 5.5 (Report Incident)

export default async function ReportIncidentPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: carer } = await supabase.from("users").select("id, org_id").eq("id", authUser!.id).single();

  const [{ data: clientRows }, { data: activeVisit }] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name").eq("assigned_carer_id", carer!.id).eq("status", "active").order("first_name"),
    supabase.from("visits").select("id, client_id").eq("assigned_carer_id", carer!.id).eq("status", "in_progress").maybeSingle(),
  ]);

  const clients: IncidentClientOption[] = clientRows ?? [];

  return (
    <ReportIncidentClient
      clients={clients}
      currentVisit={activeVisit ? { visitId: activeVisit.id, clientId: activeVisit.client_id } : null}
    />
  );
}
