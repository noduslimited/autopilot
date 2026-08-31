import { createClient } from "@/lib/supabase/server";
import { MessagesTabClient } from "./MessagesTabClient";

// Source: PRD section 6.6 ("Manager replies from within the client
// profile (Messages tab)") — see CLAUDE.md Session 10 log for why this
// tab was added this session rather than in an earlier one.
export async function MessagesTab({ orgId, clientId, managerId, managerName }: { orgId: string; clientId: string; managerId: string; managerName: string }) {
  const supabase = await createClient();
  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, sender_role, sender_name, body, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  await supabase.from("messages").update({ read_by_manager: true }).eq("client_id", clientId).eq("read_by_manager", false);

  return <MessagesTabClient orgId={orgId} clientId={clientId} managerId={managerId} managerName={managerName} initialMessages={messages ?? []} />;
}
