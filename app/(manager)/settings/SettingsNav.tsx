"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_GROUPS } from "./settingsNavData";

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="w-[180px] shrink-0 space-y-4">
      {SETTINGS_GROUPS.map((group) => (
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
