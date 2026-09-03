"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Modal } from "@/components/ui/Modal";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { BackButton } from "./BackButton";

// Manager portal responsive shell. Source: Design System Document section
// 10.1 — desktop (>=1024px) sidebar always visible; tablet (768-1023px)
// sidebar collapsible via hamburger; mobile (<768px) sidebar hidden,
// bottom nav instead. PRD section 4.1 gives the mobile bottom nav's exact
// item set (Dashboard, Clients, Rota, Staff, more). Not the same component
// as components/layout/BottomNav.tsx, which TRD explicitly scopes to
// "carer and family portals" only — the manager mobile nav has a different
// item set and an overflow "more" sheet BottomNav doesn't support.
const MOBILE_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  { label: "Clients", href: "/clients", icon: "users" },
  { label: "Rota", href: "/rota", icon: "calendar" },
  { label: "Staff", href: "/staff", icon: "id-badge" },
];

const MORE_ITEMS = [
  { label: "Incidents", href: "/incidents", icon: "alert-triangle" },
  { label: "Finance", href: "/finance", icon: "receipt" },
  { label: "Reports", href: "/reports", icon: "chart-bar" },
  { label: "AI Copilot", href: "/copilot", icon: "sparkles" },
  { label: "Settings", href: "/settings", icon: "settings" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ManagerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [tabletSidebarOpen, setTabletSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-page-bg">
      {/* Desktop: sidebar always visible */}
      <div className="hidden lg:block print:hidden">
        <Sidebar />
      </div>

      {tabletSidebarOpen ? (
        <div className="fixed inset-0 z-40 flex md:flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setTabletSidebarOpen(false)} />
          <div className="relative">
            <Sidebar />
          </div>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        {/* Real gap found: below the desktop breakpoint the sidebar (the
            only place branding lives) is either hidden behind the tablet
            hamburger or replaced by the mobile bottom nav — every manager
            page rendered straight into its own heading with no Autopilot
            branding or back button visible at all. One shared bar here,
            not touched per-page, covers every manager route uniformly. */}
        <header className="flex items-center gap-3 bg-nhs-dark-blue px-4 py-3 text-white lg:hidden print:hidden">
          {pathname !== "/dashboard" ? (
            <BackButton className="text-white/80" />
          ) : null}
          <button
            type="button"
            onClick={() => setTabletSidebarOpen(true)}
            aria-label="Open navigation"
            className="inline-flex items-center text-white/80"
          >
            <i className="ti ti-menu-2 text-[20px]" aria-hidden="true" />
          </button>
          <div>
            <div className="text-[16px] font-medium leading-tight text-white">Autopilot</div>
            <div className="text-[9px] font-normal uppercase tracking-[2px] text-nhs-light-blue">
              Nodus Limited
            </div>
          </div>
        </header>

        <main className="pb-16 md:pb-0">{children}</main>
      </div>

      {/* Mobile: bottom nav with overflow "more" sheet */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-border-default bg-surface-secondary px-4 pt-2.5 pb-3.5 md:hidden print:hidden">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
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
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center text-center text-text-muted"
        >
          <i className="ti ti-dots text-[22px]" aria-hidden="true" />
          <span className="mt-0.5 text-tiny">More</span>
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)}>
        <h2 className="mb-3 text-section-heading text-text-primary">More</h2>
        <div className="space-y-1">
          {MORE_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-2.5 rounded-btn px-3 py-2.5 text-body text-text-primary hover:bg-surface-secondary"
            >
              <i className={`ti ti-${item.icon} text-[18px] text-nhs-blue`} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </div>
        {/* Real gap found: the sign-out button has only ever lived inside
            Sidebar.tsx (desktop/tablet), which mobile-width layouts never
            render at all — there was no way to sign out on a phone-width
            screen. Same full-width bordered danger-red style already
            established by the carer profile page and family overview's
            own sign-out buttons, for visual consistency across portals. */}
        <div className="mt-3 border-t border-border-default pt-3">
          <SignOutButton className="w-full rounded-btn border border-border-default bg-card-bg py-[10px] text-[13px] font-medium text-danger-red" />
        </div>
      </Modal>
    </div>
  );
}
