import { createClient } from "@/lib/supabase/server";
import { CareTypesForm } from "./CareTypesForm";

// Source: PRD section 4.10 (Organisation — Care types)
export default async function CareTypesSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: managerRow } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
  const { data: org } = await supabase.from("organisations").select("id, care_types").eq("id", managerRow!.org_id).single();

  if (!org) return null;

  return <CareTypesForm orgId={org.id} initialCareTypes={org.care_types} />;
}
