"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Source: Information Architecture Document section 8 (Settings
// Sub-navigation) — 4 groups, 8 routes, matching PRD section 4.10's left
// nav exactly.
const GROUPS = [
  {
    label: "Organisation",
    items: [
      { href: "/settings/organisation", label: "Profile" },
      { href: "/settings/branding", label: "Branding" },
      { href: "/settings/care-types", label: "Care types" },
    ],
  },
  {
    label: "Users & access",
    items: [
      { href: "/settings/team", label: "Team members" },
      { href: "/settings/permissions", label: "Roles & permissions" },
    ],
  },
  {
    label: "Billing",
    items: [
      { href: "/settings/billing", label: "Plan & usage" },
      { href: "/settings/invoicing", label: "Invoicing defaults" },
    ],
  },
  {
    label: "Integrations",
    items: [{ href: "/settings/notifications", label: "Notifications" }],
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="w-[180px] shrink-0 space-y-4">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-2 text-tiny font-medium tracking-wide text-text-muted uppercase">{group.label}</p>
          <div className="mt-1 space-y-0.5">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "block rounded-btn px-2 py-1.5 text-body",
                  pathname === item.href ? "bg-ai-blue-light font-medium text-nhs-blue" : "text-text-primary hover:bg-surface-secondary",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
