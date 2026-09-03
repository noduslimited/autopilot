import { createClient } from "@/lib/supabase/server";
import { ClientListClient, type ClientListItem } from "./ClientListClient";

// Source: PRD section 4.3 (Clients)

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function single<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: manager } = await supabase.from("users").select("org_id").eq("id", authUser!.id).single();
  const orgId = manager!.org_id;

  const todayStart = startOfTodayUTC();
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const [{ data: clients }, { data: todayVisits }, { data: openIncidents }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, first_name, last_name, date_of_birth, nhs_number, address, care_type, assigned_carer_id, risk_level, allergies, dietary_requirements, dnacpr, status, users:assigned_carer_id(first_name, last_name), care_plans(last_reviewed_at)",
      )
      .eq("org_id", orgId)
      .in("status", ["active", "draft"])
      .order("first_name", { ascending: true }),
    supabase
      .from("visits")
      .select("client_id, status, scheduled_start")
      .eq("org_id", orgId)
      .gte("scheduled_start", todayStart.toISOString())
      .lt("scheduled_start", todayEnd.toISOString())
      .order("scheduled_start", { ascending: true }),
    supabase.from("incidents").select("client_id").eq("org_id", orgId).eq("status", "open"),
  ]);

  const now = new Date();
  const openIncidentClientIds = new Set((openIncidents ?? []).map((i) => i.client_id));

  const visitsByClient = new Map<string, { status: string; scheduled_start: string }[]>();
  for (const visit of todayVisits ?? []) {
    const list = visitsByClient.get(visit.client_id) ?? [];
    list.push(visit);
    visitsByClient.set(visit.client_id, list);
  }

  const items: ClientListItem[] = (clients ?? []).map((client) => {
    const carer = single(client.users);
    const carePlan = single(client.care_plans);
    const visits = visitsByClient.get(client.id) ?? [];
    const inProgress = visits.some((v) => v.status === "in_progress");
    const nextVisit = visits.find((v) => v.status === "scheduled" && new Date(v.scheduled_start) >= now);

    // Status label priority — not precisely defined anywhere in the docs;
    // see CLAUDE.md Session 5 log for the reasoning.
    let statusLabel: ClientListItem["statusLabel"];
    if (inProgress) statusLabel = "Visit in progress";
    else if (!client.assigned_carer_id || openIncidentClientIds.has(client.id)) statusLabel = "Action needed";
    else if (!carePlan?.last_reviewed_at) statusLabel = "Review due";
    else statusLabel = "Care plan current";

    return {
      id: client.id,
      firstName: client.first_name,
      lastName: client.last_name,
      age: calculateAge(client.date_of_birth),
      nhsNumber: client.nhs_number,
      address: client.address,
      careType: client.care_type,
      assignedCarerId: client.assigned_carer_id,
      assignedCarerName: carer ? `${carer.first_name} ${carer.last_name}` : null,
      riskLevel: client.risk_level as "low" | "medium" | "high",
      allergies: client.allergies,
      dietaryRequirements: client.dietary_requirements,
      dnacpr: client.dnacpr,
      statusLabel,
      nextVisitTime: nextVisit?.scheduled_start ?? null,
      recordStatus: client.status as "active" | "draft",
    };
  });

  return <ClientListClient clients={items} />;
}
