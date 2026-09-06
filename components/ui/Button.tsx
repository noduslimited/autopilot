import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "danger" | "secondary" | "accent";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  icon?: ReactNode;
  /**
   * Perf pass, 2026-09-06: a single shared way to show "this click is being
   * handled" immediately, rather than every call site hand-rolling its own
   * "Saving…"-text-only pattern (which several already did, inconsistently
   * — some disabled the button, some didn't, none showed a spinner). Forces
   * disabled regardless of the `disabled` prop, so a caller can't
   * accidentally leave a loading button clickable.
   */
  loading?: boolean;
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
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const spinnerColor = variant === "primary" || variant === "danger" ? "text-white" : "text-nhs-blue";
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-btn font-medium",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        fullWidth ? "w-full px-3.5 py-3 text-body" : "px-3.5 py-[7px] text-[12px]",
        VARIANT_CLASSES[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? <Spinner size={14} className={spinnerColor} /> : icon}
      {children}
    </button>
  );
}
