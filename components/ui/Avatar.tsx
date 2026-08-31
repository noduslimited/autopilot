// Source: Design System Document section 7.4
export type AvatarVariant = "manager" | "carer" | "ai";
export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps {
  initials: string;
  variant?: AvatarVariant;
  /** Explicit colour override — used by ClientAvatar's per-client hash palette. */
  bg?: string;
  text?: string;
  size?: AvatarSize;
  className?: string;
}

const VARIANT_CLASSES: Record<AvatarVariant, string> = {
  manager: "bg-ai-blue-light text-ai-blue-heading",
  carer: "bg-success-green-light text-success-green-text",
  ai: "bg-nhs-blue text-white",
};

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "w-8 h-8 text-[11px]",
  md: "w-10 h-10 text-[13px]",
  lg: "w-12 h-12 text-[15px]",
};

export function Avatar({ initials, variant = "manager", bg, text, size = "md", className = "" }: AvatarProps) {
  const colourClasses = bg && text ? `${bg} ${text}` : VARIANT_CLASSES[variant];

  return (
    <div
      className={[
        "flex items-center justify-center rounded-full font-medium shrink-0",
        SIZE_CLASSES[size],
        colourClasses,
        className,
      ].join(" ")}
    >
      {initials}
    </div>
  );
}
