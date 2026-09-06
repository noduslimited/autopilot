import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sendEmail } from "@/lib/resend/client";

// Source: PRD section 8.1 (7 notification types) + 8.2 ("Manager can
// configure which types in Settings → Notifications") + Sessions.md
// Session 12 step 8 ("for each notification insert, check org
// notification settings and send via Resend if enabled"). Single shared
// entry point for every notification-writing call site in the app, so
// email-sending behaviour is consistent everywhere rather than
// reimplemented per trigger.
export type NotificationType =
  | "incident_filed"
  | "shift_swap"
  | "family_message"
  | "training_expiry"
  | "dbs_expiry"
  | "invoice_overdue"
  | "unassigned_visit"
  | "care_plan_updated"
  | "message_from_care_team"
  | "visit_wellbeing_concern"
  | "shift_assigned"
  | "shift_changed"
  | "shift_cancelled"
  | "shift_reminder"
  | "shift_request_created"
  | "shift_request_response";

// Only 5 of the 7 types have a corresponding email toggle — Session 8's
// Settings → Notifications page never built shift_swap/family_message
// toggles, so those two are in-app-bell-only, matching what's actually
// on that page rather than inventing new settings UI here.
const EMAIL_TOGGLE_KEY: Partial<Record<NotificationType, string>> = {
  incident_filed: "incident_filed_by_carer",
  training_expiry: "training_expiry_alerts",
  dbs_expiry: "dbs_expiry_alerts",
  invoice_overdue: "invoice_overdue",
  unassigned_visit: "unassigned_visit_alerts",
};

interface NotifyParams {
  orgId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  link: string;
}

export async function notifyAndMaybeEmail(admin: SupabaseClient<Database>, { orgId, userIds, type, title, body, link }: NotifyParams): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) return;

  await admin.from("notifications").insert(
    uniqueUserIds.map((userId) => ({
      org_id: orgId,
      user_id: userId,
      type,
      title,
      body,
      link,
    })),
  );

  const toggleKey = EMAIL_TOGGLE_KEY[type];
  if (!toggleKey) return; // in-app only — no email variant for this type

  const { data: org } = await admin.from("organisations").select("notification_settings").eq("id", orgId).single();
  const settings = (org?.notification_settings ?? {}) as Record<string, boolean>;
  if (!settings[toggleKey]) return;

  const { data: recipients } = await admin.from("users").select("email, first_name").in("id", uniqueUserIds);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Found 2026-09-06 during the performance pass: this was a sequential
  // await-in-loop, blocking the caller's whole API response (e.g. Report
  // Incident's submit button) on N one-at-a-time Resend round trips. Every
  // recipient's email is independent, so they run in parallel instead —
  // real impact scales with org manager count, but even the common
  // single-recipient case removes one avoidable serial hop.
  await Promise.all(
    (recipients ?? []).map((recipient) =>
      sendEmail({
        to: recipient.email,
        subject: title,
        html: `<p>Hi ${recipient.first_name},</p><p>${body}</p><p><a href="${appUrl}${link}">View in Autopilot</a></p>`,
      }),
    ),
  );
}
