import { newBrandedDoc, ensureSpace, PAGE_MARGIN, PAGE_WIDTH } from "./pdfHelpers";

export interface InvoiceListPdfRow {
  clientName: string;
  invoiceRef: string;
  totalAmount: number;
  status: string;
  dueDate: string | null;
}

// Replaces Finance's old CSV Blob export — Gokul, direct request
// 2026-09-03: "Export button and all report downloads must produce
// PDFs, not CSV/print."
export function generateInvoiceListPdf(rows: InvoiceListPdfRow[]): void {
  const { doc, y: startY } = newBrandedDoc("Invoices", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
  let y = startY;

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text("Client", PAGE_MARGIN, y);
  doc.text("Reference", PAGE_MARGIN + 55, y);
  doc.text("Status", PAGE_MARGIN + 100, y);
  doc.text("Due", PAGE_MARGIN + 130, y);
  doc.text("Amount", PAGE_WIDTH - PAGE_MARGIN, y, { align: "right" });
  y += 2;
  doc.setDrawColor(229, 231, 235);
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
  y += 5.5;

  doc.setTextColor(17, 24, 39);
  for (const row of rows) {
    y = ensureSpace(doc, y, 8);
    doc.text(row.clientName, PAGE_MARGIN, y);
    doc.text(row.invoiceRef, PAGE_MARGIN + 55, y);
    doc.text(row.status[0].toUpperCase() + row.status.slice(1), PAGE_MARGIN + 100, y);
    doc.text(row.dueDate ? new Date(row.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—", PAGE_MARGIN + 130, y);
    doc.text(`£${row.totalAmount.toFixed(2)}`, PAGE_WIDTH - PAGE_MARGIN, y, { align: "right" });
    y += 6;
  }

  const grandTotal = rows.reduce((sum, r) => sum + r.totalAmount, 0);
  y += 2;
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Total: £${grandTotal.toFixed(2)}`, PAGE_WIDTH - PAGE_MARGIN, y, { align: "right" });

  doc.save(`invoices-${new Date().toISOString().slice(0, 10)}.pdf`);
}
