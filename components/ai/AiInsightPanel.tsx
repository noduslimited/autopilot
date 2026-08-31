// Source: Design System Document section 9 (AI Visual Conventions) + section 7.5 (AI panel card)
export interface AiInsightPanelProps {
  children: React.ReactNode;
  italic?: boolean;
  className?: string;
}

export function AiInsightPanel({ children, italic = false, className = "" }: AiInsightPanelProps) {
  return (
    <div
      className={[
        "flex items-start gap-2 rounded-[10px] border border-ai-blue-border bg-ai-blue-light py-3 px-3.5",
        className,
      ].join(" ")}
    >
      <i className="ti ti-sparkles mt-0.5 shrink-0 text-[16px] text-nhs-blue" aria-hidden="true" />
      <p className={["text-body text-ai-blue-text", italic ? "italic" : ""].join(" ")}>{children}</p>
    </div>
  );
}
