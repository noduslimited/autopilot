import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { OverviewTab } from "./OverviewTab";
import { TrainingTab } from "./TrainingTab";
import { ScheduleTab } from "./ScheduleTab";
import { DocumentsTab } from "./DocumentsTab";

// Source: PRD section 4.5 (Staff Profile)
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "training", label: "Training" },
  { key: "schedule", label: "Schedule" },
  { key: "documents", label: "Documents" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const ROLE_LABELS: Record<string, string> = {
  carer: "Carer",
  senior_carer: "Senior carer",
  manager: "Manager",
};

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

export default async function StaffProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ staffId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { staffId } = await params;
  const { tab } = await searchParams;
  const activeTab: TabKey = (TABS.find((t) => t.key === tab)?.key ?? "overview") as TabKey;

  const supabase = await createClient();
  const todayISO = toISODate(new Date());

  const [{ data: staff }, { data: todayShift }] = await Promise.all([
    supabase
      .from("staff")
      .select(
        "id, org_id, staff_ref, role, dbs_number, dbs_expiry, start_date, emergency_contact_name, emergency_contact_phone, users(first_name, last_name, email, phone)",
      )
      .eq("id", staffId)
      .single(),
    supabase.from("rota_shifts").select("shift_type").eq("staff_id", staffId).eq("shift_date", todayISO).maybeSingle(),
  ]);

  if (!staff) {
    return (
      <div className="p-5">
        <p className="text-body text-text-secondary">This page doesn&apos;t exist.</p>
        <Link href="/staff" className="text-body text-nhs-blue">
          Go back
        </Link>
      </div>
    );
  }

  const user = Array.isArray(staff.users) ? staff.users[0] : staff.users;
  const name = user ? `${user.first_name} ${user.last_name}` : "Unknown";

  const shiftType = todayShift?.shift_type;
  const statusBadge: { label: string; variant: BadgeVariant } =
    shiftType === "sick_leave"
      ? { label: "Sick leave", variant: "atRisk" }
      : shiftType === "annual_leave"
        ? { label: "On leave", variant: "pending" }
        : shiftType === "weekday" || shiftType === "weekend"
          ? { label: "On shift today", variant: "onShift" }
          : { label: "Off today", variant: "notStarted" };

  let dbsBadge: { label: string; variant: BadgeVariant };
  if (!staff.dbs_expiry) {
    dbsBadge = { label: "DBS expired", variant: "atRisk" };
  } else {
    const days = Math.round((new Date(staff.dbs_expiry).getTime() - new Date(todayISO).getTime()) / 86400000);
    dbsBadge =
      days < 0
        ? { label: "DBS expired", variant: "atRisk" }
        : days <= 30
          ? { label: "DBS expiring soon", variant: "dueSoon" }
          : { label: "DBS valid", variant: "valid" };
  }

  return (
    <div className="p-5">
      <Link href="/staff" className="text-secondary text-nhs-blue">
        ← Back to staff
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <div className="flex items-center gap-3">
          <Avatar initials={initialsOf(name)} variant={staff.role === "manager" ? "manager" : "carer"} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-section-heading text-text-primary">{name}</h1>
              <span className="font-mono text-body font-medium text-nhs-blue">{staff.staff_ref}</span>
            </div>
            <p className="mt-1 text-secondary text-text-secondary">
              {ROLE_LABELS[staff.role] ?? staff.role}
              {staff.start_date ? ` · Started ${new Date(staff.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              <Badge variant={dbsBadge.variant}>{dbsBadge.label}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-border-default">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/staff/${staff.id}?tab=${t.key}`}
            className={[
              "shrink-0 border-b-2 px-3 py-2.5 text-body font-medium",
              activeTab === t.key ? "border-nhs-blue text-nhs-blue" : "border-transparent text-text-secondary",
            ].join(" ")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === "overview" ? (
          <OverviewTab
            staffId={staff.id}
            email={user?.email ?? ""}
            phone={user?.phone ?? null}
            dbsNumber={staff.dbs_number}
            dbsExpiry={staff.dbs_expiry}
            startDate={staff.start_date}
            emergencyContactName={staff.emergency_contact_name}
            emergencyContactPhone={staff.emergency_contact_phone}
          />
        ) : null}
        {activeTab === "training" ? <TrainingTab staffId={staff.id} orgId={staff.org_id} /> : null}
        {activeTab === "schedule" ? <ScheduleTab staffId={staff.id} /> : null}
        {activeTab === "documents" ? <DocumentsTab staffId={staff.id} orgId={staff.org_id} /> : null}
      </div>
    </div>
  );
}
