import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/csv";

// Source: PRD section 10 (Data Export) — the authoritative file list is
// clients / care_plans / visits / medications (eMAR) / incidents / staff
// / invoices / messages, 8 files. Plus AUD-01's own acceptance criteria
// ("Audit log export included in data export") — a 9th. Session 8's
// original version of this route only followed the Settings
// confirmation dialog's shorter summary text ("client records, visit
// logs, staff records, incidents, and invoices") and missed 4 of these —
// found and fixed while testing Session 13's acceptance criteria.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: managerRow } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!managerRow || managerRow.role !== "manager") {
    return new Response("Forbidden", { status: 403 });
  }

  const orgId = managerRow.org_id;

  const [{ data: clients }, { data: carePlans }, { data: visits }, { data: emarRecords }, { data: staffRows }, { data: incidents }, { data: invoices }, { data: messages }, { data: auditLogs }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("org_id", orgId),
      supabase.from("care_plans").select("*").eq("org_id", orgId),
      supabase.from("visits").select("*").eq("org_id", orgId),
      supabase.from("emar_records").select("*").eq("org_id", orgId),
      supabase.from("staff").select("*, users(first_name, last_name, email)").eq("org_id", orgId),
      supabase.from("incidents").select("*").eq("org_id", orgId),
      supabase.from("invoices").select("*").eq("org_id", orgId),
      supabase.from("messages").select("*").eq("org_id", orgId),
      supabase.from("audit_logs").select("*").eq("org_id", orgId),
    ]);

  const staffFlattened = (staffRows ?? []).map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const { users: _users, ...rest } = row;
    void _users;
    return { ...rest, first_name: user?.first_name ?? "", last_name: user?.last_name ?? "", email: user?.email ?? "" };
  });

  const files: { name: string; content: string }[] = [
    { name: "clients.csv", content: toCsv(clients ?? []) },
    { name: "care_plans.csv", content: toCsv(carePlans ?? []) },
    { name: "visits.csv", content: toCsv(visits ?? []) },
    { name: "medications.csv", content: toCsv(emarRecords ?? []) },
    { name: "staff.csv", content: toCsv(staffFlattened) },
    { name: "incidents.csv", content: toCsv(incidents ?? []) },
    { name: "invoices.csv", content: toCsv(invoices ?? []) },
    { name: "messages.csv", content: toCsv(messages ?? []) },
    { name: "audit_logs.csv", content: toCsv(auditLogs ?? []) },
  ];

  const passthrough = new PassThrough();
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.pipe(passthrough);

  for (const file of files) {
    archive.append(file.content || "No records.", { name: file.name });
  }
  archive.finalize();

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    passthrough.on("data", (chunk) => chunks.push(chunk));
    passthrough.on("end", () => resolve());
    passthrough.on("error", reject);
    archive.on("error", reject);
  });

  const zipBuffer = Buffer.concat(chunks);

  // SET-03's own acceptance criteria requires this action itself be logged —
  // there's no INSERT policy for regular managers on audit_logs (it's
  // trigger/service-role only, per rule 10's immutability requirement), and
  // an export isn't a row-level create/update/delete on any tracked table,
  // so this is a manual service-role insert rather than the usual trigger.
  // record_id has no real row to reference — a fresh id stands for this
  // specific export event, consistent with the column always identifying
  // "the thing that came into existence."
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    org_id: orgId,
    user_id: user.id,
    action: "create",
    table_name: "data_export",
    record_id: crypto.randomUUID(),
    new_values: { file_count: files.length },
  });

  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="autopilot-export-${new Date().toISOString().slice(0, 10)}.zip"`,
    },
  });
}
