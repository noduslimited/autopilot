import { createClient } from "@/lib/supabase/server";
import { getLinkedClientId, UNLINKED_ACCOUNT_MESSAGE } from "@/lib/family/getLinkedClient";
import { Header } from "@/components/layout/Header";
import { ClientAvatar } from "@/components/clients/ClientAvatar";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ChangePasswordButton } from "@/components/auth/ChangePasswordButton";

// Source: Gokul, direct request 2026-09-02 — the Profile tab in the NOK
// bottom nav previously went nowhere. Same "basic information" scope as
// the carer profile page (Session 13), plus the relationship-to-client
// field and a password-reset trigger this role doesn't otherwise have
// any way to reach. Layout and relationship-text fixed 2026-09-06 (item
// 4 of that day's request) — see relationshipLine() below.

// The relationship field describes the family member's relationship TO
// the client ("Jennifer is Margaret's daughter") — unlike the Overview
// page's own "Your parent"-style inversion (built to correct a genuine
// backwards-reading bug there, see that page's own header comment), this
// page states it directly and doesn't need inverting: "Daughter of
// Margaret" is already correct as written. Uses the client's first name
// only, per Gokul's explicit spec, and — matching the neutral-fallback
// precedent already established on Overview — "Other" gets no
// relationship label rather than an invented one.
function relationshipLine(relationship: string | null, clientFirstName: string): string {
  if (!relationship || relationship === "Other") return `Family member of ${clientFirstName}`;
  return `${relationship} of ${clientFirstName}`;
}

export default async function FamilyProfilePage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: user } = await supabase.from("users").select("first_name, last_name, email").eq("id", authUser!.id).single();
  const clientId = await getLinkedClientId(supabase, authUser!.id);

  if (!user) return null;

  let relationship: string | null = null;
  let clientFirstName: string | null = null;
  if (clientId) {
    const { data: nokLink } = await supabase
      .from("family_nok")
      .select("relationship")
      .eq("user_id", authUser!.id)
      .eq("client_id", clientId)
      .maybeSingle();
    relationship = nokLink?.relationship ?? null;
    const { data: client } = await supabase.from("clients").select("first_name").eq("id", clientId).maybeSingle();
    if (client) clientFirstName = client.first_name;
  }

  return (
    <div className="box-border w-full min-w-0 max-w-full overflow-x-hidden">
      <Header title="Profile" />

      <div className="box-border flex w-full min-w-0 max-w-full flex-col px-4 py-4">
        <div className="flex w-full flex-col items-center gap-2 py-4">
          <ClientAvatar firstName={user.first_name} lastName={user.last_name} size="lg" />
          <p className="text-center text-[16px] font-bold text-text-primary">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-center text-body text-text-secondary">
            {clientFirstName ? relationshipLine(relationship, clientFirstName) : UNLINKED_ACCOUNT_MESSAGE}
          </p>
        </div>

        <div className="box-border w-full max-w-full rounded-card border border-border-default bg-card-bg p-4">
          <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">Basic information</h2>
          <div className="flex flex-col divide-y divide-border-default">
            <div className="py-2.5 first:pt-0">
              <p className="text-label text-text-secondary">Email</p>
              <p className="break-words text-body text-text-primary">{user.email}</p>
            </div>
            {relationship ? (
              <div className="py-2.5 last:pb-0">
                <p className="text-label text-text-secondary">Relationship</p>
                <p className="text-body text-text-primary">{relationship}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex w-full flex-col gap-2.5 pb-2">
          <ChangePasswordButton email={user.email} />
          <SignOutButton className="w-full rounded-btn border border-border-default bg-card-bg py-[10px] text-[13px] font-medium text-danger-red" />
        </div>
      </div>
    </div>
  );
}
