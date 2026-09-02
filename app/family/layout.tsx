import { createClient } from "@/lib/supabase/server";
import { getLinkedClientId } from "@/lib/family/getLinkedClient";
import { FamilyShell } from "@/components/layout/FamilyShell";

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let messagingEnabled = true;
  if (user) {
    const clientId = await getLinkedClientId(supabase, user.id);
    if (clientId) {
      const { data: client } = await supabase.from("clients").select("nok_messaging_enabled").eq("id", clientId).maybeSingle();
      if (client) messagingEnabled = client.nok_messaging_enabled;
    }
  }

  return <FamilyShell messagingEnabled={messagingEnabled}>{children}</FamilyShell>;
}
