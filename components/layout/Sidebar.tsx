"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SignOutButton } from "@/components/auth/SignOutButton";

// Source: Design System Document section 7.7; PRD section 4.1; IA doc section 3.5 (active nav rules)
interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  { label: "Clients", href: "/clients", icon: "users" },
  { label: "Rota", href: "/rota", icon: "calendar" },
  { label: "Staff", href: "/staff", icon: "id-badge" },
  { label: "Incidents", href: "/incidents", icon: "alert-triangle" },
  { label: "Finance", href: "/finance", icon: "receipt" },
  { label: "Reports", href: "/reports", icon: "chart-bar" },
  { label: "AI Copilot", href: "/copilot", icon: "sparkles" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  carer: "Carer",
  family_nok: "Family / Next of Kin",
  service_user: "Service User",
};

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  const initials = user ? `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase() : "";

  return (
    <aside className="flex h-screen w-[200px] shrink-0 flex-col bg-nhs-dark-blue">
      <div className="flex items-start justify-between px-4 pt-5 pb-4">
        <div>
          <div className="text-[18px] font-medium text-white">Autopilot</div>
          <div className="mt-0.5 text-[10px] font-normal uppercase tracking-[2px] text-nhs-light-blue">
            Nodus Limited
          </div>
        </div>
        {user ? <NotificationBell userId={user.id} /> : null}
      </div>

      <nav className="flex-1 px-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "my-0.5 flex items-center gap-2.5 rounded-btn px-3 py-2.5 text-body",
                active ? "bg-white/15 font-medium text-white" : "text-nhs-light-blue",
              ].join(" ")}
            >
              <i className={`ti ti-${item.icon} text-[18px]`} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-2 py-3">
        <Link
          href="/settings"
          className={[
            "mb-2 flex items-center gap-2.5 rounded-btn px-3 py-2.5 text-body",
            isActive(pathname, "/settings") ? "bg-white/15 font-medium text-white" : "text-nhs-light-blue",
          ].join(" ")}
        >
          <i className="ti ti-settings text-[18px]" aria-hidden="true" />
          Settings
        </Link>

        {user ? (
          <div className="flex items-center gap-2.5 px-3 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nhs-light-blue text-[11px] font-medium text-nhs-dark-blue">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-body font-medium text-white">
                {user.first_name} {user.last_name}
              </div>
              <div className="truncate text-[11px] text-nhs-light-blue">
                {ROLE_LABELS[user.role] ?? user.role}
              </div>
            </div>
            <SignOutButton iconOnly className="shrink-0 flex h-8 w-8 items-center justify-center rounded-btn text-nhs-light-blue" />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
