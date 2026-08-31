"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { BarChart, type BarChartDataPoint } from "@/components/charts/BarChart";

export interface SavedReportItem {
  id: string;
  name: string;
  reportType: "ai" | "manual";
  content: string;
  createdAt: string;
}

const PROMPT_CHIPS = ["Monthly CQC summary", "All incidents this month", "Staff compliance overview"];

// "Download PDF" is implemented via the browser's own print dialog (PRD
// section 4.8: "Download renders PDF via browser print API") rather than
// a server-side PDF library — a new window with just the report content
// keeps the printout clean instead of printing the whole Reports page.
function printReportAsPdf(title: string, content: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(
    `<html><head><title>${title}</title></head><body style="font-family:sans-serif;white-space:pre-line;padding:24px;">${content.replace(/</g, "&lt;")}</body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
}

export function ReportsClient({
  savedReports,
  visitCompletion,
  medicationCompliance,
}: {
  savedReports: SavedReportItem[];
  visitCompletion: BarChartDataPoint[];
  medicationCompliance: BarChartDataPoint[];
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [reportText, setReportText] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedConfirmation, setSavedConfirmation] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setReportText("");
    setHasGenerated(false);
    setSavedConfirmation(false);

    const response = await fetch("/api/ai/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.trim() }),
    }).catch(() => null);

    if (!response || !response.ok || !response.body) {
      setError("Report generation is temporarily unavailable. Please try again shortly.");
      setGenerating(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk.includes("__AI_REPORT_ERROR__") && text.length === 0) {
        setError("Report generation is temporarily unavailable. Please try again shortly.");
        setGenerating(false);
        return;
      }
      text += chunk;
      setReportText(text);
    }

    setGenerating(false);
    setHasGenerated(text.length > 0);
    if (text.length === 0) {
      setError("Report generation is temporarily unavailable. Please try again shortly.");
    }
  }

  async function handleSaveToReports() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: managerRow } = await supabase.from("users").select("org_id").eq("id", user!.id).single();

    await supabase.from("saved_reports").insert({
      org_id: managerRow!.org_id,
      name: prompt.trim().slice(0, 80),
      report_type: "ai",
      content: reportText,
      generated_by: user!.id,
    });

    setSaving(false);
    setSavedConfirmation(true);
    router.refresh();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(reportText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    printReportAsPdf(prompt.trim().slice(0, 80) || "Autopilot report", reportText);
  }

  return (
    <div>
      <div className="mt-4 rounded-card bg-nhs-dark-blue py-4 px-4">
        <p className="flex items-center gap-1.5 text-body font-medium text-white">
          <i className="ti ti-sparkles text-[16px] text-nhs-light-blue" aria-hidden="true" />
          Generate a report with AI
        </p>
        <p className="mt-1 text-secondary text-[#B9C6E0]">
          Describe what you need and AI will pull from your live data — visits, incidents, medication, staff compliance, and more.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PROMPT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setPrompt(chip)}
              className="rounded-[20px] border border-white/20 bg-white/10 px-3 py-1.5 text-secondary text-white hover:bg-white/20"
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Give me a summary of all incidents for Margaret Hill in the last 3 months…"
            className="flex-1 rounded-input border border-white/20 bg-white/10 px-3 py-[9px] text-body text-white placeholder:text-[#B9C6E0] outline-none"
          />
          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="!bg-nhs-light-blue !text-nhs-dark-blue"
          >
            {generating ? "Generating…" : "Generate"}
          </Button>
        </div>
      </div>

      {generating || hasGenerated || error ? (
        <div className="mt-4 rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-subsection-heading text-text-primary">{hasGenerated ? "Generated report" : "Generating…"}</h2>
              {hasGenerated ? <Badge variant="ai">AI</Badge> : null}
            </div>
            {generating ? <p className="text-secondary text-text-secondary">AI is generating your report…</p> : null}
          </div>

          {error ? (
            <p className="mt-2 text-body text-nhs-red">{error}</p>
          ) : (
            <>
              <Textarea
                className="mt-2 min-h-[200px] whitespace-pre-line"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                readOnly={generating}
              />
              {hasGenerated ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">
                  <Button variant="secondary" onClick={handlePrint}>
                    Download PDF
                  </Button>
                  <Button variant="secondary" onClick={handleCopy}>
                    {copied ? "Copied" : "Share"}
                  </Button>
                  <Button onClick={handleSaveToReports} disabled={saving}>
                    {saving ? "Saving…" : savedConfirmation ? "Saved" : "Save to reports"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <h3 className="text-subsection-heading text-text-primary">Visit completion rate</h3>
          <BarChart data={visitCompletion} color="#007F3B" />
        </div>
        <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <h3 className="text-subsection-heading text-text-primary">Medication compliance</h3>
          <BarChart data={medicationCompliance} color="#005EB8" />
        </div>
      </div>

      <div className="mt-4 rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h2 className="text-subsection-heading text-text-primary">Saved reports</h2>
        {savedReports.length === 0 ? (
          <p className="mt-2 text-body text-text-secondary">No reports saved yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse">
              <thead>
                <tr className="border-b border-border-default text-left text-label text-text-secondary">
                  <th className="py-2 pr-4">Report name</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {savedReports.map((report) => (
                  <tr key={report.id} className="border-b border-border-default last:border-b-0">
                    <td className="py-2.5 pr-4 text-body text-text-primary">{report.name}</td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={report.reportType === "ai" ? "ai" : "notStarted"}>
                        {report.reportType === "ai" ? "AI-generated" : "Manual"}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-body text-text-secondary">
                      {new Date(report.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <SavedReportDownloadButton report={report} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SavedReportDownloadButton({ report }: { report: SavedReportItem }) {
  return (
    <button
      type="button"
      onClick={() => printReportAsPdf(report.name, report.content)}
      className="rounded-btn border border-border-default bg-card-bg px-3 py-[6px] text-[12px] font-medium text-text-primary"
    >
      PDF
    </button>
  );
}
