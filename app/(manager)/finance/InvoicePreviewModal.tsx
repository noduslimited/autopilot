"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { generateInvoicePdf } from "@/lib/pdf/generateInvoicePdf";
import type { LineItem, OrgInvoiceSettings } from "./types";

interface InvoiceData {
  invoiceRef: string;
  clientName: string;
  clientAddress: string;
  nokEmail: string | null;
  orgName: string;
  lineItems: LineItem[];
  dueDate: string | null;
  status: string;
}

export function InvoicePreviewModal({
  invoiceId,
  orgSettings,
  onClose,
}: {
  invoiceId: string;
  orgSettings: OrgInvoiceSettings;
  onClose: () => void;
}) {
  const [data, setData] = useState<InvoiceData | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentConfirmation, setSentConfirmation] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: invoice } = await supabase
        .from("invoices")
        .select("invoice_ref, line_items, due_date, status, clients(first_name, last_name, address, nok_email), organisations(name)")
        .eq("id", invoiceId)
        .single();

      if (!invoice || cancelled) return;
      const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
      const org = Array.isArray(invoice.organisations) ? invoice.organisations[0] : invoice.organisations;

      const items = (invoice.line_items as unknown as LineItem[]) ?? [];
      setData({
        invoiceRef: invoice.invoice_ref,
        clientName: client ? `${client.first_name} ${client.last_name}` : "Unknown",
        clientAddress: client?.address ?? "",
        nokEmail: client?.nok_email ?? null,
        orgName: org?.name ?? "",
        lineItems: items,
        dueDate: invoice.due_date,
        status: invoice.status,
      });
      setLineItems(items);
      setDueDate(invoice.due_date ?? "");
      setEmail(client?.nok_email ?? "");
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  function updateLineItem(index: number, patch: { description?: string; quantity?: number; unit_price?: number }) {
    setLineItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        const description = patch.description ?? item.description;
        const quantity = patch.quantity ?? item.quantity;
        const unit_price = patch.unit_price ?? item.unit_price;
        const updated: LineItem = { description, quantity, unit_price, total: Math.round(quantity * unit_price * 100) / 100 };
        return updated;
      }),
    );
  }

  const total = lineItems.reduce((sum, item) => sum + item.total, 0);

  async function handleSaveEdits() {
    const supabase = createClient();
    await supabase
      .from("invoices")
      .update({ line_items: lineItems, subtotal: total, total_amount: total, due_date: dueDate || null })
      .eq("id", invoiceId);
  }

  async function handleDownloadPdf() {
    if (!data) return;
    setDownloading(true);
    await handleSaveEdits();
    generateInvoicePdf({
      invoiceRef: data.invoiceRef,
      orgName: data.orgName,
      clientName: data.clientName,
      clientAddress: data.clientAddress,
      lineItems,
      total,
      dueDate: dueDate || null,
      status: data.status,
      bankName: orgSettings.bankName,
      sortCode: orgSettings.sortCode,
      accountNumber: orgSettings.accountNumber,
      paymentTerms: orgSettings.paymentTerms,
    });
    setDownloading(false);
  }

  async function handleSend() {
    if (!email.trim()) {
      setError("Enter an email address to send the invoice to.");
      return;
    }

    setSending(true);
    setError(null);
    await handleSaveEdits();

    const response = await fetch("/api/finance/send-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, email: email.trim() }),
    }).catch(() => null);

    setSending(false);

    if (!response || !response.ok) {
      setError("Could not send this invoice. Please try again.");
      return;
    }

    setSentConfirmation(`Invoice ${data?.invoiceRef} sent to ${email.trim()}`);
  }

  return (
    <Modal open onClose={onClose}>
      {loading || !data ? (
        <p className="text-body text-text-secondary">Loading invoice…</p>
      ) : sentConfirmation ? (
        <div className="space-y-3">
          <h2 className="text-section-heading text-text-primary">Invoice sent</h2>
          <p className="text-body text-text-secondary">{sentConfirmation}</p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-section-heading text-text-primary">Review invoice</h2>

          <div className="rounded-input border border-border-default p-4">
            <div className="flex justify-between">
              <div>
                <p className="text-body font-medium text-text-primary">{data.orgName}</p>
                <p className="mt-2 text-secondary text-text-secondary">Bill to</p>
                <p className="text-body text-text-primary">{data.clientName}</p>
                <p className="text-secondary text-text-secondary">{data.clientAddress}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-body font-medium text-nhs-blue">{data.invoiceRef}</p>
              </div>
            </div>

            <table className="mt-4 w-full border-collapse">
              <thead>
                <tr className="border-b border-border-default text-left text-label text-text-secondary">
                  <th className="py-1.5">Description</th>
                  <th className="py-1.5 text-right">Hours</th>
                  <th className="py-1.5 text-right">Rate</th>
                  <th className="py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => (
                  <tr key={i} className="border-b border-border-default last:border-b-0">
                    <td className="py-1.5">
                      <Input value={item.description} onChange={(e) => updateLineItem(i, { description: e.target.value })} />
                    </td>
                    <td className="py-1.5 w-20">
                      <Input
                        type="number"
                        step="0.25"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(i, { quantity: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-1.5 w-24">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(i, { unit_price: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-1.5 w-20 text-right text-body text-text-primary">£{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex justify-end">
              <p className="text-body font-medium text-text-primary">Total: £{total.toFixed(2)}</p>
            </div>

            <div className={["mt-3 grid gap-3", orgSettings.sendViaApp ? "grid-cols-2" : "grid-cols-1"].join(" ")}>
              <div>
                <p className="text-label text-text-secondary">Due date</p>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
              </div>
              {orgSettings.sendViaApp ? (
                <div>
                  <p className="text-label text-text-secondary">Send to</p>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
                </div>
              ) : null}
            </div>

            {orgSettings.bankName || orgSettings.sortCode || orgSettings.accountNumber ? (
              <div className="mt-3 border-t border-border-default pt-3 text-secondary text-text-secondary">
                <p className="text-label text-text-secondary">Payment details</p>
                {orgSettings.bankName ? <p className="mt-1">Account name: {orgSettings.bankName}</p> : null}
                {orgSettings.sortCode ? <p>Sort code: {orgSettings.sortCode}</p> : null}
                {orgSettings.accountNumber ? <p>Account number: {orgSettings.accountNumber}</p> : null}
              </div>
            ) : null}

            {orgSettings.sendViaApp && orgSettings.customMessage ? (
              <div className="mt-3 rounded-input bg-page-bg p-2.5 text-secondary text-text-secondary">
                <p className="text-label text-text-secondary">Message included with this invoice</p>
                <p className="mt-1">{orgSettings.customMessage}</p>
              </div>
            ) : null}
          </div>

          {!orgSettings.sendViaApp ? (
            <p className="text-body text-text-secondary">
              Sending invoices through Autopilot is turned off — download this invoice as a PDF and send it yourself.
            </p>
          ) : null}

          {error ? <p className="text-body text-nhs-red">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant={orgSettings.sendViaApp ? "secondary" : "primary"} onClick={handleDownloadPdf} loading={downloading}>
              {downloading ? "Downloading…" : "Download PDF"}
            </Button>
            {orgSettings.sendViaApp ? (
              <Button type="button" onClick={handleSend} loading={sending}>
                {sending ? "Sending…" : "Send invoice"}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
