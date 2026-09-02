import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLinkedClientId } from "@/lib/family/getLinkedClient";
import { getWellbeingSummary } from "@/lib/ai/wellbeingSummary";
import { UnlinkedAccountNotice } from "@/components/family/UnlinkedAccountNotice";
import { Header } from "@/components/layout/Header";
import { ClientAvatar } from "@/components/clients/ClientAvatar";
import { CriticalBadges, type CriticalBadgesClient } from "@/components/clients/CriticalBadges";
import { Badge } from "@/components/ui/Badge";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";

// Source: Gokul, direct request 2026-09-02. The NOK relationship field
// describes the family member's relationship TO the client ("Jennifer is
// Margaret's daughter"), not the other way round — the subtitle was
// showing "Your daughter" to Jennifer, which reads as if Margaret is
// Jennifer's daughter. Correctly inverted per the requested mapping.
// clients has no gender column anywhere in the schema, so "use client
// gender if known" always falls through to the stated neutral fallback
// here — not fabricated, consistent with this project's standing rule
// against inventing data with no real source.
const RELATIONSHIP_LABELS: Record<string, string> = {
  Son: "Your parent",
  Daughter: "Your parent",
  Spouse: "Your spouse",
  Partner: "Your partner",
  Sibling: "Your sibling",
};

function relationshipSubtitle(relationship: string | null | undefined, careTypeLabel: string): string {
  const label = relationship ? RELATIONSHIP_LABELS[relationship] : undefined;
  return label ? `${label} · ${careTypeLabel}` : careTypeLabel;
}

// Source: PRD section 6.3 (Overview)

const CARE_TYPE_LABELS: Record<string, string> = {
  domiciliary: "Domiciliary care",
  residential: "Residential care",
  supported_living: "Supported living",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function startOfWeekUTC(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff));
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function visitTimeName(iso: string): string {
  const hour = new Date(iso).getUTCHours();
  if (hour < 12) return "Morning visit";
  if (hour < 17) return "Afternoon visit";
  return "Evening visit";
}

