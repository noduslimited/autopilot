// Source: Sessions.md Session 12 steps 9-11 (training expiry, DBS
// expiry, invoice overdue scheduled checks) + the "unassigned_visit"
// notification type from the same table's enum. Runs once daily via
// pg_cron (see migration 20260908090100_daily_notification_checks_cron.sql),
// same deployment pattern as the pre-Session-12 shift-notifications
// function (Vault-stored service-role key, --use-api deploy, no Docker).
//
// Each check type uses a security-definer SQL function
// (get_*_candidates(), in 20260908090000_notification_dedup_log.sql) to
// do the date/join logic in Postgres, then this function does an atomic
// dedup-insert-then-notify for each candidate — identical shape to
// shift-notifications' per-shift logic, generalised across 4 types.

import { createClient } from "npm:@supabase/supabase-js@2";

const FROM_ADDRESS = "Autopilot <support@noduslimited.co.uk>";

const EMAIL_TOGGLE_KEY: Record<string, string> = {
  training_expiry: "training_expiry_alerts",
  dbs_expiry: "dbs_expiry_alerts",
  invoice_overdue: "invoice_overdue",
  unassigned_visit: "unassigned_visit_alerts",
};

async function sendEmail(resendApiKey: string, to: string, subject: string, html: string): Promise<void> {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  }).catch((err) => console.error("sendEmail failed:", err));
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const appUrl = Deno.env.get("APP_URL") ?? "https://app.autopilot.noduslimited.co.uk";

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  async function notifyOrg(
    orgId: string,
    notificationType: string,
    title: string,
    body: string,
    link: string,
  ): Promise<void> {
    const { data: managers } = await supabase.from("users").select("id, email, first_name").eq("org_id", orgId).eq("role", "manager");
    if (!managers || managers.length === 0) return;

    await supabase.from("notifications").insert(
      managers.map((m) => ({ org_id: orgId, user_id: m.id, type: notificationType, title, body, link })),
    );

    const { data: org } = await supabase.from("organisations").select("notification_settings").eq("id", orgId).single();
    const settings = (org?.notification_settings ?? {}) as Record<string, boolean>;
    const toggleKey = EMAIL_TOGGLE_KEY[notificationType];
    if (!toggleKey || !settings[toggleKey]) return;

    for (const manager of managers) {
      await sendEmail(
        resendApiKey,
        manager.email,
        title,
        `<p>Hi ${manager.first_name},</p><p>${body}</p><p><a href="${appUrl}${link}">View in Autopilot</a></p>`,
      );
    }
  }

  async function dedupAndNotify(
    notificationType: string,
    recordId: string,
    stage: string,
    orgId: string,
    title: string,
    body: string,
    link: string,
  ): Promise<boolean> {
    const { data: inserted } = await supabase
      .from("notification_dedup_log")
      .insert({ notification_type: notificationType, record_id: recordId, stage })
      .select("id")
      .maybeSingle();
    if (!inserted) return false;
    await notifyOrg(orgId, notificationType, title, body, link);
    return true;
  }

  let notified = 0;

  // Training expiry — fires at 60, 30, and 0 days before expiry.
  const { data: trainingCandidates } = await supabase.rpc("get_training_expiry_candidates");
  for (const row of trainingCandidates ?? []) {
    const { data: staffUser } = await supabase.from("users").select("first_name, last_name").eq("id", row.staff_id).single();
    const staffName = staffUser ? `${staffUser.first_name} ${staffUser.last_name}` : "A staff member";
    const daysText = row.days_until_expiry === 0 ? "expires today" : `expires in ${row.days_until_expiry} days`;
    const ok = await dedupAndNotify(
      "training_expiry",
      row.record_id,
      `t${row.days_until_expiry}`,
      row.org_id,
      `Training expiring: ${staffName}`,
      `${staffName}'s ${row.module_label} training ${daysText} (${new Date(row.expiry_date).toLocaleDateString("en-GB")}).`,
      `/staff/${row.staff_id}?tab=training`,
    );
    if (ok) notified += 1;
  }

  // DBS expiry — fires at 30 and 0 days before expiry.
  const { data: dbsCandidates } = await supabase.rpc("get_dbs_expiry_candidates");
  for (const row of dbsCandidates ?? []) {
    const { data: staffUser } = await supabase.from("users").select("first_name, last_name").eq("id", row.staff_id).single();
    const staffName = staffUser ? `${staffUser.first_name} ${staffUser.last_name}` : "A staff member";
    const daysText = row.days_until_expiry === 0 ? "expires today" : `expires in ${row.days_until_expiry} days`;
    const ok = await dedupAndNotify(
      "dbs_expiry",
      row.record_id,
      `d${row.days_until_expiry}`,
      row.org_id,
      `DBS expiring: ${staffName}`,
      `${staffName}'s DBS certificate ${daysText}.`,
      `/staff/${row.staff_id}`,
    );
    if (ok) notified += 1;
  }

  // Invoice overdue — fires once, when due_date first passes with status
  // still 'sent'. Also flips the invoice's own status to 'overdue' (the
  // schema/Finance UI already support this status; nothing previously
  // set it — see CLAUDE.md Session 12 log).
  const { data: invoiceCandidates } = await supabase.rpc("get_overdue_invoice_candidates");
  for (const row of invoiceCandidates ?? []) {
    const { data: client } = await supabase.from("clients").select("first_name, last_name").eq("id", row.client_id).single();
    const clientName = client ? `${client.first_name} ${client.last_name}` : "a client";
    const ok = await dedupAndNotify(
      "invoice_overdue",
      row.record_id,
      "overdue",
      row.org_id,
      `Invoice overdue: ${row.invoice_ref}`,
      `Invoice ${row.invoice_ref} for ${clientName} (£${row.total_amount}) is now overdue.`,
      "/finance",
    );
    if (ok) {
      await supabase.from("invoices").update({ status: "overdue" }).eq("id", row.record_id);
      notified += 1;
    }
  }

  // Unassigned visit — fires once per visit within 48 hours of its
  // scheduled start with no carer assigned.
  const { data: visitCandidates } = await supabase.rpc("get_unassigned_visit_candidates");
  for (const row of visitCandidates ?? []) {
    const { data: client } = await supabase.from("clients").select("first_name, last_name").eq("id", row.client_id).single();
    const clientName = client ? `${client.first_name} ${client.last_name}` : "a client";
    const ok = await dedupAndNotify(
      "unassigned_visit",
      row.record_id,
      "unassigned",
      row.org_id,
      `Unassigned visit: ${clientName}`,
      `${clientName}'s visit on ${new Date(row.scheduled_start).toLocaleString("en-GB")} has no carer assigned yet.`,
      "/rota",
    );
    if (ok) notified += 1;
  }

  return new Response(JSON.stringify({ notified }), { headers: { "Content-Type": "application/json" } });
});
