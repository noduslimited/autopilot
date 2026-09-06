"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toCsv } from "@/lib/csv";
import { generateStaffHoursPdf } from "@/lib/pdf/generateStaffHoursPdf";

// Item 1, Gokul's direct request 2026-09-06 — Staff Hours Report.

export interface StaffOption {
  id: string;
  name: string;
  role: "carer" | "senior_carer" | "manager";
}

interface ReportRow {
  staffId: string;
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

// "Significantly under" — a difference of at least a full hour short of
// what was scheduled. A judgement call (no document specifies a
// threshold): small variances (a few minutes either side of a scheduled
// shift) are normal and not worth flagging red on every single row.
const SIGNIFICANT_UNDER_HOURS = 1;

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function formatDateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type Preset = "this_week" | "last_week" | "this_month" | "last_month" | "custom";

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  if (preset === "this_week") {
    const from = startOfWeek(now);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 6);
    return { from: toISODate(from), to: toISODate(to) };
  }
  if (preset === "last_week") {
    const from = startOfWeek(now);
    from.setUTCDate(from.getUTCDate() - 7);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 6);
    return { from: toISODate(from), to: toISODate(to) };
  }
  if (preset === "this_month") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return { from: toISODate(from), to: toISODate(to) };
  }
  if (preset === "last_month") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return { from: toISODate(from), to: toISODate(to) };
  }
  return { from: toISODate(now), to: toISODate(now) };
}

const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom" },
];

