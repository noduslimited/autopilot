"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SETTINGS_GROUPS } from "./settingsNavData";

// Gokul, direct request 2026-09-03 — Settings overhaul item 10: mobile
// gets a real stacked category list at /settings itself (matching the
// carer/NOK "tap through to a full-screen sub-page" pattern), instead of
// the desktop side-nav squeezed into a narrow viewport. Desktop keeps its
// existing immediate-redirect-to-Profile behaviour — checked via
// matchMedia on mount rather than server-side UA sniffing (no client-hint
// headers configured in this project), same category of client-side
// responsive-behaviour choice ManagerShell's own hamburger logic already
// makes.
export function SettingsIndexClient() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    if (mql.matches) {
      router.replace("/settings/organisation");
      return;
    }
    setIsMobile(true);
  }, [router]);

  if (isMobile === null) return null;

  return (
    <div className="space-y-5">
      <h1 className="text-page-heading text-text-primary">Settings</h1>
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-1 text-tiny font-medium tracking-wide text-text-muted uppercase">{group.label}</p>
          <div className="mt-1.5 overflow-hidden rounded-card border border-border-default bg-card-bg">
            {group.items.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center justify-between px-4 py-3 text-body text-text-primary",
                  i > 0 ? "border-t border-border-default" : "",
                ].join(" ")}
              >
                {item.label}
                <i className="ti ti-chevron-right text-[16px] text-text-muted" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
