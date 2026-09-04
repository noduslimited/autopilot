import { createClient } from "@/lib/supabase/server";
import { InvoicingDefaultsForm } from "./InvoicingDefaultsForm";

// Source: PRD section 4.10 (Billing — Invoicing defaults)
export default async function InvoicingSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: managerRow } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
  const { data: org } = await supabase
    .from("organisations")
    .select(
      "id, org_code, invoice_bank_name, invoice_sort_code, invoice_account_number, invoice_payment_terms, invoice_company_number, invoice_vat_number, invoice_send_via_app, invoice_custom_message",
    )
    .eq("id", managerRow!.org_id)
    .single();

  if (!org) return null;

  return <InvoicingDefaultsForm org={org} />;
}
