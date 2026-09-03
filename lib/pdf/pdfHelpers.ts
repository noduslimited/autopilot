import { jsPDF } from "jspdf";

// Source: Gokul, direct request 2026-09-03 — "Nothing should open a print
// dialog. Everything should download as a PDF file directly to the
// device." Replaces the window.print() pattern used throughout the app
// since Session 7 (chosen at the time specifically because no
// PDF-generation library existed in the project — that's no longer true).
// jsPDF runs entirely client-side, so it fits Netlify's serverless
// constraints with no server-side rendering/headless-browser needed —
// every call site below is inside a "use client" component.
//
// One small shared header-drawing helper rather than a full framework —
// each PDF generator still lays out its own body content directly, since
// an incident report, an AI report, and an invoice have genuinely
// different shapes and a generic layout engine would cost more than it
// saves for three document types.
const PAGE_MARGIN = 15;
const PAGE_WIDTH = 210; // A4 mm

export function newBrandedDoc(title: string, subtitle?: string): { doc: jsPDF; y: number } {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(0, 48, 135); // NHS Dark Blue #003087
  doc.text("Autopilot", PAGE_MARGIN, 18);
  doc.setFontSize(8);
  doc.setTextColor(65, 182, 230); // NHS Light Blue #41B6E6
  doc.text("NODUS LIMITED", PAGE_MARGIN, 23);

  doc.setDrawColor(229, 231, 235); // border default
  doc.line(PAGE_MARGIN, 27, PAGE_WIDTH - PAGE_MARGIN, 27);

  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text(title, PAGE_MARGIN, 37);

  let y = 37;
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    y += 6;
    doc.text(subtitle, PAGE_MARGIN, y);
  }

  return { doc, y: y + 10 };
}

export function addSectionHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(11);
  doc.setTextColor(0, 94, 184); // NHS Blue
  doc.text(text, PAGE_MARGIN, y);
  return y + 6;
}

export function addKeyValueLine(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(label, PAGE_MARGIN, y);
  doc.setTextColor(17, 24, 39);
  doc.text(value, PAGE_MARGIN + 45, y);
  return y + 5.5;
}

// Wraps a long paragraph to the page width and returns the new y position.
export function addParagraph(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  const lines: string[] = doc.splitTextToSize(text, PAGE_WIDTH - PAGE_MARGIN * 2);
  doc.text(lines, PAGE_MARGIN, y);
  return y + lines.length * 4.5 + 3;
}

export function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = 297;
  if (y + needed > pageHeight - PAGE_MARGIN) {
    doc.addPage();
    return 20;
  }
  return y;
}

export { PAGE_MARGIN, PAGE_WIDTH };
