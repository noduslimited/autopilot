import { createClient } from "@/lib/supabase/server";
import { ReportsClient, type SavedReportItem } from "./ReportsClient";

// Source: PRD section 4.8 (Reports)

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthRange(monthsAgo: number): { start: Date; end: Date; label: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 1));
  return { start, end, label: MONTH_LABELS[start.getUTCMonth()]! };
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const { data: savedRows } = await supabase
    .from("saved_reports")
    .select("id, name, report_type, content, created_at")
    .order("created_at", { ascending: false });

  const savedReports: SavedReportItem[] = (savedRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    reportType: r.report_type as "ai" | "manual",
    content: r.content,
    createdAt: r.created_at,
  }));

  // 6-month trend charts — native SVG (CLAUDE.md rule 8), computed from
  // real visits/emar_records, not a third-party charting library.
  const months = Array.from({ length: 6 }, (_, i) => monthRange(5 - i));

  const visitCompletion = await Promise.all(
    months.map(async ({ start, end, label }) => {
      const { data } = await supabase
        .from("visits")
        .select("status")
        .gte("scheduled_start", start.toISOString())
        .lt("scheduled_start", end.toISOString());
      const rows = (data ?? []).filter((r) => r.status !== "cancelled");
      const completed = rows.filter((r) => r.status === "completed").length;
      return { label, value: rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0 };
    }),
  );

  const medicationCompliance = await Promise.all(
    months.map(async ({ start, end, label }) => {
      const { data } = await supabase
        .from("emar_records")
        .select("administered")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());
      const rows = data ?? [];
      const administered = rows.filter((r) => r.administered).length;
      return { label, value: rows.length > 0 ? Math.round((administered / rows.length) * 100) : 0 };
    }),
  );

  return (
    <div className="p-5">
      <h1 className="text-page-heading text-text-primary">Reports</h1>
      <p className="mt-1 text-secondary text-text-secondary">AI-generated summaries and manual reports for CQC, compliance, and care quality</p>

      <ReportsClient savedReports={savedReports} visitCompletion={visitCompletion} medicationCompliance={medicationCompliance} />
    </div>
  );
}
