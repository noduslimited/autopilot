import { newBrandedDoc, addSectionHeading, addKeyValueLine, addParagraph, ensureSpace } from "./pdfHelpers";

export interface IncidentPdfData {
  incidentRef: string;
  clientName: string;
  incidentType: string;
  severity: string;
  status: string;
  createdAt: string;
  reporterName: string;
  description: string;
  gpContacted: boolean;
  gpNotes: string | null;
  managerNotes: string | null;
  signedOffByName: string | null;
  signedOffAt: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function generateIncidentPdf(data: IncidentPdfData): void {
  const { doc, y: startY } = newBrandedDoc(`Incident Report — ${data.incidentRef}`, data.clientName);
  let y = startY;

  y = addKeyValueLine(doc, "Incident type", data.incidentType, y);
  y = addKeyValueLine(doc, "Severity", data.severity, y);
  y = addKeyValueLine(doc, "Status", data.status, y);
  y = addKeyValueLine(doc, "Reported by", data.reporterName, y);
  y = addKeyValueLine(doc, "Date", formatDate(data.createdAt), y);
  y += 3;

  y = addSectionHeading(doc, "What happened", y);
  y = addParagraph(doc, data.description, y);

  y = ensureSpace(doc, y, 20);
  y = addSectionHeading(doc, "GP / emergency services", y);
  y = addKeyValueLine(doc, "Contacted", data.gpContacted ? "Yes" : "No", y);
  if (data.gpNotes) y = addParagraph(doc, data.gpNotes, y);

  if (data.managerNotes) {
    y = ensureSpace(doc, y, 20);
    y = addSectionHeading(doc, "Manager notes", y);
    y = addParagraph(doc, data.managerNotes, y);
  }

  y = ensureSpace(doc, y, 20);
  y = addSectionHeading(doc, "Sign-off", y);
  if (data.signedOffByName) {
    y = addKeyValueLine(doc, "Signed off by", data.signedOffByName, y);
    if (data.signedOffAt) y = addKeyValueLine(doc, "Date", formatDate(data.signedOffAt), y);
  } else {
    y = addParagraph(doc, "This incident has not yet been signed off.", y);
  }

  doc.save(`${data.incidentRef}.pdf`);
}
