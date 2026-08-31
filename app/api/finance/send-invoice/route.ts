import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import type { LineItem } from "@/app/(manager)/finance/types";

// Source: PRD section 4.7 ("Review & send" flow). CLAUDE.md rule 4: no
// invoice is ever sent without explicit manager action — this route only
// ever fires from the manager clicking "Send invoice" in the preview
// modal, never automatically.
interface SendInvoiceBody {
  invoiceId: string;
  email: string;
}

function isSendInvoiceBody(value: unknown): value is SendInvoiceBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return typeof body.invoiceId === "string" && typeof body.email === "string";
}

function renderInvoiceHtml(orgName: string, clientName: string, invoiceRef: string, lineItems: LineItem[], total: number, dueDate: string | null): string {
  const rows = lineItems
    .map(
      (item) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;">${item.description}</td><td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;text-align:right;">${item.quantity}</td><td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;text-align:right;">£${item.unit_price.toFixed(2)}</td><td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;text-align:right;">£${item.total.toFixed(2)}</td></tr>`,
    )
    .join("");

  return `
    <h2>Invoice ${invoiceRef}</h2>
    <p>From ${orgName}, for care provided to ${clientName}.</p>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #111827;">Description</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #111827;">Hours</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #111827;">Rate</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #111827;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="text-align:right;font-weight:bold;">Total due: £${total.toFixed(2)}</p>
    ${dueDate ? `<p>Due date: ${new Date(dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>` : ""}
    <p>Payment should be made directly to ${orgName} by bank transfer or card reader, as arranged.</p>
  `;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isSendInvoiceBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: managerRow } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!managerRow || managerRow.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_ref, line_items, total_amount, due_date, clients(first_name, last_name), organisations(name)")
    .eq("id", body.invoiceId)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
  const org = Array.isArray(invoice.organisations) ? invoice.organisations[0] : invoice.organisations;
  const clientName = client ? `${client.first_name} ${client.last_name}` : "the client";

  const html = renderInvoiceHtml(
    org?.name ?? "Care provider",
    clientName,
    invoice.invoice_ref,
    (invoice.line_items as unknown as LineItem[]) ?? [],
    Number(invoice.total_amount),
    invoice.due_date,
  );

  const sent = await sendEmail({ to: body.email, subject: `Invoice ${invoice.invoice_ref}`, html });

  if (!sent) {
    return NextResponse.json({ error: "Could not send the invoice email." }, { status: 502 });
  }

  await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString(), sent_to_email: body.email })
    .eq("id", body.invoiceId);

  return NextResponse.json({ success: true });
}
