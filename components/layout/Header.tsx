import type { ReactNode } from "react";
import Link from "next/link";

// Source: Design System Document (dark blue portal headers); PRD sections
// 5.2/5.3 (carer), 6.3/6.6 (family) — two variants: logo header (My Day,
// Overview, Messages list) and back-arrow header (Visit Detail, Messages thread).
export interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Presence of backHref switches to the back-arrow variant instead of the logo block. */
  backHref?: string;
  right?: ReactNode;
  children?: ReactNode;
}

export function Header({ title, subtitle, backHref, right, children }: HeaderProps) {
  return (
    <header className="bg-nhs-dark-blue px-4 pt-5 pb-4 text-white">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          {backHref ? (
            <Link href={backHref} className="mb-2 inline-flex text-white/80" aria-label="Back">
              <i className="ti ti-arrow-left text-[20px]" aria-hidden="true" />
            </Link>
          ) : (
            <div className="mb-1">
              <div className="text-[18px] font-medium text-white">Autopilot</div>
              <div className="text-[10px] font-normal uppercase tracking-[2px] text-nhs-light-blue">
                Nodus Limited
              </div>
            </div>
          )}
          <h1 className="truncate text-[16px] font-bold text-white">{title}</h1>
          {subtitle ? <p className="mt-0.5 truncate text-secondary text-white/70">{subtitle}</p> : null}
        </div>

        {right ? <div className="flex shrink-0 items-center gap-3">{right}</div> : null}
      </div>

      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}
