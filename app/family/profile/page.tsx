import { createClient } from "@/lib/supabase/server";
import { getLinkedClientId, UNLINKED_ACCOUNT_MESSAGE } from "@/lib/family/getLinkedClient";
import { Header } from "@/components/layout/Header";
import { ClientAvatar } from "@/components/clients/ClientAvatar";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ChangePasswordButton } from "./ChangePasswordButton";

// Source: Gokul, direct request 2026-09-02 — the Profile tab in the NOK
// bottom nav previously went nowhere. Same "basic information" scope as
// the carer profile page (Session 13), plus the relationship-to-client
// field and a password-reset trigger this role doesn't otherwise have
// any way to reach.
export default async function FamilyProfilePage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: user } = await supabase.from("users").select("first_name, last_name, email").eq("id", authUser!.id).single();
  const clientId = await getLinkedClientId(supabase, authUser!.id);

  if (!user) return null;

  let relationship: string | null = null;
  let clientName: string | null = null;
  if (clientId) {
    const { data: nokLink } = await supabase
      .from("family_nok")
      .select("relationship")
      .eq("user_id", authUser!.id)
      .eq("client_id", clientId)
      .maybeSingle();
    relationship = nokLink?.relationship ?? null;
    const { data: client } = await supabase.from("clients").select("first_name, last_name").eq("id", clientId).maybeSingle();
    if (client) clientName = `${client.first_name} ${client.last_name}`;
  }

  return (
    <div>
      <Header title="Profile" />

      <div className="px-4 py-4">
        <div className="flex flex-col items-center gap-2 py-4">
          <ClientAvatar firstName={user.first_name} lastName={user.last_name} size="lg" />
          <p className="text-[16px] font-bold text-text-primary">
            {user.first_name} {user.last_name}
          </p>
          {clientName ? (
            <p className="text-body text-text-secondary">
              {relationship ? `${relationship} of ${clientName}` : `Family member of ${clientName}`}
            </p>
          ) : (
            <p className="text-body text-text-secondary">{UNLINKED_ACCOUNT_MESSAGE}</p>
          )}
        </div>

        <div className="rounded-card border border-border-default bg-card-bg p-3.5">
          <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">Basic information</h2>
          <div className="flex flex-col divide-y divide-border-default">
            <div className="py-2.5 first:pt-0">
              <p className="text-label text-text-secondary">Email</p>
              <p className="text-body text-text-primary">{user.email}</p>
            </div>
            {relationship ? (
              <div className="py-2.5 last:pb-0">
                <p className="text-label text-text-secondary">Relationship</p>
                <p className="text-body text-text-primary">{relationship}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3.5">
          <ChangePasswordButton email={user.email} />
        </div>

        <SignOutButton className="mt-3 w-full rounded-btn border border-border-default bg-card-bg py-[10px] text-[13px] font-medium text-danger-red" />
      </div>
    </div>
  );
}
