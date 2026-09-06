"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Select, FieldLabel } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
import type { InvoiceClientOption, LineItem, OrgInvoiceSettings } from "./types";

function startOfMonthISODate(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function hoursBetween(start: string, end: string): number {
  return Math.round(((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60)) * 100) / 100;
}

// Gokul, direct request 2026-09-03 — Finance overhaul item 9.2: line
// items broken down day-by-day (not one line for the whole period).
// Groups same-day visits into a single row (summing hours) rather than
// one row per visit — a client with two visits on the same day gets one
// clear daily line, matching "date, hours, rate, daily total" exactly.
function buildDailyLineItems(
  visits: { scheduled_start: string; scheduled_end: string; check_in_time: string | null; check_out_time: string | null }[],
): LineItem[] {
  const hoursByDate = new Map<string, number>();
  for (const v of visits) {
    const start = v.check_in_time ?? v.scheduled_start;
    const end = v.check_out_time ?? v.scheduled_end;
    const dateKey = start.slice(0, 10);
    hoursByDate.set(dateKey, (hoursByDate.get(dateKey) ?? 0) + hoursBetween(start, end));
  }
  return Array.from(hoursByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, hours]) => ({
      description: `Care visit — ${new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      quantity: Math.round(hours * 100) / 100,
      unit_price: 0,
      total: 0,
    }));
}

export function CreateInvoiceModal({
  clients,
  orgSettings,
  label = "Create invoice",
}: {
  clients: InvoiceClientOption[];
  orgSettings: OrgInvoiceSettings;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [fromDate, setFromDate] = useState(startOfMonthISODate());
  const [toDate, setToDate] = useState(todayISODate());
  const [dueDate, setDueDate] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setClientId("");
    setFromDate(startOfMonthISODate());
    setToDate(todayISODate());
    setDueDate("");
    setLineItems([]);
    setError(null);
  }

  async function loadVisitsForRange(targetClientId: string, from: string, to: string) {
    if (!targetClientId) return;
    setLoadingVisits(true);
    const supabase = createClient();
    const { data: visits } = await supabase
      .from("visits")
      .select("scheduled_start, scheduled_end, check_in_time, check_out_time")
      .eq("client_id", targetClientId)
      .eq("status", "completed")
      .gte("scheduled_start", `${from}T00:00:00`)
      .lt("scheduled_start", `${to}T23:59:59.999`)
      .order("scheduled_start");

    // Rate isn't stored anywhere in the schema (clients/staff/orgs have no
    // hourly_rate field) — pre-populate description and hours from real
    // visit data, leave the rate at 0 for the manager to fill in rather
    // than fabricate a number the app has no source for.
    setLineItems(buildDailyLineItems(visits ?? []));
    setLoadingVisits(false);
  }

  async function handleClientChange(newClientId: string) {
    setClientId(newClientId);
    setLineItems([]);
    await loadVisitsForRange(newClientId, fromDate, toDate);
  }

  async function handleDateRangeChange(newFrom: string, newTo: string) {
    setFromDate(newFrom);
    setToDate(newTo);
    if (clientId) await loadVisitsForRange(clientId, newFrom, newTo);
  }

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

  function addLineItem() {
    setLineItems((current) => [...current, { description: "", quantity: 1, unit_price: 0, total: 0 }]);
  }

  function removeLineItem(index: number) {
    setLineItems((current) => current.filter((_, i) => i !== index));
  }

  // Gokul, direct request 2026-09-03 — item 9.3: no separate "save as
  // draft" action any more. Generating an invoice always goes straight
  // into the review screen (InvoicePreviewModal), where the only actions
  // are downloading it or (if the org has that turned on) emailing it —
  // there's no longer a silent "save and come back later" state a
  // manager could lose track of. The row still gets created with
  // status: "draft" internally (needed for a real invoice_ref, generated
  // by the same DB trigger every other invoice uses) — "draft" here is
  // just the pre-send/pre-download status, not a manager-facing action.
  async function handleGenerate() {
    if (!clientId || lineItems.length === 0) {
      setError("Select a client with completed visits in this period, or add a line item manually.");
      return;
    }

    setSaving(true);
    setError(null);

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: managerRow } = await supabase.from("users").select("org_id").eq("id", user!.id).single();

    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        org_id: managerRow!.org_id,
        invoice_ref: "",
        client_id: clientId,
        status: "draft",
        line_items: lineItems,
        subtotal,
        vat_amount: 0,
        total_amount: subtotal,
        due_date: dueDate || null,
        created_by: user!.id,
      })
      .select("id")
      .single();

    setSaving(false);

    if (insertError || !invoice) {
      setError("Could not create this invoice. Please try again.");
      return;
    }

    setPreviewInvoiceId(invoice.id);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{label}</Button>

      <Modal open={open} onClose={close}>
        <div className="space-y-3">
          <h2 className="text-section-heading text-text-primary">Create invoice</h2>
          <div>
            <FieldLabel required>Client</FieldLabel>
            <Select required value={clientId} onChange={(e) => handleClientChange(e.target.value)}>
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>From date</FieldLabel>
              <Input type="date" required value={fromDate} onChange={(e) => handleDateRangeChange(e.target.value, toDate)} />
            </div>
            <div>
              <FieldLabel required>To date</FieldLabel>
              <Input type="date" required value={toDate} min={fromDate} onChange={(e) => handleDateRangeChange(fromDate, e.target.value)} />
            </div>
          </div>

          {loadingVisits ? <p className="text-body text-text-secondary">Loading visits for this period…</p> : null}

          {clientId && !loadingVisits ? (
            <div>
              <FieldLabel>Line items — one row per day</FieldLabel>
              {lineItems.length === 0 ? (
                <p className="text-body text-text-secondary">No completed visits found in this period. Add a line item manually.</p>
              ) : null}
              <div className="max-h-[260px] space-y-2 overflow-y-auto">
                {lineItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_60px_70px_70px_auto] items-center gap-1.5">
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(i, { description: e.target.value })}
                      placeholder="Description"
                    />
                    <Input
                      type="number"
                      step="0.25"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(i, { quantity: Number(e.target.value) || 0 })}
                      title="Hours"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(i, { unit_price: Number(e.target.value) || 0 })}
                      title="Rate (£/hr)"
                    />
                    <span className="text-body text-text-primary">£{item.total.toFixed(2)}</span>
                    <button type="button" onClick={() => removeLineItem(i)} aria-label="Remove line item">
                      <i className="ti ti-x text-[14px] text-text-muted" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addLineItem} className="mt-1.5 text-body text-nhs-blue">
                + Add line item
              </button>
              <p className="mt-2 text-right text-body font-medium text-text-primary">
                Total: £{lineItems.reduce((s, i) => s + i.total, 0).toFixed(2)}
              </p>
            </div>
          ) : null}

          <div>
            <FieldLabel>Due date</FieldLabel>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          {error ? <p className="text-body text-nhs-red">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="button" onClick={handleGenerate} loading={saving}>
              {saving ? "Generating…" : "Generate invoice"}
            </Button>
          </div>
        </div>
      </Modal>

      {previewInvoiceId ? (
        <InvoicePreviewModal
          invoiceId={previewInvoiceId}
          orgSettings={orgSettings}
          onClose={() => {
            setPreviewInvoiceId(null);
            close();
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
