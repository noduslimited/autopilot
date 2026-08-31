// Source: CLAUDE.md section 16a — carer shift notifications via Web
// Push, directed by Gokul ahead of Session 12, replacing the PRD's
// original email-based shift notification.
//
// Invoked every 15 minutes by pg_cron (see migration
// 20260907090200_shift_notifications_cron.sql), which calls this
// function over HTTP via pg_net. Finds shifts starting in ~60 minutes,
// ~15 minutes, or now, and sends a Web Push notification to every
// device the assigned carer has subscribed from.
//
// Timing math (seconds until each shift's start, correctly handling
// BST/GMT) is done in Postgres via get_shift_notification_candidates()
// — see that migration's comment for why. This function only buckets
// the returned seconds_until_start values into the three target windows
// and handles dedup + sending.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const HALF_WINDOW_SECONDS = 450; // 7.5 min — half the 15-min cron interval

const STAGES: Array<{ stage: "t60" | "t15" | "t0"; targetSeconds: number; body: string }> = [
  { stage: "t60", targetSeconds: 3600, body: "Your shift starts in 1 hour." },
  { stage: "t15", targetSeconds: 900, body: "Your shift starts in 15 minutes." },
  { stage: "t0", targetSeconds: 0, body: "Your shift is starting now." },
];

interface ShiftCandidate {
  shift_id: string;
  staff_id: string;
  org_id: string;
  seconds_until_start: number;
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  webpush.setVapidDetails("mailto:support@noduslimited.co.uk", vapidPublicKey, vapidPrivateKey);

  const { data: candidates, error } = await supabase.rpc("get_shift_notification_candidates");
  if (error) {
    console.error("get_shift_notification_candidates failed:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  for (const shift of (candidates ?? []) as ShiftCandidate[]) {
    for (const { stage, targetSeconds, body } of STAGES) {
      if (Math.abs(shift.seconds_until_start - targetSeconds) > HALF_WINDOW_SECONDS) continue;

      // Atomic dedup: only proceed if this (shift, stage) hasn't been
      // logged before. Safe against overlapping/retried runs.
      const { data: inserted, error: logError } = await supabase
        .from("shift_notification_log")
        .insert({ shift_id: shift.shift_id, stage })
        .select("id")
        .maybeSingle();

      if (logError || !inserted) {
        skipped += 1;
        continue;
      }

      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", shift.staff_id);

      for (const sub of subscriptions ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({ title: "Autopilot", body, url: "/schedule" }),
          );
          sent += 1;
        } catch (sendError) {
          const statusCode = (sendError as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription expired or was revoked — remove it so future
            // runs don't keep retrying a dead endpoint.
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error("push send failed:", sendError);
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent, skipped }), { headers: { "Content-Type": "application/json" } });
});
