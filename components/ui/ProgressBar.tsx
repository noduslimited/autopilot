// Source: Design System Document section 7.6
export type ProgressBarVariant = "green" | "amber" | "red";

export interface ProgressBarProps {
  /** 0-100 */
  value: number;
  variant?: ProgressBarVariant;
  className?: string;
}

const FILL_CLASSES: Record<ProgressBarVariant, string> = {
  green: "bg-nhs-green",
  amber: "bg-nhs-amber",
  red: "bg-nhs-red",
};

export function ProgressBar({ value, variant = "green", className = "" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={["h-1.5 overflow-hidden rounded-progress bg-page-bg", className].join(" ")}>
      <div
        className={["h-full rounded-progress", FILL_CLASSES[variant]].join(" ")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
