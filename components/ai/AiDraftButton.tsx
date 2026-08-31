// Source: TRD components/ai/ listing ("sparkles + 'Draft' button");
// CARER-05 acceptance criteria (disabled + tooltip when AI unavailable)
export interface AiDraftButtonProps {
  label?: string;
  onClick?: () => void;
  loading?: boolean;
  disabledReason?: string;
  className?: string;
}

export function AiDraftButton({
  label = "Draft",
  onClick,
  loading = false,
  disabledReason,
  className = "",
}: AiDraftButtonProps) {
  const disabled = loading || !!disabledReason;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabledReason}
      className={[
        "inline-flex items-center gap-1.5 rounded-btn border border-ai-blue-border bg-ai-blue-light px-3.5 py-[7px]",
        "text-[12px] font-medium text-ai-blue-text disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    >
      <i className="ti ti-sparkles text-[14px]" aria-hidden="true" />
      {loading ? "Drafting…" : label}
    </button>
  );
}
