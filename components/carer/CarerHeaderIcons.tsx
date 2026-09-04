"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CarerNotificationSheet } from "./CarerNotificationSheet";

// Source: Gokul, direct request 2026-09-04 — carer mobile portal item 1
// ("the bell icon and profile icon... are still not wired up"). Both were
// either inert (My Day's bell had no onClick at all) or entirely absent
// (Schedule, Report Incident had no header icons whatsoever). One shared
// component now, dropped into every carer Header's `right` slot, so
// "wire up the bell and profile icon on all carer screens" only needed
// building once.
export function CarerHeaderIcons({ userId, firstName, lastName }: { userId: string; firstName: string; lastName: string }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    async function loadCount() {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("read", false);
      setUnreadCount(count ?? 0);
    }
    void loadCount();
    const channel = supabase
      .channel(`carer-header-unread-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        void loadCount();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <>
      <button type="button" onClick={() => setSheetOpen(true)} className="relative" aria-label="Notifications">
        <i className="ti ti-bell text-[22px] text-white/80" aria-hidden="true" />
        {unreadCount > 0 ? <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-nhs-red" /> : null}
      </button>
      <Link
        href="/carer/profile"
        aria-label="Profile"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-nhs-light-blue text-[12px] font-medium text-nhs-dark-blue"
      >
        {firstName[0]}
        {lastName[0]}
      </Link>

      <CarerNotificationSheet userId={userId} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
