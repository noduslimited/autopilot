"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Source: Gokul, direct request 2026-09-04 — carer mobile portal item 1.
// A full-width bottom sheet rather than the manager NotificationBell's
// anchored dropdown: a 340px dropdown risks overflowing a real ~390px
// phone viewport, and every other carer-facing panel in this app already
// uses the fixed-bottom-sheet pattern (see the old ShiftSwapForm this
// session replaces, and the new request forms it's replaced with) —
// this keeps the bell consistent with that, not the desktop manager UI.
export interface CarerNotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CarerNotificationSheet({ userId, open, onClose }: { userId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<CarerNotificationItem[]>([]);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems(data ?? []);
  }

  useEffect(() => {
    if (!open) return;
    void load();
    const supabase = createClient();
    const channel = supabase
      .channel(`carer-notifications-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        void load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  if (!open) return null;

  const unreadCount = items.filter((item) => !item.read).length;

  async function markRead(item: CarerNotificationItem) {
    if (!item.read) {
      const supabase = createClient();
      await supabase.from("notifications").update({ read: true }).eq("id", item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    }
    onClose();
    if (item.link) router.push(item.link);
  }

  async function markAllRead() {
    const supabase = createClient();
    const unreadIds = items.filter((i) => !i.read).map((i) => i.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[75vh] w-full max-w-[480px] flex-col rounded-t-card bg-card-bg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <p className="text-body font-medium text-text-primary">Notifications</p>
          {unreadCount > 0 ? (
            <button type="button" onClick={markAllRead} className="text-secondary text-nhs-blue">
              Mark all as read
            </button>
          ) : null}
        </div>
        <div className="overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-body text-text-secondary">No notifications yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border-default">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markRead(item)}
                  className={["px-4 py-3 text-left", item.read ? "bg-card-bg" : "bg-ai-blue-light"].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-body font-medium text-text-primary">{item.title}</p>
                    {!item.read ? <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-nhs-red" /> : null}
                  </div>
                  <p className="mt-0.5 text-secondary text-text-secondary">{item.body}</p>
                  <p className="mt-0.5 text-tiny text-text-secondary">{timeAgo(item.created_at)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={onClose} className="border-t border-border-default py-3 text-center text-body text-text-secondary">
          Close
        </button>
      </div>
    </div>
  );
}
