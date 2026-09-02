import { createClient } from "@/lib/supabase/server";
import { getLinkedClientId } from "@/lib/family/getLinkedClient";
import { UnlinkedAccountNotice } from "@/components/family/UnlinkedAccountNotice";
import { Header } from "@/components/layout/Header";
import { FamilyMessagesClient } from "./FamilyMessagesClient";

// Source: PRD section 6.6 (Messages)
export default async function FamilyMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: familyUser } = await supabase.from("users").select("id, org_id, first_name, last_name").eq("id", authUser!.id).single();
  const clientId = await getLinkedClientId(supabase, authUser!.id);
  if (!clientId) return <UnlinkedAccountNotice />;

  // Defense in depth beyond hiding the nav entry point (BottomNav) and
  // the Overview "Message the care team" button — a direct visit to this
  // URL while messaging is disabled for the client should still be
  // blocked, not just unreachable via the normal UI.
  const { data: messagingClient } = await supabase.from("clients").select("nok_messaging_enabled").eq("id", clientId).maybeSingle();
  if (messagingClient && !messagingClient.nok_messaging_enabled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <i className="ti ti-message-off text-[32px] text-text-secondary" aria-hidden="true" />
        <p className="mt-3 text-body text-text-secondary">
          Messaging isn&apos;t available for this account. Please contact the care team directly.
        </p>
      </div>
    );
  }

  const [{ data: messages }, { data: org }, { data: lastManagerMessage }] = await Promise.all([
    supabase.from("messages").select("id, sender_id, sender_role, sender_name, body, created_at").eq("client_id", clientId).order("created_at", { ascending: true }),
    supabase.from("organisations").select("name").eq("id", familyUser!.org_id).single(),
    supabase.from("messages").select("sender_name").eq("client_id", clientId).eq("sender_role", "manager").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  let careTeamContactName = lastManagerMessage?.sender_name ?? null;
  if (!careTeamContactName) {
    const { data: earliestManager } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("org_id", familyUser!.org_id)
      .eq("role", "manager")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    careTeamContactName = earliestManager ? `${earliestManager.first_name} ${earliestManager.last_name}` : "Care manager";
  }

  // Mark unread messages as read now that the family member has opened
  // the thread.
  await supabase.from("messages").update({ read_by_family: true }).eq("client_id", clientId).eq("read_by_family", false);

  return (
    <div>
      <Header title="Messages" backHref="/family/overview">
        <div className="mt-1 flex items-center gap-2.5 rounded-input bg-black/15 p-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-nhs-light-blue text-[12px] font-medium text-nhs-dark-blue">
            {org?.name?.[0] ?? "C"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-medium text-white">{org?.name ?? "Care provider"}</p>
            <p className="truncate text-tiny text-white/70">{careTeamContactName} · Care manager</p>
          </div>
          <div className="flex items-center gap-1 text-tiny text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-nhs-green" />
            Active today
          </div>
        </div>
      </Header>

      <FamilyMessagesClient
        orgId={familyUser!.org_id}
        clientId={clientId}
        senderId={familyUser!.id}
        senderName={`${familyUser!.first_name} ${familyUser!.last_name}`}
        initialMessages={messages ?? []}
      />
    </div>
  );
}
