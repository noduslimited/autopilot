import { createClient } from "@/lib/supabase/server";
import { FinanceListClient, type InvoiceListItem } from "./FinanceListClient";

// Source: PRD section 4.7 (Finance)

function startOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

const MONTH_LABEL = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export default async function FinancePage() {
  const supabase = await createClient();

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("id, invoice_ref, status, total_amount, due_date, created_at, client_id, clients(first_name, last_name)")
    .order("created_at", { ascending: false });

  const { data: clients } = await supabase.from("clients").select("id, first_name, last_name").eq("status", "active").order("first_name");

  const rows = invoiceRows ?? [];
  const monthStart = startOfMonthUTC();

  const invoicedThisMonth = rows
    .filter((r) => new Date(r.created_at) >= monthStart)
    .reduce((sum, r) => sum + Number(r.total_amount), 0);
  const awaitingPayment = rows
    .filter((r) => r.status === "sent" || r.status === "overdue")
    .reduce((sum, r) => sum + Number(r.total_amount), 0);
  const confirmedPaid = rows.filter((r) => r.status === "paid").reduce((sum, r) => sum + Number(r.total_amount), 0);
  const draftCount = rows.filter((r) => r.status === "draft").length;
  const unpaidCount = rows.filter((r) => r.status === "sent" || r.status === "overdue").length;

  const invoices: InvoiceListItem[] = rows.map((r) => {
    const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
    return {
      id: r.id,
      invoiceRef: r.invoice_ref,
      clientName: client ? `${client.first_name} ${client.last_name}` : "Unknown",
      status: r.status as "draft" | "sent" | "overdue" | "paid" | "void",
      totalAmount: Number(r.total_amount),
      dueDate: r.due_date,
    };
  });

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-page-heading text-text-primary">Finance</h1>
          <p className="mt-1 text-secondary text-text-secondary">
            {MONTH_LABEL} · {unpaidCount} invoice{unpaidCount === 1 ? "" : "s"} unpaid
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-card border border-amber-text/20 bg-amber-light py-2.5 px-4 text-body text-amber-text">
        Autopilot helps you prepare and track invoices. No invoice is ever sent without your review and approval. Payments are collected by
        your business directly (bank transfer or card reader).
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">Invoiced this month</p>
          <p className="mt-1 text-section-heading text-text-primary">£{invoicedThisMonth.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">Awaiting payment</p>
          <p className={["mt-1 text-section-heading", awaitingPayment > 0 ? "text-nhs-red" : "text-text-primary"].join(" ")}>
            £{awaitingPayment.toLocaleString("en-GB", { minimumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">Confirmed paid</p>
          <p className="mt-1 text-section-heading text-success-green-text">
            £{confirmedPaid.toLocaleString("en-GB", { minimumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">Draft (not sent)</p>
          <p className="mt-1 text-section-heading text-text-primary">{draftCount}</p>
        </div>
      </div>

      <FinanceListClient invoices={invoices} clients={clients ?? []} />
    </div>
  );
}
