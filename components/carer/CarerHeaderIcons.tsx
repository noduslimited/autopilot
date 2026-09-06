"use client";

import Link from "next/link";
import { MobileNotificationBell } from "@/components/notifications/MobileNotificationBell";

// Source: Gokul, direct request 2026-09-04 — carer mobile portal item 1
// ("the bell icon and profile icon... are still not wired up"). Both were
// either inert (My Day's bell had no onClick at all) or entirely absent
// (Schedule, Report Incident had no header icons whatsoever). One shared
// component now, dropped into every carer Header's `right` slot, so
// "wire up the bell and profile icon on all carer screens" only needed
// building once. The bell itself is MobileNotificationBell, shared with
// the family portal (2026-09-06) — see that component's own header
// comment for why.
export function CarerHeaderIcons({ userId, firstName, lastName }: { userId: string; firstName: string; lastName: string }) {
  return (
    <>
      <MobileNotificationBell userId={userId} />
      <Link
        href="/carer/profile"
        aria-label="Profile"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-nhs-light-blue text-[12px] font-medium text-nhs-dark-blue"
      >
        {firstName[0]}
        {lastName[0]}
      </Link>
    </>
  );
}
