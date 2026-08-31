"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, FieldLabel } from "@/components/ui/Input";

interface InvoicingOrg {
  id: string;
  org_code: string;
  invoice_bank_name: string | null;
  invoice_sort_code: string | null;
  invoice_account_number: string | null;
  invoice_payment_terms: number;
  invoice_company_number: string | null;
  invoice_vat_number: string | null;
}

export function InvoicingDefaultsForm({ org }: { org: InvoicingOrg }) {
  const router = useRouter();
  const [form, setForm] = useState({
    bankName: org.invoice_bank_name ?? "",
    sortCode: org.invoice_sort_code ?? "",
    accountNumber: org.invoice_account_number ?? "",
    paymentTerms: String(org.invoice_payment_terms),
    companyNumber: org.invoice_company_number ?? "",
    vatNumber: org.invoice_vat_number ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [savedConfirmation, setSavedConfirmation] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("organisations")
      .update({
        invoice_bank_name: form.bankName.trim() || null,
        invoice_sort_code: form.sortCode.trim() || null,
        invoice_account_number: form.accountNumber.trim() || null,
        invoice_payment_terms: Number(form.paymentTerms) || 30,
        invoice_company_number: form.companyNumber.trim() || null,
        invoice_vat_number: form.vatNumber.trim() || null,
      })
      .eq("id", org.id);
    setSaving(false);
    setSavedConfirmation(true);
    router.refresh();
  }

  return (
    <div className="rounded-card border border-border-default bg-card-bg py-4 px-5">
      <h1 className="text-page-heading text-text-primary">Invoicing defaults</h1>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>Invoice prefix</FieldLabel>
          <Input value={`${org.org_code}-INV-`} disabled />
        </div>
        <div>
          <FieldLabel>Default payment terms (days)</FieldLabel>
          <Input
            type="number"
            value={form.paymentTerms}
            onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
          />
        </div>
        <div>
          <FieldLabel>Bank account name</FieldLabel>
          <Input value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
        </div>
        <div>
          <FieldLabel>Sort code</FieldLabel>
          <Input value={form.sortCode} onChange={(e) => setForm((f) => ({ ...f, sortCode: e.target.value }))} />
        </div>
        <div>
          <FieldLabel>Account number</FieldLabel>
          <Input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} />
        </div>
        <div>
          <FieldLabel>Company registration number</FieldLabel>
          <Input value={form.companyNumber} onChange={(e) => setForm((f) => ({ ...f, companyNumber: e.target.value }))} />
        </div>
        <div>
          <FieldLabel>VAT number (optional)</FieldLabel>
          <Input value={form.vatNumber} onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))} />
        </div>
      </div>

      {savedConfirmation ? <p className="mt-3 text-body text-success-green-text">Changes saved.</p> : null}

      <div className="mt-4 border-t border-border-default pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
