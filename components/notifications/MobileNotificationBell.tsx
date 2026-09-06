"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MobileNotificationSheet } from "./MobileNotificationSheet";

// Shared bell button + unread badge for the carer and family (NOK)
// mobile portals — see MobileNotificationSheet.tsx for why this replaced
// the manager-sidebar-style anchored dropdown on both.
export function MobileNotificationBell({ userId, className = "text-white/80" }: { userId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    async function loadCount() {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("read", false);
      setUnreadCount(count ?? 0);
    }
    void loadCount();
    const channel = supabase
      .channel(`mobile-bell-unread-${userId}`)
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
      <button type="button" onClick={() => setOpen(true)} className="relative" aria-label="Notifications">
        <i className={`ti ti-bell text-[22px] ${className}`} aria-hidden="true" />
        {unreadCount > 0 ? <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-nhs-red" /> : null}
      </button>
      <MobileNotificationSheet userId={userId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