export function StaffHoursClient({ staff }: { staff: StaffOption[] }) {
  const [preset, setPreset] = useState<Preset>("this_week");
  const initialRange = presetRange("this_week");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(staff.map((s) => s.id)));
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = staff.length > 0 && selectedIds.size === staff.length;

  function selectPreset(value: Preset) {
    setPreset(value);
    if (value !== "custom") {
      const range = presetRange(value);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  }

  function toggleStaff(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(staff.map((s) => s.id)));
  }

  async function generateReport() {
    if (selectedIds.size === 0) {
      setError("Select at least one staff member.");
      return;
    }
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      setError("Select a valid date range.");
      return;
    }
    setGenerating(true);
    setError(null);
    const response = await fetch("/api/staff/hours-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffIds: Array.from(selectedIds), dateFrom, dateTo }),
    }).catch(() => null);
    setGenerating(false);
    const data = await response?.json().catch(() => null);
    if (!response?.ok || !data?.rows) {
      setError("Could not generate the report. Please try again.");
      return;
    }
    setRows(data.rows);
  }

  const totals = (rows ?? []).reduce(
    (acc, r) => ({
      shifts: acc.shifts + r.totalShifts,
      scheduled: acc.scheduled + r.scheduledHours,
      actual: acc.actual + r.actualHours,
      visits: acc.visits + r.visitsCompleted,
    }),
    { shifts: 0, scheduled: 0, actual: 0, visits: 0 },
  );

  function downloadPdf() {
    if (!rows) return;
    generateStaffHoursPdf(rows, formatDateLabel(dateFrom), formatDateLabel(dateTo));
  }

  function downloadCsv() {
    if (!rows) return;
    const csv = toCsv(
      rows.map((r) => ({
        staff_name: r.name,
        role: ROLE_LABELS[r.role] ?? r.role,
        total_shifts: r.totalShifts,
        scheduled_hours: r.scheduledHours,
        actual_hours: r.actualHours,
        difference_hours: r.difference,
        visits_completed: r.visitsCompleted,
      })),
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-hours-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-card border border-border-default bg-card-bg p-4">
        <h2 className="text-subsection-heading text-text-primary">Date range</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => selectPreset(p.value)}
              className={[
                "rounded-badge border px-3 py-1.5 text-[13px] font-medium",
                preset === p.value ? "border-nhs-blue bg-ai-blue-light text-ai-blue-heading" : "border-border-default bg-card-bg text-text-primary",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
          <div>
            <p className="mb-1 text-label text-text-secondary">From</p>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPreset("custom");
              }}
            />
          </div>
          <div>
            <p className="mb-1 text-label text-text-secondary">To</p>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPreset("custom");
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border-default bg-card-bg p-4">
        <h2 className="text-subsection-heading text-text-primary">Staff</h2>
        <label className="mt-2 flex items-center gap-2 border-b border-border-default pb-2">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-nhs-blue" />
          <span className="text-body font-medium text-text-primary">All staff</span>
        </label>
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => (
            <label key={member.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.has(member.id)}
                onChange={() => toggleStaff(member.id)}
                className="h-4 w-4 accent-nhs-blue"
              />
              <span className="text-body text-text-primary">{member.name}</span>
              <span className="text-secondary text-text-secondary">{ROLE_LABELS[member.role] ?? member.role}</span>
            </label>
          ))}
          {staff.length === 0 ? <p className="text-body text-text-secondary">No staff found.</p> : null}
        </div>
      </div>

      {error ? <p className="text-body text-nhs-red">{error}</p> : null}

      <Button onClick={generateReport} loading={generating}>
        {generating ? "Generating…" : "Generate report"}
      </Button>

      {rows ? (
        <div className="rounded-card border border-border-default bg-card-bg p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-subsection-heading text-text-primary">
              Results — {formatDateLabel(dateFrom)} to {formatDateLabel(dateTo)}
            </h2>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={downloadCsv} disabled={rows.length === 0}>
                Download CSV
              </Button>
              <Button variant="secondary" onClick={downloadPdf} disabled={rows.length === 0}>
                Download PDF
              </Button>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="mt-3 text-body text-text-secondary">No data for the selected staff and date range.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-body">
                <thead>
                  <tr className="border-b border-border-default text-label text-text-secondary">
                    <th className="py-2 pr-3 font-normal">Staff name</th>
                    <th className="py-2 pr-3 font-normal">Role</th>
                    <th className="py-2 pr-3 font-normal">Shifts</th>
                    <th className="py-2 pr-3 font-normal">Scheduled hrs</th>
                    <th className="py-2 pr-3 font-normal">Actual hrs</th>
                    <th className="py-2 pr-3 font-normal">Difference</th>
                    <th className="py-2 pr-3 font-normal">Visits completed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const significantlyUnder = row.difference <= -SIGNIFICANT_UNDER_HOURS;
                    return (
                      <tr key={row.staffId} className="border-b border-border-default last:border-0">
                        <td className="py-2 pr-3 font-medium text-text-primary">{row.name}</td>
                        <td className="py-2 pr-3 text-text-secondary">{ROLE_LABELS[row.role] ?? row.role}</td>
                        <td className="py-2 pr-3 text-text-primary">{row.totalShifts}</td>
                        <td className="py-2 pr-3 text-text-primary">{row.scheduledHours.toFixed(1)}h</td>
                        <td className="py-2 pr-3 text-text-primary">{row.actualHours.toFixed(1)}h</td>
                        <td className={["py-2 pr-3 font-medium", significantlyUnder ? "text-danger-red" : "text-text-primary"].join(" ")}>
                          {row.difference >= 0 ? "+" : ""}
                          {row.difference.toFixed(1)}h
                        </td>
                        <td className="py-2 pr-3 text-text-primary">{row.visitsCompleted}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border-default font-medium text-text-primary">
                    <td className="py-2 pr-3">Totals</td>
                    <td className="py-2 pr-3"></td>
                    <td className="py-2 pr-3">{totals.shifts}</td>
                    <td className="py-2 pr-3">{totals.scheduled.toFixed(1)}h</td>
                    <td className="py-2 pr-3">{totals.actual.toFixed(1)}h</td>
                    <td className="py-2 pr-3">
                      {totals.actual - totals.scheduled >= 0 ? "+" : ""}
                      {(totals.actual - totals.scheduled).toFixed(1)}h
                    </td>
                    <td className="py-2 pr-3">{totals.visits}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
