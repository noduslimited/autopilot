import { newBrandedDoc, ensureSpace, PAGE_MARGIN, PAGE_WIDTH } from "./pdfHelpers";

export interface StaffHoursPdfRow {
  name: string;
  role: string;
  totalShifts: number;
  scheduledHours: number;
  actualHours: number;
  difference: number;
  visitsCompleted: number;
}

const ROLE_LABELS: Record<string, string> = {
  carer: "Carer",
  senior_carer: "Senior carer",
  manager: "Manager",
};

// Item 1, Gokul's direct request 2026-09-06 — Staff Hours Report PDF
// export, same branded-header/table pattern as generateInvoiceListPdf.ts.
export function generateStaffHoursPdf(rows: StaffHoursPdfRow[], dateFromLabel: string, dateToLabel: string): void {
  const { doc, y: startY } = newBrandedDoc("Staff hours report", `${dateFromLabel} – ${dateToLabel} · Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`);
  let y = startY;

  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text("Staff", PAGE_MARGIN, y);
  doc.text("Role", PAGE_MARGIN + 45, y);
  doc.text("Shifts", PAGE_MARGIN + 75, y);
  doc.text("Scheduled", PAGE_MARGIN + 95, y);
  doc.text("Actual", PAGE_MARGIN + 120, y);
  doc.text("Diff", PAGE_MARGIN + 142, y);
  doc.text("Visits", PAGE_WIDTH - PAGE_MARGIN, y, { align: "right" });
  y += 2;
  doc.setDrawColor(229, 231, 235);
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
  y += 5.5;

  doc.setFontSize(9);
  for (const row of rows) {
    y = ensureSpace(doc, y, 8);
    doc.setTextColor(17, 24, 39);
    doc.text(row.name, PAGE_MARGIN, y);
    doc.text(ROLE_LABELS[row.role] ?? row.role, PAGE_MARGIN + 45, y);
    doc.text(String(row.totalShifts), PAGE_MARGIN + 75, y);
    doc.text(`${row.scheduledHours.toFixed(1)}h`, PAGE_MARGIN + 95, y);
    doc.text(`${row.actualHours.toFixed(1)}h`, PAGE_MARGIN + 120, y);
    doc.setTextColor(row.difference <= -1 ? 163 : 17, row.difference <= -1 ? 45 : 24, row.difference <= -1 ? 45 : 39);
    doc.text(`${row.difference >= 0 ? "+" : ""}${row.difference.toFixed(1)}h`, PAGE_MARGIN + 142, y);
    doc.setTextColor(17, 24, 39);
    doc.text(String(row.visitsCompleted), PAGE_WIDTH - PAGE_MARGIN, y, { align: "right" });
    y += 6;
  }

  const totals = rows.reduce(
    (acc, r) => ({
      shifts: acc.shifts + r.totalShifts,
      scheduled: acc.scheduled + r.scheduledHours,
      actual: acc.actual + r.actualHours,
      visits: acc.visits + r.visitsCompleted,
    }),
    { shifts: 0, scheduled: 0, actual: 0, visits: 0 },
  );

  y += 2;
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text("Totals", PAGE_MARGIN, y);
  doc.text(String(totals.shifts), PAGE_MARGIN + 75, y);
  doc.text(`${totals.scheduled.toFixed(1)}h`, PAGE_MARGIN + 95, y);
  doc.text(`${totals.actual.toFixed(1)}h`, PAGE_MARGIN + 120, y);
  doc.text(`${(totals.actual - totals.scheduled >= 0 ? "+" : "") + (totals.actual - totals.scheduled).toFixed(1)}h`, PAGE_MARGIN + 142, y);
  doc.text(String(totals.visits), PAGE_WIDTH - PAGE_MARGIN, y, { align: "right" });

  doc.save(`staff-hours-${new Date().toISOString().slice(0, 10)}.pdf`);
}
