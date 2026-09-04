import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Header } from "@/components/layout/Header";
import { ClientAvatar } from "@/components/clients/ClientAvatar";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ChangePasswordButton } from "@/components/auth/ChangePasswordButton";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

// Source: Gokul, direct request 2026-09-04 — carer mobile portal item 2
// ("expand content" — was previously deliberately basic-only, per the
// original 2026-08-31 request that first built this page; superseded by
// this explicit follow-up asking for the fuller compliance/org/account
// sections below).
const ROLE_LABELS: Record<string, string> = {
  carer: "Carer",
  senior_carer: "Senior Carer",
  manager: "Manager",
};

const MODULE_LABELS: Record<string, string> = {
  manual_handling: "Manual handling",
  medication_awareness: "Medication awareness",
  fire_safety: "Fire safety",
  safeguarding_adults: "Safeguarding adults",
  first_aid: "First aid",
  other: "Other",
};

// Same status logic as the manager-side Staff Profile Training tab
// (TrainingTab.tsx) — reused, not reinvented, so a module reads
// identically whichever side is looking at it.
function trainingStatusBadge(expiryDate: string, todayISO: string): { label: string; variant: BadgeVariant } {
  const days = Math.round((new Date(expiryDate).getTime() - new Date(todayISO).getTime()) / 86400000);
  if (days < 0) return { label: "Overdue", variant: "atRisk" };
  if (days <= 60) return { label: "Due soon", variant: "dueSoon" };
  return { label: "Valid", variant: "valid" };
}

function maskDbsNumber(dbsNumber: string): string {
  const digitsOnly = dbsNumber.replace(/\D/g, "");
  const lastFour = digitsOnly.slice(-4) || dbsNumber.slice(-4);
  return `••••••${lastFour}`;
}

export default async function CarerProfilePage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: user } = await supabase
    .from("users")
    .select("first_name, last_name, email, phone, org_id")
    .eq("id", authUser!.id)
    .single();

  if (!user) return null;

  // The manager-name lookup can't go through the RLS-scoped client: a
  // carer's `users` SELECT policy only ever allows reading their own row
  // (see supabase/migrations/20260828121100_rls_policies.sql) — there is
  // no policy letting a carer read a manager's row directly, so this
  // query would silently return null under RLS (caught live: the
  // Organisation card's Manager row simply never rendered). Uses the
  // admin client instead, scoped explicitly to the carer's own org_id and
  // reading only a name — the same narrow, read-only cross-user lookup
  // pattern already used elsewhere in this app (e.g. invite-nok's
  // resolve-the-inviter reads).
  const admin = createAdminClient();

  const [{ data: staff }, { data: org }, { data: manager }, { data: trainingRecords }] = await Promise.all([
    supabase
      .from("staff")
      .select("staff_ref, role, start_date, emergency_contact_name, emergency_contact_phone, dbs_number, dbs_expiry")
      .eq("id", authUser!.id)
      .maybeSingle(),
    supabase.from("organisations").select("name, address, phone, email").eq("id", user.org_id).single(),
    admin.from("users").select("first_name, last_name").eq("org_id", user.org_id).eq("role", "manager").order("created_at").limit(1).maybeSingle(),
    supabase
      .from("training_records")
      .select("id, module_name, module_label, completed_date, expiry_date")
      .eq("staff_id", authUser!.id)
      .order("completed_date", { ascending: false }),
  ]);

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <Header title="Profile" />

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <ClientAvatar firstName={user.first_name} lastName={user.last_name} size="lg" />
          <p className="text-[16px] font-bold text-text-primary">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-body text-text-secondary">{staff ? (ROLE_LABELS[staff.role] ?? staff.role) : "Carer"}</p>
        </div>

        <div className="rounded-card border border-border-default bg-card-bg p-3.5">
          <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">Personal details</h2>
          <div className="flex flex-col divide-y divide-border-default">
            <Row label="Full name" value={`${user.first_name} ${user.last_name}`} first />
            <Row label="Email" value={user.email} />
            {user.phone ? <Row label="Phone" value={user.phone} /> : null}
            {staff?.role ? <Row label="Role" value={ROLE_LABELS[staff.role] ?? staff.role} /> : null}
            {staff?.start_date ? (
              <Row label="Start date" value={new Date(staff.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} />
            ) : null}
            {staff?.emergency_contact_name ? <Row label="Emergency contact" value={staff.emergency_contact_name} /> : null}
            {staff?.emergency_contact_phone ? <Row label="Emergency contact phone" value={staff.emergency_contact_phone} last /> : null}
          </div>
        </div>

        {org ? (
          <div className="rounded-card border border-border-default bg-card-bg p-3.5">
            <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">Organisation</h2>
            <div className="flex flex-col divide-y divide-border-default">
              <Row label="Organisation" value={org.name} first />
              {org.address ? <Row label="Address" value={org.address} /> : null}
              {org.phone ? <Row label="Phone" value={org.phone} /> : null}
              <Row label="Email" value={org.email} />
              {manager ? <Row label="Manager" value={`${manager.first_name} ${manager.last_name}`} last /> : null}
            </div>
          </div>
        ) : null}

        {staff?.dbs_number || staff?.dbs_expiry || (trainingRecords && trainingRecords.length > 0) ? (
          <div className="rounded-card border border-border-default bg-card-bg p-3.5">
            <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">DBS and compliance</h2>
            {staff?.dbs_number || staff?.dbs_expiry ? (
              <div className="flex flex-col divide-y divide-border-default">
                {staff.dbs_number ? <Row label="DBS number" value={maskDbsNumber(staff.dbs_number)} first /> : null}
                {staff.dbs_expiry ? (
                  <Row
                    label="DBS expiry"
                    value={new Date(staff.dbs_expiry).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    last={!trainingRecords || trainingRecords.length === 0}
                  />
                ) : null}
              </div>
            ) : null}

            {trainingRecords && trainingRecords.length > 0 ? (
              <div className={staff?.dbs_number || staff?.dbs_expiry ? "mt-3 border-t border-border-default pt-3" : ""}>
                <p className="mb-2 text-secondary text-text-secondary">Training modules</p>
                <div className="space-y-2">
                  {trainingRecords.map((record) => {
                    const badge = trainingStatusBadge(record.expiry_date, todayISO);
                    return (
                      <div key={record.id} className="flex items-center justify-between gap-2 rounded-input bg-page-bg px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-body text-text-primary">
                            {record.module_name === "other" ? record.module_label : (MODULE_LABELS[record.module_name] ?? record.module_name)}
                          </p>
                          <p className="text-secondary text-text-secondary">
                            Completed {new Date(record.completed_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · Expires{" "}
                            {new Date(record.expiry_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <ChangePasswordButton email={user.email} />
          <SignOutButton className="w-full rounded-btn border border-border-default bg-card-bg py-[10px] text-[13px] font-medium text-danger-red" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, first = false, last = false }: { label: string; value: string; first?: boolean; last?: boolean }) {
  return (
    <div className={["py-2.5", first ? "pt-0" : "", last ? "pb-0" : ""].join(" ")}>
      <p className="text-label text-text-secondary">{label}</p>
      <p className="text-body text-text-primary">{value}</p>
    </div>
  );
}
