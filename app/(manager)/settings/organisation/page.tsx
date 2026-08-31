import { createClient } from "@/lib/supabase/server";
import { OrganisationProfileForm } from "./OrganisationProfileForm";

// Source: PRD section 4.10 (Organisation — Profile, default view)
export default async function OrganisationSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: managerRow } = await supabase.from("users").select("org_id").eq("id", user!.id).single();

  const { data: org } = await supabase
    .from("organisations")
    .select("id, name, cqc_number, email, phone, address, logo_url")
    .eq("id", managerRow!.org_id)
    .single();

  if (!org) return null;

  return <OrganisationProfileForm org={org} />;
}
