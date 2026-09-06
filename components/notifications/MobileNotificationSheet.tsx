"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";

// Source: Gokul, direct request 2026-09-06 — item 5 ("notifications
// dropdown/panel... overflows or is cut off on mobile — fix so it's a
// bottom sheet, ~70% of screen height, drag handle, scrolls internally,
// tap-outside or Close to dismiss"). Shared between the carer and family
// (NOK) portals — both had the identical problem: family used the
// manager sidebar's own 340px-wide anchored dropdown (NotificationBell),
// which risks overflowing a real ~390px phone; the carer's own bottom
// sheet (built in an earlier session) was already close to this spec but
// had no drag handle. One shared component now for both.
export interface MobileNotificationItem {
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

export function MobileNotificationSheet({ userId, open, onClose }: { userId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [items, setItems] = useState<MobileNotificationItem[]>([]);

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
      .channel(`mobile-notifications-${userId}`)
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

  // Perf pass, 2026-09-06: both of these used to await the DB round trip
  // before closing the sheet / navigating — a real, user-visible delay on
  // one of the most-clicked actions in the app. "Read" is a predictable,
  // low-stakes outcome, so both now update immediately and only roll back
  // (with a toast) on a genuine error — the sheet closing and navigating
  // no longer wait on the network at all.
  function markRead(item: MobileNotificationItem) {
    onClose();
    if (item.link) router.push(item.link);
    if (item.read) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    const supabase = createClient();
    supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", item.id)
      .then(({ error }) => {
        if (error) {
          setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: false } : i)));
          showToast("Could not mark that as read.", "error");
        }
      });
  }

  function markAllRead() {
    const unreadIds = items.filter((i) => !i.read).map((i) => i.id);
    if (unreadIds.length === 0) return;
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    const supabase = createClient();
    supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds)
      .then(({ error }) => {
        if (error) {
          setItems((prev) => prev.map((i) => (unreadIds.includes(i.id) ? { ...i, read: false } : i)));
          showToast("Could not mark all as read.", "error");
        }
      });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="box-border flex h-[70vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-card bg-card-bg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-border-default" aria-hidden="true" />
        </div>
        <div className="flex shrink-0 items-center justify-between border-b border-border-default px-4 py-3">
          <p className="text-body font-medium text-text-primary">Notifications</p>
          {unreadCount > 0 ? (
            <button type="button" onClick={markAllRead} className="text-secondary text-nhs-blue">
              Mark all as read
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-body text-text-secondary">No notifications yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border-default">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markRead(item)}
                  className={["w-full px-4 py-3 text-left", item.read ? "bg-card-bg" : "bg-ai-blue-light"].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-body font-medium text-text-primary">{item.title}</p>
                    {!item.read ? <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-nhs-red" /> : null}
                  </div>
                  <p className="mt-0.5 whitespace-pre-line break-words text-secondary text-text-secondary">{item.body}</p>
                  <p className="mt-0.5 text-tiny text-text-secondary">{timeAgo(item.created_at)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={onClose} className="shrink-0 border-t border-border-default py-3 text-center text-body text-text-secondary">
          Close
        </button>
      </div>
    </div>
  );
}