function timeRange(start: string, end: string): string {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

const STATUS_BADGE: Record<string, { variant: "completed" | "inProgress" | "notStarted"; label: string }> = {
  completed: { variant: "completed", label: "Completed" },
  in_progress: { variant: "inProgress", label: "In progress" },
  scheduled: { variant: "notStarted", label: "Scheduled" },
};

const WELLBEING_STYLES: Record<string, string> = {
  good: "bg-success-green-light text-success-green-text",
  fair: "bg-amber-light text-amber-text",
  poor: "bg-[#FDECEA] text-danger-red",
};

export default async function FamilyOverviewPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: familyUser } = await supabase.from("users").select("id, org_id").eq("id", authUser!.id).single();
  const clientId = await getLinkedClientId(supabase, authUser!.id);
  if (!clientId) return <UnlinkedAccountNotice />;

  const { data: nokLink } = await supabase.from("family_nok").select("relationship").eq("user_id", authUser!.id).eq("client_id", clientId).single();

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name, care_type, allergies, dietary_requirements, dnacpr, risk_level, assigned_carer_id, nok_messaging_enabled")
    .eq("id", clientId)
    .single();
  if (!client) return <UnlinkedAccountNotice />;

  const { data: org } = await supabase.from("organisations").select("phone, email").eq("id", familyUser!.org_id).maybeSingle();

  const todayStart = startOfTodayUTC();
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const { data: todayVisits } = await supabase
    .from("visits")
    .select("id, scheduled_start, scheduled_end, status, staff:assigned_carer_id(first_name, last_name)")
    .eq("client_id", clientId)
    .gte("scheduled_start", todayStart.toISOString())
    .lt("scheduled_start", todayEnd.toISOString())
    .order("scheduled_start", { ascending: true });

  const weekStart = startOfWeekUTC(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 5);
  const { data: weekVisits } = await supabase
    .from("visits")
    .select("scheduled_start, wellbeing_rating")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .gte("scheduled_start", weekStart.toISOString())
    .lt("scheduled_start", weekEnd.toISOString());

  const ratingByWeekday: Record<number, string | null> = {};
  for (const visit of weekVisits ?? []) {
    const weekday = new Date(visit.scheduled_start).getUTCDay(); // 1=Mon..5=Fri
    if (weekday >= 1 && weekday <= 5 && visit.wellbeing_rating) ratingByWeekday[weekday] = visit.wellbeing_rating;
  }

  const wellbeingSummary = await getWellbeingSummary(supabase, admin, familyUser!.org_id, clientId, client.first_name);

  const { data: latestVisit } = await supabase
    .from("visits")
    .select("visit_notes, check_out_time, staff:assigned_carer_id(first_name, last_name)")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .not("visit_notes", "is", null)
    .order("check_out_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestCarer = latestVisit ? (Array.isArray(latestVisit.staff) ? latestVisit.staff[0] : latestVisit.staff) : null;

  return (
    <div>
      <Header
        title={`${client.first_name} ${client.last_name}`}
        subtitle={relationshipSubtitle(nokLink?.relationship, CARE_TYPE_LABELS[client.care_type] ?? client.care_type)}
        right={
          <>
            <NotificationBell userId={authUser!.id} align="right" />
            <ClientAvatar firstName={client.first_name} lastName={client.last_name} size="md" />
          </>
        }
      >
        <CriticalBadges client={client as CriticalBadgesClient} linkHref="/family/care-plan" />
      </Header>

      <div className="px-4 py-4">
        <div className="rounded-card border border-border-default bg-card-bg p-3.5">
          <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">Today&apos;s visits</h2>
          {(todayVisits ?? []).length === 0 ? (
            <p className="text-body text-text-secondary">No visits scheduled today.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border-default">
              {(todayVisits ?? []).map((visit) => {
                const carer = Array.isArray(visit.staff) ? visit.staff[0] : visit.staff;
                const status = STATUS_BADGE[visit.status] ?? STATUS_BADGE.scheduled;
                return (
                  <div key={visit.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between">
                      <p className="text-body font-medium text-text-primary">{visitTimeName(visit.scheduled_start)}</p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-secondary text-text-secondary">
                      {timeRange(visit.scheduled_start, visit.scheduled_end)}
                      {carer ? ` · ${carer.first_name} ${carer.last_name}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3.5 rounded-card border border-border-default bg-card-bg p-3.5">
          <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">Wellbeing this week</h2>
          <div className="grid grid-cols-5 gap-1.5">
            {WEEKDAYS.map((label, index) => {
              const rating = ratingByWeekday[index + 1];
              return (
                <div key={label} className={["rounded-input py-2.5 text-center", rating ? WELLBEING_STYLES[rating] : "bg-page-bg text-text-secondary"].join(" ")}>
                  <p className="text-tiny">{label}</p>
                  <p className="mt-0.5 text-[12px] font-medium capitalize">{rating ?? "—"}</p>
                </div>
              );
            })}
          </div>
          {wellbeingSummary ? <p className="mt-3 text-body italic text-text-secondary">{wellbeingSummary}</p> : null}
        </div>

        {latestVisit ? (
          <div className="mt-3.5 rounded-card border border-border-default bg-card-bg p-3.5">
            <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">Latest carer note</h2>
            <div className="flex items-center gap-2">
              {latestCarer ? <ClientAvatar firstName={latestCarer.first_name} lastName={latestCarer.last_name} size="sm" /> : null}
              <div>
                <p className="text-body font-medium text-text-primary">{latestCarer ? `${latestCarer.first_name} ${latestCarer.last_name}` : "Carer"}</p>
                <p className="text-tiny text-text-secondary">{latestVisit.check_out_time ? new Date(latestVisit.check_out_time).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</p>
              </div>
            </div>
            <p className="mt-2 text-body text-text-primary">{latestVisit.visit_notes}</p>
          </div>
        ) : null}

        {client.nok_messaging_enabled ? (
          <Link
            href="/family/messages"
            className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-btn bg-nhs-blue py-[10px] text-[14px] font-medium text-white"
          >
            <i className="ti ti-message text-[16px]" aria-hidden="true" />
            Message the care team
          </Link>
        ) : null}

        {org?.phone ? (
          <a
            href={`tel:${org.phone}`}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-btn border border-border-default bg-card-bg py-[10px] text-[14px] font-medium text-text-primary"
          >
            <i className="ti ti-phone text-[16px]" aria-hidden="true" />
            Call the care team
          </a>
        ) : null}

        {org?.email ? (
          <a
            href={`mailto:${org.email}?subject=${encodeURIComponent(`Enquiry regarding ${client.first_name}'s care`)}`}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-btn border border-border-default bg-card-bg py-[10px] text-[14px] font-medium text-text-primary"
          >
            <i className="ti ti-mail text-[16px]" aria-hidden="true" />
            Email the care team
          </a>
        ) : null}

        <SignOutButton className="mt-3 w-full rounded-btn border border-border-default bg-card-bg py-[10px] text-[13px] font-medium text-danger-red" />
      </div>
    </div>
  );
}
