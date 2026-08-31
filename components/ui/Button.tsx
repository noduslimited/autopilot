import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "danger" | "secondary" | "accent";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  icon?: ReactNode;
}

// Source: Design System Document section 7.1
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-nhs-blue text-white hover:bg-[#004A93]",
  danger: "bg-nhs-red text-white hover:bg-[#B02215]",
  secondary: "bg-card-bg text-text-primary border border-border-default hover:bg-surface-secondary",
  accent: "bg-ai-blue-light text-ai-blue-text border border-ai-blue-border",
};

export function Button({
  variant = "primary",
  fullWidth = false,
  icon,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-btn font-medium",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        fullWidth ? "w-full px-3.5 py-3 text-body" : "px-3.5 py-[7px] text-[12px]",
        VARIANT_CLASSES[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
