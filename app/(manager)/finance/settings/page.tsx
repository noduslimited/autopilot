import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InvoicingDefaultsForm } from "../../settings/invoicing/InvoicingDefaultsForm";

// Source: Gokul, direct request 2026-09-03 — Finance overhaul item 9.7
// ("invoicing settings accessible directly from Finance, not buried in
// Settings"). Reuses the exact same InvoicingDefaultsForm /settings/
// invoicing already has — one shared data source, two entry points.
export default async function FinanceSettingsPage() {
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

  return (
    <div className="p-5">
      <Link href="/finance" className="inline-flex items-center gap-1 text-secondary text-nhs-blue">
        <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
        Back to Finance
      </Link>
      <div className="mt-3">
        <InvoicingDefaultsForm org={org} />
      </div>
    </div>
  );
}
