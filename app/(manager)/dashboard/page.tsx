import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricCards } from "./MetricCards";
import { VisitStatusPanel } from "./VisitStatusPanel";
import { AiSummarySection } from "./AiSummarySection";
import { AlertBanner } from "./AlertBanner";
import { ComplianceSnapshot } from "./ComplianceSnapshot";
import { AnalyticsSection, type StaffAnalyticsRow } from "./AnalyticsSection";

// Source: PRD section 4.2 (Dashboard)

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfWeekUTC(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: manager } = await supabase
    .from("users")
    .select("first_name, org_id")
    .eq("id", authUser!.id)
    .single();

  const orgId = manager!.org_id;
  const todayStart = startOfTodayUTC();
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
  const monthStart = startOfMonthUTC();
  const weekStart = startOfWeekUTC();

  const nowIso = new Date().toISOString();
  const in30MinIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const [
    { data: todayVisits },
    { data: activeClients },
    { data: onShiftStaff },
    { data: openIncidents },
    { data: unpaidInvoices },
    { data: carePlans },
    { data: staff },
    { data: trainingRecords },
    { data: emarThisMonth },
    { data: medicationDueSoon },
  ] = await Promise.all([
    supabase
      .from("visits")
      .select(
        "id, client_id, assigned_carer_id, scheduled_start, scheduled_end, check_in_time, status, clients(first_name, last_name), users:assigned_carer_id(first_name, last_name)",
      )
      .eq("org_id", orgId)
      .gte("scheduled_start", todayStart.toISOString())
      .lt("scheduled_start", todayEnd.toISOString())
      .order("scheduled_start", { ascending: true }),
    supabase.from("clients").select("id, created_at").eq("org_id", orgId).eq("status", "active"),
    supabase
      .from("rota_shifts")
      .select("staff_id")
      .eq("org_id", orgId)
      .eq("shift_date", todayStart.toISOString().slice(0, 10))
      .not("shift_type", "in", "(sick_leave,off,annual_leave)"),
    supabase.from("incidents").select("id, severity, created_at").eq("org_id", orgId).eq("status", "open"),
    supabase
      .from("invoices")
      .select("total_amount, created_at")
      .eq("org_id", orgId)
      .in("status", ["sent", "overdue"]),
    supabase.from("care_plans").select("last_reviewed_at").eq("org_id", orgId),
    supabase.from("staff").select("id, dbs_expiry").eq("org_id", orgId),
    supabase.from("training_records").select("staff_id, expiry_date").eq("org_id", orgId),
    supabase
      .from("emar_records")
      .select("administered")
      .eq("org_id", orgId)
      .gte("created_at", monthStart.toISOString()),
    // Alert condition: medication due within 30 minutes, carer not yet
    // checked in (PRD section 4.2 trigger conditions).
    supabase
      .from("visits")
      .select("id, scheduled_start, clients(first_name, last_name), visit_tasks!inner(task_type, completed)")
      .eq("org_id", orgId)
      .eq("visit_tasks.task_type", "medication")
      .eq("visit_tasks.completed", false)
      .is("check_in_time", null)
      .gte("scheduled_start", nowIso)
      .lte("scheduled_start", in30MinIso),
  ]);

  // Analytics section (Gokul, direct request 2026-09-03) — separate
  // Promise.all so the (already large) primary dashboard query array
  // above stays readable. All figures computed live from the same
  // tables the rest of the dashboard already reads from — nothing new
  // introduced beyond named-selection scoping to "this week"/"this month".
  const [{ data: allStaff }, { data: allClients }, { data: weekVisits }, { data: monthIncidents }] = await Promise.all([
    supabase.from("staff").select("id, users:id(first_name, last_name)").eq("org_id", orgId),
    supabase.from("clients").select("id, assigned_carer_id").eq("org_id", orgId).eq("status", "active"),
    supabase
      .from("visits")
      .select("assigned_carer_id, scheduled_start, check_in_time, check_out_time, status, wellbeing_rating")
      .eq("org_id", orgId)
      .gte("scheduled_start", weekStart.toISOString()),
    supabase.from("incidents").select("client_id").eq("org_id", orgId).gte("created_at", monthStart.toISOString()),
  ]);

  const weekVisitsList = weekVisits ?? [];
  const clientsForAnalytics = allClients ?? [];

  const staffAnalytics: StaffAnalyticsRow[] = (allStaff ?? []).map((s) => {
    const person = Array.isArray(s.users) ? s.users[0] : s.users;
    const staffVisitsThisWeek = weekVisitsList.filter((v) => v.assigned_carer_id === s.id);
    const completedThisWeek = staffVisitsThisWeek.filter((v) => v.status === "completed").length;
    const activeClientCount = clientsForAnalytics.filter((c) => c.assigned_carer_id === s.id).length;

    const latenessSamples = staffVisitsThisWeek
      .filter((v) => v.check_in_time)
      .map((v) => Math.max(0, (new Date(v.check_in_time!).getTime() - new Date(v.scheduled_start).getTime()) / 60000));
    const avgLatenessMin =
      latenessSamples.length > 0 ? Math.round(latenessSamples.reduce((sum, m) => sum + m, 0) / latenessSamples.length) : null;

    return {
      staffId: s.id,
      name: person ? `${person.first_name} ${person.last_name}` : "Unknown",
      avgLatenessMin,
      activeClientCount,
      completedVisitsThisWeek: completedThisWeek,
    };
  });

  const durationSamples = weekVisitsList
    .filter((v) => v.status === "completed" && v.check_in_time && v.check_out_time)
    .map((v) => (new Date(v.check_out_time!).getTime() - new Date(v.check_in_time!).getTime()) / 60000);
  const avgVisitMinutes = durationSamples.length > 0 ? Math.round(durationSamples.reduce((sum, m) => sum + m, 0) / durationSamples.length) : null;

  const WELLBEING_SCORE: Record<string, number> = { good: 3, fair: 2, poor: 1 };
  const wellbeingSamples = weekVisitsList
    .filter((v) => v.wellbeing_rating)
    .map((v) => WELLBEING_SCORE[v.wellbeing_rating!] ?? 2);
  const avgWellbeingScore = wellbeingSamples.length > 0 ? wellbeingSamples.reduce((sum, s) => sum + s, 0) / wellbeingSamples.length : null;
  const avgWellbeingLabel =
    avgWellbeingScore === null ? null : avgWellbeingScore >= 2.5 ? "Good" : avgWellbeingScore >= 1.5 ? "Fair" : "Poor";

  const avgIncidentsPerClientPerMonth =
    clientsForAnalytics.length > 0 ? Math.round(((monthIncidents ?? []).length / clientsForAnalytics.length) * 100) / 100 : 0;

  const visits = todayVisits ?? [];
  const completedCount = visits.filter((v) => v.status === "completed").length;
  const pendingCount = visits.length - completedCount;

  const now = new Date();
  const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const unassignedSoon = visits.filter(
    (v) => !v.assigned_carer_id && new Date(v.scheduled_start) <= in2Hours && v.status !== "cancelled",
  );

  const lateCheckIns = new Set(
    visits
      .filter((v) => v.assigned_carer_id && new Date(v.scheduled_start) < now && !v.check_in_time && v.status !== "cancelled" && v.status !== "completed")
      .map((v) => v.assigned_carer_id),
  );

  const day24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const staleHighPriority = (openIncidents ?? []).filter(
    (i) => i.severity === "high" && new Date(i.created_at) < day24hAgo,
  );

  const newClientsThisMonth = (activeClients ?? []).filter((c) => new Date(c.created_at) >= monthStart).length;
  const openIncidentsList = openIncidents ?? [];
  const highPriorityIncidents = openIncidentsList.filter((i) => i.severity === "high").length;
  const unpaidTotal = (unpaidInvoices ?? []).reduce((sum, inv) => sum + Number(inv.total_amount), 0);
  const unpaidThisMonthCount = (unpaidInvoices ?? []).filter((inv) => new Date(inv.created_at) >= monthStart).length;

  const carePlansList = carePlans ?? [];
  const carePlansReviewedPct =
    carePlansList.length > 0
      ? Math.round((carePlansList.filter((c) => c.last_reviewed_at).length / carePlansList.length) * 100)
      : 100;

  const staffList = staff ?? [];
  const dbsValidPct =
    staffList.length > 0
      ? Math.round(
          (staffList.filter((s) => s.dbs_expiry && new Date(s.dbs_expiry) >= now).length / staffList.length) * 100,
        )
      : 100;

  const overdueStaffIds = new Set(
    (trainingRecords ?? []).filter((t) => new Date(t.expiry_date) < now).map((t) => t.staff_id),
  );
  const trainingUpToDatePct =
    staffList.length > 0
      ? Math.round(((staffList.length - overdueStaffIds.size) / staffList.length) * 100)
      : 100;

  const emarList = emarThisMonth ?? [];
  const medsCorrectPct =
    emarList.length > 0
      ? Math.round((emarList.filter((e) => e.administered).length / emarList.length) * 100)
      : 100;

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-page-heading text-text-primary">
            {greeting()}, {manager!.first_name}
          </h1>
          <p className="mt-1 text-secondary text-text-secondary">
            {dateLabel} — {visits.length} visits scheduled today
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/clients/new"
            className="rounded-btn border border-border-default bg-card-bg px-3.5 py-[7px] text-[12px] font-medium text-text-primary"
          >
            Add client
          </Link>
          <Link
            href="/copilot"
            className="rounded-btn bg-nhs-blue px-3.5 py-[7px] text-[12px] font-medium text-white"
          >
            Ask AI
          </Link>
        </div>
      </div>

      <AlertBanner
        unassignedSoon={unassignedSoon}
        medicationDueSoon={medicationDueSoon ?? []}
        staleHighPriorityCount={staleHighPriority.length}
      />

      <div className="mt-5">
        <MetricCards
          activeClientsCount={(activeClients ?? []).length}
          newClientsThisMonth={newClientsThisMonth}
          visitsToday={visits.length}
          completedCount={completedCount}
          pendingCount={pendingCount}
          staffOnShiftCount={(onShiftStaff ?? []).length}
          lateCheckInCount={lateCheckIns.size}
          openIncidentsCount={openIncidentsList.length}
          highPriorityIncidentsCount={highPriorityIncidents}
          invoiceDueTotal={unpaidTotal}
          unpaidThisMonthCount={unpaidThisMonthCount}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VisitStatusPanel orgId={orgId} initialVisits={visits} />

        <div className="space-y-4">
          <AiSummarySection
            hasOpenIncidents={openIncidentsList.length > 0}
            hasStaffingGap={unassignedSoon.length > 0}
          />
          <ComplianceSnapshot
            carePlansReviewedPct={carePlansReviewedPct}
            dbsValidPct={dbsValidPct}
            trainingUpToDatePct={trainingUpToDatePct}
            medsCorrectPct={medsCorrectPct}
          />
        </div>
      </div>

      <div className="mt-5">
        <AnalyticsSection
          staffRows={staffAnalytics}
          avgVisitMinutes={avgVisitMinutes}
          avgWellbeingLabel={avgWellbeingLabel}
          avgWellbeingScore={avgWellbeingScore}
          avgIncidentsPerClientPerMonth={avgIncidentsPerClientPerMonth}
        />
      </div>
    </div>
  );
}
