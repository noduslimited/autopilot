"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { generateInvoiceListPdf } from "@/lib/pdf/generateInvoiceListPdf";
import { generateInvoicePdf } from "@/lib/pdf/generateInvoicePdf";
import { CreateInvoiceModal } from "./CreateInvoiceModal";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
import type { InvoiceClientOption, LineItem, OrgInvoiceSettings } from "./types";

export interface InvoiceListItem {
  id: string;
  invoiceRef: string;
  clientName: string;
  status: "draft" | "sent" | "overdue" | "paid" | "void";
  totalAmount: number;
  dueDate: string | null;
  sentAt: string | null;
  sentToEmail: string | null;
}

const STATUS_BADGE: Record<InvoiceListItem["status"], { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "draft" },
  sent: { label: "Sent", variant: "pending" },
  overdue: { label: "Overdue", variant: "atRisk" },
  paid: { label: "Paid", variant: "paid" },
  void: { label: "Void", variant: "notStarted" },
};

export function FinanceListClient({
  invoices,
  clients,
  orgSettings,
}: {
  invoices: InvoiceListItem[];
  clients: InvoiceClientOption[];
  orgSettings: OrgInvoiceSettings;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<InvoiceListItem | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (statusFilter === "all" ? invoices : invoices.filter((i) => i.status === statusFilter)),
    [invoices, statusFilter],
  );

  const sentHistory = useMemo(
    () => invoices.filter((i) => i.sentAt).sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? "")),
    [invoices],
  );

  async function handleMarkPaid() {
    if (!markPaidTarget) return;
    setMarkingPaid(true);
    const supabase = createClient();
    await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", markPaidTarget.id);
    setMarkingPaid(false);
    setMarkPaidTarget(null);
    router.refresh();
  }

  function handleExportPdf() {
    generateInvoiceListPdf(
      filtered.map((i) => ({ clientName: i.clientName, invoiceRef: i.invoiceRef, totalAmount: i.totalAmount, status: i.status, dueDate: i.dueDate })),
    );
  }

  async function handleDownloadInvoicePdf(invoice: InvoiceListItem) {
    setDownloadingId(invoice.id);
    const supabase = createClient();
    const { data } = await supabase.from("invoices").select("line_items, due_date, status").eq("id", invoice.id).single();
    setDownloadingId(null);
    if (!data) return;
    generateInvoicePdf({
      invoiceRef: invoice.invoiceRef,
      orgName: orgSettings.orgName,
      clientName: invoice.clientName,
      clientAddress: "",
      lineItems: (data.line_items as unknown as LineItem[]) ?? [],
      total: invoice.totalAmount,
      dueDate: data.due_date,
      status: data.status,
      bankName: orgSettings.bankName,
      sortCode: orgSettings.sortCode,
      accountNumber: orgSettings.accountNumber,
      paymentTerms: orgSettings.paymentTerms,
    });
  }

  return (
    <div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={handleExportPdf}>
          Export
        </Button>
        <CreateInvoiceModal clients={clients} orgSettings={orgSettings} />
      </div>

      <div className="mt-4 rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-subsection-heading text-text-primary">Invoices</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-input border border-border-default bg-card-bg px-3 py-[7px] text-body text-text-primary outline-none"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-4 text-body text-text-secondary">No invoices yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-border-default text-left text-label text-text-secondary">
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((invoice) => {
                  const badge = STATUS_BADGE[invoice.status];
                  return (
                    <tr key={invoice.id} className="border-b border-border-default last:border-b-0">
                      <td className="py-2.5 pr-4 text-body font-medium text-text-primary">{invoice.clientName}</td>
                      <td className="py-2.5 pr-4 font-mono text-secondary text-nhs-blue">
                        {invoice.status === "draft" ? invoice.invoiceRef.replace(/-\d+$/, "-DRAFT") : invoice.invoiceRef}
                      </td>
                      <td className="py-2.5 pr-4 text-body text-text-primary">£{invoice.totalAmount.toFixed(2)}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex justify-end gap-1.5">
                          {invoice.status === "draft" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setPreviewInvoiceId(invoice.id)}
                                className="rounded-btn border border-border-default bg-card-bg px-3 py-[6px] text-[12px] font-medium text-text-primary"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setPreviewInvoiceId(invoice.id)}
                                className="rounded-btn bg-nhs-blue px-3 py-[6px] text-[12px] font-medium text-white"
                              >
                                Review & send
                              </button>
                            </>
                          ) : invoice.status === "sent" || invoice.status === "overdue" ? (
                            <>
                              <Link
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPreviewInvoiceId(invoice.id);
                                }}
                                className="rounded-btn border border-border-default bg-card-bg px-3 py-[6px] text-[12px] font-medium text-text-primary"
                              >
                                View
                              </Link>
                              <button
                                type="button"
                                onClick={() => setMarkPaidTarget(invoice)}
                                className="rounded-btn bg-success-green-text px-3 py-[6px] text-[12px] font-medium text-white"
                              >
                                Mark paid
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPreviewInvoiceId(invoice.id)}
                              className="rounded-btn border border-border-default bg-card-bg px-3 py-[6px] text-[12px] font-medium text-text-primary"
                            >
                              View
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadInvoicePdf(invoice)}
                            disabled={downloadingId === invoice.id}
                            className="rounded-btn border border-border-default bg-card-bg px-3 py-[6px] text-[12px] font-medium text-text-primary"
                          >
                            {downloadingId === invoice.id ? "…" : "PDF"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Sent invoices</h2>
        {sentHistory.length === 0 ? (
          <p className="mt-2 text-body text-text-secondary">No invoices have been sent yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-border-default text-left text-label text-text-secondary">
                  <th className="py-2 pr-4">Date sent</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {sentHistory.map((invoice) => {
                  const badge = STATUS_BADGE[invoice.status];
                  return (
                    <tr key={invoice.id} className="border-b border-border-default last:border-b-0">
                      <td className="py-2.5 pr-4 text-body text-text-primary">
                        {invoice.sentAt ? new Date(invoice.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        {invoice.sentToEmail ? <span className="block text-secondary text-text-secondary">to {invoice.sentToEmail}</span> : null}
                      </td>
                      <td className="py-2.5 pr-4 text-body font-medium text-text-primary">{invoice.clientName}</td>
                      <td className="py-2.5 pr-4 text-body text-text-primary">£{invoice.totalAmount.toFixed(2)}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoicePdf(invoice)}
                          disabled={downloadingId === invoice.id}
                          className="rounded-btn border border-border-default bg-card-bg px-3 py-[6px] text-[12px] font-medium text-text-primary"
                        >
                          {downloadingId === invoice.id ? "…" : "PDF"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-ai-blue-border bg-ai-blue-light py-3 px-3.5">
        <p className="flex items-start gap-1.5 text-body text-ai-blue-text">
          <i className="ti ti-sparkles mt-0.5 shrink-0 text-[14px] text-nhs-blue" aria-hidden="true" />
          <span>
            AI pre-fills each line with the real dates and hours from that client&apos;s completed visits this period — it never invents a rate,
            since Autopilot doesn&apos;t store one for you. You always set the rate and review every line before an invoice is sent or downloaded.
          </span>
        </p>
        <CreateInvoiceModal clients={clients} orgSettings={orgSettings} label="Try it" />
      </div>

      {previewInvoiceId ? (
        <InvoicePreviewModal
          invoiceId={previewInvoiceId}
          orgSettings={orgSettings}
          onClose={() => {
            setPreviewInvoiceId(null);
            router.refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!markPaidTarget}
        title="Mark as paid?"
        message={
          markPaidTarget
            ? `Mark ${markPaidTarget.invoiceRef} as paid? Amount: £${markPaidTarget.totalAmount.toFixed(2)}. This cannot be undone.`
            : ""
        }
        confirmLabel={markingPaid ? "Marking…" : "Mark paid"}
        onConfirm={handleMarkPaid}
        onCancel={() => setMarkPaidTarget(null)}
      />
    </div>
  );
}
