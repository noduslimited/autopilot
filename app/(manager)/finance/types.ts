export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  // Index signature so this satisfies Supabase's Json type when writing
  // to the invoices.line_items jsonb column.
  [key: string]: string | number;
}

export interface InvoiceClientOption {
  id: string;
  first_name: string;
  last_name: string;
}
