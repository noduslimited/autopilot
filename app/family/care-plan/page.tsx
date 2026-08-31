import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { getLinkedClientId } from "@/lib/family/getLinkedClient";
import { UnlinkedAccountNotice } from "@/components/family/UnlinkedAccountNotice";
import { Header } from "@/components/layout/Header";
import { ClientAvatar } from "@/components/clients/ClientAvatar";

// Source: PRD section 6.5 (Care Plan) — strictly read-only, no edit
// buttons rendered anywhere on this page.

const CARE_NEED_ICONS: Record<string, string> = {
  meal_prep: "tool-kitchen-2",
  medication: "pill",
  moving: "activity",
  personal_care: "droplet",
  companionship: "heart-off",
  housekeeping: "home",
  other: "dots",
};

const CARE_NEED_LABELS: Record<string, string> = {
  meal_prep: "Meal preparation",
  medication: "Medication administration",
  moving: "Moving and handling",
  personal_care: "Personal care",
  companionship: "Companionship",
  housekeeping: "Housekeeping",
  other: "Other",
};

interface CareNeedDetail {
  type: string;
  detail: string;
}

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

function age(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const hasHadBirthday = now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hasHadBirthday) years -= 1;
  return years;
}

const CARE_TYPE_LABELS: Record<string, string> = {
  domiciliary: "Domiciliary care",
  residential: "Residential care",
  supported_living: "Supported living",
};

export default async function FamilyCarePlanPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const clientId = await getLinkedClientId(supabase, authUser!.id);
  if (!clientId) return <UnlinkedAccountNotice />;

  const [{ data: client }, { data: carePlan }] = await Promise.all([
    supabase
      .from("clients")
      .select("first_name, last_name, date_of_birth, care_type, biography, allergies, dietary_requirements, dnacpr, risk_level, mobility_aids, falls_risk, additional_risk_notes")
      .eq("id", clientId)
      .single(),
    supabase.from("care_plans").select("care_needs, last_reviewed_at").eq("client_id", clientId).maybeSingle(),
  ]);
  if (!client) return <UnlinkedAccountNotice />;

  const careNeeds = parseCareNeeds(carePlan?.care_needs ?? []);

  const alerts: Array<{ label: string; detail: string; className: string }> = [];
  if (client.allergies.length > 0) {
    alerts.push({ label: "Allergies", detail: client.allergies.join(" · "), className: "bg-[#FDECEA] text-danger-red" });
  }
  if (client.risk_level === "high" || client.falls_risk) {
    const detailParts = [client.additional_risk_notes, client.mobility_aids ? `Uses ${client.mobility_aids}.` : null].filter(Boolean);
    alerts.push({
      label: client.falls_risk ? "High risk — Falls" : "High risk",
      detail: detailParts.join(" ") || "Requires extra care and attention.",
      className: "bg-amber-light text-amber-text",
    });
  }
  if (client.dnacpr) {
    alerts.push({ label: "DNACPR in place", detail: "Do not attempt cardiopulmonary resuscitation.", className: "bg-dnacpr-purple-light text-dnacpr-purple-text" });
  }

  return (
    <div>
      <Header
        title="Care plan"
        backHref="/family/overview"
        subtitle={`${client.first_name} ${client.last_name}${carePlan?.last_reviewed_at ? ` · Last reviewed ${new Date(carePlan.last_reviewed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}`}
      />

      <div className="px-4 py-4">
        {/* Plain informational banner, not AI content — deliberately not
            AiInsightPanel (sparkles icon is reserved for real AI features
            per CLAUDE.md's AI visual identity rules). Same blue used by
            PRD 6.5's read-only banner spec, no AI badge/icon. */}
        <div className="rounded-[10px] border border-ai-blue-border bg-ai-blue-light p-3.5">
          <p className="text-body text-ai-blue-text">
            This is a read-only view of {client.first_name}&apos;s current care plan. Contact the care team if you have questions or want to suggest changes.
          </p>
        </div>

        <div className="mt-3.5 rounded-card border border-border-default bg-card-bg p-3.5">
          <div className="flex items-center gap-2.5">
            <ClientAvatar firstName={client.first_name} lastName={client.last_name} size="md" />
            <div>
              <p className="text-body font-medium text-text-primary">
                {client.first_name} {client.last_name}
              </p>
              <p className="text-secondary text-text-secondary">
                {age(client.date_of_birth)} years old · {CARE_TYPE_LABELS[client.care_type] ?? client.care_type}
              </p>
            </div>
          </div>
          {client.biography ? <p className="mt-3 text-body text-text-primary">{client.biography}</p> : null}
        </div>

        <div className="mt-3.5 rounded-card border border-border-default bg-card-bg p-3.5">
          <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">What we help with</h2>
          <div className="flex flex-col divide-y divide-border-default">
            {careNeeds.length === 0 ? (
              <p className="py-2 text-body text-text-secondary">No care needs recorded yet.</p>
            ) : (
              careNeeds.map((need, index) => (
                <div key={`${need.type}-${index}`} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                  <i className={`ti ti-${CARE_NEED_ICONS[need.type] ?? "circle"} mt-0.5 text-[18px] text-nhs-blue`} aria-hidden="true" />
                  <div>
                    <p className="text-body font-medium text-text-primary">{CARE_NEED_LABELS[need.type] ?? need.type}</p>
                    <p className="text-secondary text-text-secondary">{need.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {alerts.length > 0 ? (
          <div className="mt-3.5 rounded-card border border-border-default bg-card-bg p-3.5">
            <h2 className="mb-2 text-label uppercase tracking-wide text-text-secondary">Alerts and risks</h2>
            <div className="flex flex-col gap-2">
              {alerts.map((alert) => (
                <div key={alert.label} className={["rounded-input p-3", alert.className].join(" ")}>
                  <p className="text-body font-medium">{alert.label}</p>
                  <p className="mt-0.5 text-secondary">{alert.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
