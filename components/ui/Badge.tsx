// Source: Design System Document section 7.3 (critical badge colours + status badge colours)
export type BadgeVariant =
  | "allergies"
  | "diet"
  | "highRisk"
  | "dnacpr"
  | "noCarer"
  | "abilities"
  | "completed"
  | "inProgress"
  | "notStarted"
  | "atRisk"
  | "pending"
  | "paid"
  | "valid"
  | "draft"
  | "onShift"
  | "ai"
  | "dueSoon";

export interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  allergies: "bg-danger-red-light text-danger-red",
  diet: "bg-[#E1F5EE] text-[#04342C]",
  highRisk: "bg-amber-light text-amber-text",
  dnacpr: "bg-dnacpr-purple-light text-dnacpr-purple-text",
  noCarer: "bg-danger-red-light text-danger-red",
  abilities: "bg-success-green-light text-success-green-text",
  completed: "bg-success-green-light text-success-green-text",
  inProgress: "bg-ai-blue-light text-ai-blue-heading",
  notStarted: "bg-[#F1EFE8] text-[#5F5E5A]",
  atRisk: "bg-danger-red-light text-danger-red",
  pending: "bg-amber-light text-amber-text",
  paid: "bg-success-green-light text-success-green-text",
  valid: "bg-success-green-light text-success-green-text",
  draft: "bg-[#F1EFE8] text-[#5F5E5A]",
  onShift: "bg-ai-blue-light text-ai-blue-heading",
  ai: "bg-nhs-blue text-white",
  dueSoon: "bg-amber-light text-amber-text",
};

export function Badge({ variant, children, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-block whitespace-nowrap rounded-badge px-[7px] py-[2px] text-[10px] font-medium",
        VARIANT_CLASSES[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
