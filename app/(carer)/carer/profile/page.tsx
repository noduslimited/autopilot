import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { ClientAvatar } from "@/components/clients/ClientAvatar";
import { SignOutButton } from "@/components/auth/SignOutButton";

// Source: Gokul, direct request (2026-08-31, ahead of Session 13) —
// `/carer/profile` has been referenced by BottomNav since Session 3 with
// nothing behind it. Basic information only, per the request — not a
// compliance dashboard (DBS/training detail is manager-facing territory
// per the Roles & Permissions Matrix).
const ROLE_LABELS: Record<string, string> = {
  carer: "Carer",
  senior_carer: "Senior Carer",
  manager: "Manager",
};

export default async function CarerProfilePage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: user } = await supabase.from("users").select("first_name, last_name, email, phone").eq("id", authUser!.id).single();
  const { data: staff } = await supabase.from("staff").select("staff_ref, role, start_date").eq("id", authUser!.id).maybeSingle();

  if (!user) return null;

  return (
    <div>
      <Header title="Profile" />

      <div className="px-4 py-4">
        <div className="flex flex-col items-center gap-2 py-4">
          <ClientAvatar firstName={user.first_name} lastName={user.last_name} size="lg" />
          <p className="text-[16px] font-bold text-text-primary">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-body text-text-secondary">{staff ? (ROLE_LABELS[staff.role] ?? staff.role) : "Carer"}</p>
        </div>

        <div className="rounded-card border border-border-default bg-card-bg p-3.5">
          <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">Basic information</h2>
          <div className="flex flex-col divide-y divide-border-default">
            <div className="py-2.5 first:pt-0">
              <p className="text-label text-text-secondary">Email</p>
              <p className="text-body text-text-primary">{user.email}</p>
            </div>
            {user.phone ? (
              <div className="py-2.5">
                <p className="text-label text-text-secondary">Phone</p>
                <p className="text-body text-text-primary">{user.phone}</p>
              </div>
            ) : null}
            {staff?.staff_ref ? (
              <div className="py-2.5">
                <p className="text-label text-text-secondary">Staff ID</p>
                <p className="font-mono text-body font-medium text-nhs-blue">{staff.staff_ref}</p>
              </div>
            ) : null}
            {staff?.start_date ? (
              <div className="py-2.5 last:pb-0">
                <p className="text-label text-text-secondary">Start date</p>
                <p className="text-body text-text-primary">
                  {new Date(staff.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <SignOutButton className="mt-4 w-full rounded-btn border border-border-default bg-card-bg py-[10px] text-[13px] font-medium text-danger-red" />
      </div>
    </div>
  );
}
