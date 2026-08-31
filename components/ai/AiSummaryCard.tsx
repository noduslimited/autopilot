import Link from "next/link";

// Source: PRD section 4.2 (Dashboard AI summary card)
export interface AiSummaryAction {
  label: string;
  href: string;
}

export interface AiSummaryCardProps {
  summary: string;
  actions?: AiSummaryAction[];
  title?: string;
}

export function AiSummaryCard({ summary, actions = [], title = "AI summary" }: AiSummaryCardProps) {
  return (
    <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
      <div className="flex items-center gap-2">
        <i className="ti ti-sparkles text-[16px] text-nhs-blue" aria-hidden="true" />
        <span className="text-subsection-heading text-text-primary">{title}</span>
      </div>

      <p className="mt-2 text-body text-text-primary">{summary}</p>

      {actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {actions.map((action, index) => (
            <Link key={`${action.label}-${index}`} href={action.href} className="text-body text-nhs-blue">
              {action.label} ↗
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
