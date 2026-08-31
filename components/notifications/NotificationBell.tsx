"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Source: Sessions.md Session 12 steps 5-7. Sessions.md's own "Must be
// achieved" list places this in the manager sidebar ("In-app notification
// bell in manager sidebar showing unread count with real-time updates")
// — the approved dashboard mockup (01_Manager_Dashboard.png) doesn't show
// a bell anywhere at all, and the PRD's "dashboard header" wording has no
// literal shared header component to attach to (every manager page has
// been built with its own inline heading since Session 4, not a shared
// app-wide header bar) — Sessions.md's more specific, more recent
// instruction wins here, per the same reasoning used for prior
// mockup/text conflicts.
interface NotificationItem {
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

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    setItems(data ?? []);
  }

  useEffect(() => {
    void load();
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        void load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = items.filter((item) => !item.read).length;

  async function markRead(item: NotificationItem) {
    if (!item.read) {
      const supabase = createClient();
      await supabase.from("notifications").update({ read: true }).eq("id", item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    }
    setOpen(false);
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
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen((prev) => !prev)} className="relative flex h-8 w-8 items-center justify-center rounded-btn text-nhs-light-blue" aria-label="Notifications">
        <i className="ti ti-bell text-[18px]" aria-hidden="true" />
        {unreadCount > 0 ? <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-nhs-red" /> : null}
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-[420px] w-[340px] overflow-y-auto rounded-card border border-border-default bg-card-bg shadow-modal">
          <div className="flex items-center justify-between border-b border-border-default px-3.5 py-2.5">
            <p className="text-body font-medium text-text-primary">Notifications</p>
            {unreadCount > 0 ? (
              <button type="button" onClick={markAllRead} className="text-secondary text-nhs-blue">
                Mark all as read
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-body text-text-secondary">No notifications yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border-default">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markRead(item)}
                  className={["px-3.5 py-2.5 text-left", item.read ? "bg-card-bg" : "bg-ai-blue-light"].join(" ")}
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
      ) : null}
    </div>
  );
}
