import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Source: AI Feature Specification section 4.6 (AI Report Generation) —
// dynamic, keyword-based context gathering. The spec's own `period`
// parameter isn't tied to any prompt-parsing logic anywhere in the docs
// (parsing "last 3 months" out of free text is a separate, unspecified
// NLP task) — every gatherer here is scoped to the current calendar
// month, matching the Reports page's own monthly framing (prompt chips:
// "Monthly CQC summary", "All incidents this month").
function promptContains(prompt: string, keywords: string[]): boolean {
  const lower = prompt.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function startOfMonthISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function fetchIncidentSummary(supabase: SupabaseClient<Database>, orgId: string) {
  const { data } = await supabase
    .from("incidents")
    .select("incident_type, severity, status, description, created_at, clients(first_name)")
    .eq("org_id", orgId)
    .gte("created_at", startOfMonthISO());

  return (data ?? []).map((i) => {
    const client = Array.isArray(i.clients) ? i.clients[0] : i.clients;
    return {
      client_first_name: client?.first_name ?? "Unknown",
      type: i.incident_type,
      severity: i.severity,
      status: i.status,
      description: i.description,
      date: i.created_at,
    };
  });
}

async function fetchVisitSummary(supabase: SupabaseClient<Database>, orgId: string) {
  const { data } = await supabase.from("visits").select("status").eq("org_id", orgId).gte("scheduled_start", startOfMonthISO());
  const rows = data ?? [];
  const total = rows.filter((r) => r.status !== "cancelled").length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const missed = rows.filter((r) => r.status === "missed").length;
  return {
    total_visits_this_month: total,
    completed,
    missed,
    completion_rate_percent: total > 0 ? Math.round((completed / total) * 100) : null,
  };
}

async function fetchEmarCompliance(supabase: SupabaseClient<Database>, orgId: string) {
  const { data } = await supabase.from("emar_records").select("administered").eq("org_id", orgId).gte("created_at", startOfMonthISO());
  const rows = data ?? [];
  const administered = rows.filter((r) => r.administered).length;
  return {
    total_medication_records_this_month: rows.length,
    administered,
    compliance_rate_percent: rows.length > 0 ? Math.round((administered / rows.length) * 100) : null,
  };
}

async function fetchStaffCompliance(supabase: SupabaseClient<Database>, orgId: string) {
  const [{ data: staffRows }, { data: trainingRows }] = await Promise.all([
    supabase.from("staff").select("id, dbs_expiry").eq("org_id", orgId),
    supabase.from("training_records").select("staff_id, expiry_date").eq("org_id", orgId),
  ]);

  const today = new Date();
  const dbsValid = (staffRows ?? []).filter((s) => s.dbs_expiry && new Date(s.dbs_expiry) > today).length;

  const expiringSoon = (trainingRows ?? []).filter((t) => {
    const days = (new Date(t.expiry_date).getTime() - today.getTime()) / 86400000;
    return days >= 0 && days <= 60;
  }).length;
  const overdue = (trainingRows ?? []).filter((t) => new Date(t.expiry_date) < today).length;

  return {
    total_staff: (staffRows ?? []).length,
    dbs_valid: dbsValid,
    training_due_soon_60_days: expiringSoon,
    training_overdue: overdue,
  };
}

export async function gatherReportContext(
  supabase: SupabaseClient<Database>,
  orgId: string,
  prompt: string,
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {};

  if (promptContains(prompt, ["incident", "fall", "medication error", "behaviour"])) {
    context.incidents = await fetchIncidentSummary(supabase, orgId);
  }
  if (promptContains(prompt, ["visit", "completion", "missed"])) {
    context.visitSummary = await fetchVisitSummary(supabase, orgId);
  }
  if (promptContains(prompt, ["medication", "emar", "compliance", "drug"])) {
    context.emarCompliance = await fetchEmarCompliance(supabase, orgId);
  }
  if (promptContains(prompt, ["staff", "training", "dbs", "compliance"])) {
    context.staffCompliance = await fetchStaffCompliance(supabase, orgId);
  }
  if (promptContains(prompt, ["cqc", "monthly", "summary", "overview"])) {
    context.visitSummary = context.visitSummary ?? (await fetchVisitSummary(supabase, orgId));
    context.incidents = context.incidents ?? (await fetchIncidentSummary(supabase, orgId));
    context.emarCompliance = context.emarCompliance ?? (await fetchEmarCompliance(supabase, orgId));
    context.staffCompliance = context.staffCompliance ?? (await fetchStaffCompliance(supabase, orgId));
  }

  return context;
}
