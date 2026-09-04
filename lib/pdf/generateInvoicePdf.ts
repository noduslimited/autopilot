import { newBrandedDoc, addKeyValueLine, ensureSpace, PAGE_MARGIN, PAGE_WIDTH } from "./pdfHelpers";
import type { LineItem } from "@/app/(manager)/finance/types";

export interface InvoicePdfData {
  invoiceRef: string;
  orgName: string;
  clientName: string;
  clientAddress: string;
  lineItems: LineItem[];
  total: number;
  dueDate: string | null;
  status: string;
  bankName: string | null;
  sortCode: string | null;
  accountNumber: string | null;
  paymentTerms: number;
}

export function generateInvoicePdf(data: InvoicePdfData): void {
  const { doc, y: startY } = newBrandedDoc(`Invoice ${data.invoiceRef}`, data.orgName);
  let y = startY;

  y = addKeyValueLine(doc, "Bill to", data.clientName, y);
  if (data.clientAddress) y = addKeyValueLine(doc, "", data.clientAddress, y);
  y = addKeyValueLine(doc, "Status", data.status[0].toUpperCase() + data.status.slice(1), y);
  if (data.dueDate) {
    y = addKeyValueLine(doc, "Due date", new Date(data.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), y);
  }
  y += 4;

  // Table header
  y = ensureSpace(doc, y, 14);
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text("Description", PAGE_MARGIN, y);
  doc.text("Hours", PAGE_WIDTH - PAGE_MARGIN - 55, y, { align: "right" });
  doc.text("Rate", PAGE_WIDTH - PAGE_MARGIN - 30, y, { align: "right" });
  doc.text("Total", PAGE_WIDTH - PAGE_MARGIN, y, { align: "right" });
  y += 2;
  doc.setDrawColor(229, 231, 235);
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
  y += 5;

  doc.setTextColor(17, 24, 39);
  for (const item of data.lineItems) {
    y = ensureSpace(doc, y, 8);
    doc.text(item.description, PAGE_MARGIN, y);
    doc.text(String(item.quantity), PAGE_WIDTH - PAGE_MARGIN - 55, y, { align: "right" });
    doc.text(`£${item.unit_price.toFixed(2)}`, PAGE_WIDTH - PAGE_MARGIN - 30, y, { align: "right" });
    doc.text(`£${item.total.toFixed(2)}`, PAGE_WIDTH - PAGE_MARGIN, y, { align: "right" });
    y += 6;
  }

  y += 2;
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(`Total due: £${data.total.toFixed(2)}`, PAGE_WIDTH - PAGE_MARGIN, y, { align: "right" });
  y += 10;

  if (data.bankName || data.sortCode || data.accountNumber) {
    y = ensureSpace(doc, y, 24);
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("Payment details", PAGE_MARGIN, y);
    y += 5;
    doc.setTextColor(17, 24, 39);
    if (data.bankName) {
      doc.text(`Account name: ${data.bankName}`, PAGE_MARGIN, y);
      y += 5;
    }
    if (data.sortCode) {
      doc.text(`Sort code: ${data.sortCode}`, PAGE_MARGIN, y);
      y += 5;
    }
    if (data.accountNumber) {
      doc.text(`Account number: ${data.accountNumber}`, PAGE_MARGIN, y);
      y += 5;
    }
    doc.text(`Payment terms: ${data.paymentTerms} days`, PAGE_MARGIN, y);
    y += 5;
  }

  doc.save(`${data.invoiceRef}.pdf`);
}
