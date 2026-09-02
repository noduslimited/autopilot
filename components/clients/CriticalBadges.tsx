import Link from "next/link";
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
  // Family portal only (Session: NOK badge tappability request) — when
  // set, each badge links to the care plan page rather than rendering as
  // plain static text. Deep-linking to the exact section a badge relates
  // to (allergies vs DNACPR vs risk) would need named anchors the care
  // plan page doesn't have yet; navigating to the page itself is the
  // explicitly-stated acceptable fallback. Optional and unused by the
  // manager/carer call sites, so their badges stay exactly as before.
  linkHref?: string;
}

export function CriticalBadges({ client, abilities, className = "", linkHref }: CriticalBadgesProps) {
  const badges: React.ReactNode[] = [];

  function wrap(key: string, node: React.ReactNode): React.ReactNode {
    if (!linkHref) return node;
    return (
      <Link key={key} href={linkHref} className="rounded-badge">
        {node}
      </Link>
    );
  }

  if (client.allergies.length > 0) {
    badges.push(wrap("allergies", <Badge key="allergies" variant="allergies">ALLERGIES</Badge>));
  }
  if (client.dietary_requirements) {
    badges.push(wrap("diet", <Badge key="diet" variant="diet">DIET</Badge>));
  }
  if (client.dnacpr) {
    badges.push(wrap("dnacpr", <Badge key="dnacpr" variant="dnacpr">DNACPR</Badge>));
  }
  if (client.risk_level === "high") {
    badges.push(wrap("highRisk", <Badge key="highRisk" variant="highRisk">HIGH RISK</Badge>));
  }
  if (abilities) {
    badges.push(wrap("abilities", <Badge key="abilities" variant="abilities">ABILITIES</Badge>));
  }
  if (!client.assigned_carer_id) {
    badges.push(wrap("noCarer", <Badge key="noCarer" variant="noCarer">NO CARER</Badge>));
  }

  if (badges.length === 0) return null;

  return <div className={["flex flex-wrap gap-1.5", className].join(" ")}>{badges}</div>;
}
