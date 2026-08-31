import type { HTMLAttributes } from "react";

export type CardVariant = "standard" | "secondary" | "ai" | "alert" | "highPriority";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

// Source: Design System Document section 7.5
const VARIANT_CLASSES: Record<CardVariant, string> = {
  standard: "bg-card-bg border border-border-default rounded-card py-3.5 px-4",
  secondary: "bg-surface-secondary border border-border-default rounded-card py-3.5 px-4",
  ai: "bg-ai-blue-light border border-ai-blue-border rounded-[10px] py-3 px-3.5",
  alert: "bg-danger-red-light border border-danger-red-border rounded-card py-3.5 px-4",
  highPriority: "bg-card-bg border-[1.5px] border-danger-red-border rounded-card p-4",
};

export function Card({ variant = "standard", className = "", children, ...rest }: CardProps) {
  return (
    <div className={[VARIANT_CLASSES[variant], className].join(" ")} {...rest}>
      {children}
    </div>
  );
}
