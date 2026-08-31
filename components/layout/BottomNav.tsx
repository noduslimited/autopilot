"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Source: Design System Document section 7.8; PRD sections 5.1 (carer), 6.2 (family)
interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const CARER_ITEMS: NavItem[] = [
  { label: "My Day", href: "/my-day", icon: "home" },
  { label: "Schedule", href: "/schedule", icon: "calendar" },
  { label: "Incident", href: "/report-incident", icon: "alert-triangle" },
  { label: "Profile", href: "/carer/profile", icon: "user" },
];

const FAMILY_ITEMS: NavItem[] = [
  { label: "Overview", href: "/family/overview", icon: "home" },
  { label: "Visits", href: "/family/visits", icon: "clock" },
  { label: "Care Plan", href: "/family/care-plan", icon: "file-text" },
  { label: "Messages", href: "/family/messages", icon: "message" },
];

export interface BottomNavProps {
  role: "carer" | "family_nok";
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const items = role === "carer" ? CARER_ITEMS : FAMILY_ITEMS;

  return (
    <nav className="flex justify-around border-t border-border-default bg-surface-secondary px-4 pt-2.5 pb-3.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={["flex flex-col items-center text-center", active ? "text-nhs-blue" : "text-text-muted"].join(
              " ",
            )}
          >
            <i className={`ti ti-${item.icon} text-[22px]`} aria-hidden="true" />
            <span className="mt-0.5 text-tiny">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
