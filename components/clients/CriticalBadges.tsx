import { Badge } from "@/components/ui/Badge";

// Source: PRD section 2 (critical badge system) + Database Schema Document
// section 3.3 (clients table). Field order follows PRD section 2's listed
// order: ALLERGIES, DIET, DNACPR, HIGH RISK, ABILITIES, NO CARER.
//
// ABILITIES has no backing column in the clients table and no documented
// trigger condition anywhere in the PRD/schema — it is accepted here as an
// explicit optional prop rather than derived, since there is no data source
// to derive it from yet.
export interface CriticalBadgesClient {
  allergies: string[];
  dietary_requirements: string | null;
  dnacpr: boolean;
  risk_level: "low" | "medium" | "high";
  assigned_carer_id: string | null;
}

export interface CriticalBadgesProps {
  client: CriticalBadgesClient;
  abilities?: string;
  className?: string;
}

export function CriticalBadges({ client, abilities, className = "" }: CriticalBadgesProps) {
  const badges: React.ReactNode[] = [];

  if (client.allergies.length > 0) {
    badges.push(
      <Badge key="allergies" variant="allergies">
        ALLERGIES
      </Badge>,
    );
  }
  if (client.dietary_requirements) {
    badges.push(
      <Badge key="diet" variant="diet">
        DIET
      </Badge>,
    );
  }
  if (client.dnacpr) {
    badges.push(
      <Badge key="dnacpr" variant="dnacpr">
        DNACPR
      </Badge>,
    );
  }
  if (client.risk_level === "high") {
    badges.push(
      <Badge key="highRisk" variant="highRisk">
        HIGH RISK
      </Badge>,
    );
  }
  if (abilities) {
    badges.push(
      <Badge key="abilities" variant="abilities">
        ABILITIES
      </Badge>,
    );
  }
  if (!client.assigned_carer_id) {
    badges.push(
      <Badge key="noCarer" variant="noCarer">
        NO CARER
      </Badge>,
    );
  }

  if (badges.length === 0) return null;

  return <div className={["flex flex-wrap gap-1.5", className].join(" ")}>{badges}</div>;
}
