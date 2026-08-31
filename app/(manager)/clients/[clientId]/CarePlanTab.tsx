import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { CarePlanContent, type CareNeedDetail } from "./CarePlanContent";

// care_needs is stored as jsonb (an array of { type, detail } written by
// the add-client wizard, step 2) — narrow it defensively rather than
// trusting the Json type, since nothing in Postgres enforces this shape.
function parseCareNeeds(value: Json): CareNeedDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const type = (entry as Record<string, unknown>).type;
    const detail = (entry as Record<string, unknown>).detail;
    if (typeof type !== "string" || typeof detail !== "string") return [];
    return [{ type, detail }];
  });
}

// Source: PRD section 4.3 (Care Plan tab); CLT-05 acceptance criteria
export async function CarePlanTab({ clientId, clientFirstName }: { clientId: string; clientFirstName: string }) {
  const supabase = await createClient();

  const [{ data: client }, { data: carePlan }] = await Promise.all([
    supabase
      .from("clients")
      .select("biography, allergies, dietary_requirements, dnacpr, risk_level, mobility_aids, falls_risk, choking_risk, additional_risk_notes")
      .eq("id", clientId)
      .single(),
    supabase
      .from("care_plans")
      .select("id, care_needs, what_we_help_with, last_reviewed_at, reviewed_by, ai_suggested_updates, users:reviewed_by(first_name, last_name)")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  if (!client) return null;

  const reviewer = carePlan?.users
    ? Array.isArray(carePlan.users)
      ? carePlan.users[0]
      : carePlan.users
    : null;

  return (
    <CarePlanContent
      clientId={clientId}
      clientFirstName={clientFirstName}
      client={client}
      whatWeHelpWith={carePlan?.what_we_help_with ?? []}
      careNeedDetails={parseCareNeeds(carePlan?.care_needs ?? [])}
      lastReviewedAt={carePlan?.last_reviewed_at ?? null}
      reviewerName={reviewer ? `${reviewer.first_name} ${reviewer.last_name}` : null}
      savedAiSuggestion={carePlan?.ai_suggested_updates ?? null}
    />
  );
}
