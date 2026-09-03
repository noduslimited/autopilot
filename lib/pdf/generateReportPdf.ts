import { newBrandedDoc, addParagraph, ensureSpace } from "./pdfHelpers";

// Replaces the old printReportAsPdf() (browser print dialog) — same call
// shape (title + free-text content), used for both a freshly-generated
// AI report and any previously saved one.
export function generateReportPdf(title: string, content: string): void {
  const { doc, y: startY } = newBrandedDoc(title, new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
  let y = startY;

  const paragraphs = content.split("\n\n");
  for (const paragraph of paragraphs) {
    y = ensureSpace(doc, y, 20);
    y = addParagraph(doc, paragraph, y);
  }

  const safeTitle = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`${safeTitle || "report"}.pdf`);
}
