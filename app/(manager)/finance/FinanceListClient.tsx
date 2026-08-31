"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { CreateInvoiceModal } from "./CreateInvoiceModal";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
import type { InvoiceClientOption } from "./types";

export interface InvoiceListItem {
  id: string;
  invoiceRef: string;
  clientName: string;
  status: "draft" | "sent" | "overdue" | "paid" | "void";
  totalAmount: number;
  dueDate: string | null;
}

const STATUS_BADGE: Record<InvoiceListItem["status"], { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "draft" },
  sent: { label: "Sent", variant: "pending" },
  overdue: { label: "Overdue", variant: "atRisk" },
  paid: { label: "Paid", variant: "paid" },
  void: { label: "Void", variant: "notStarted" },
};

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function FinanceListClient({ invoices, clients }: { invoices: InvoiceListItem[]; clients: InvoiceClientOption[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<InvoiceListItem | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  const filtered = useMemo(
    () => (statusFilter === "all" ? invoices : invoices.filter((i) => i.status === statusFilter)),
    [invoices, statusFilter],
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

  function handleExportCsv() {
    const header = ["Client", "Reference", "Amount", "Status", "Due date"];
    const lines = filtered.map((i) =>
      [csvEscape(i.clientName), csvEscape(i.invoiceRef), i.totalAmount.toFixed(2), i.status, i.dueDate ?? ""].join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={handleExportCsv}>
          Export
        </Button>
        <CreateInvoiceModal clients={clients} />
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

      <div className="mt-4 flex items-center justify-between rounded-[10px] border border-ai-blue-border bg-ai-blue-light py-3 px-3.5">
        <p className="flex items-start gap-1.5 text-body text-ai-blue-text">
          <i className="ti ti-sparkles mt-0.5 shrink-0 text-[14px] text-nhs-blue" aria-hidden="true" />
          AI can pre-populate a draft invoice based on visits completed for any client this month. You always review it before it goes out.
        </p>
        <CreateInvoiceModal clients={clients} label="Try it" />
      </div>

      {previewInvoiceId ? (
        <InvoicePreviewModal
          invoiceId={previewInvoiceId}
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
