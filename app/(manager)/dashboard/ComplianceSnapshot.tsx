import { ProgressBar } from "@/components/ui/ProgressBar";

// Source: PRD section 4.2 (Compliance snapshot)
export interface ComplianceSnapshotProps {
  carePlansReviewedPct: number;
  dbsValidPct: number;
  trainingUpToDatePct: number;
  medsCorrectPct: number;
}

export function ComplianceSnapshot({
  carePlansReviewedPct,
  dbsValidPct,
  trainingUpToDatePct,
  medsCorrectPct,
}: ComplianceSnapshotProps) {
  const rows = [
    { label: "Care plans reviewed", value: carePlansReviewedPct },
    { label: "Staff DBS valid", value: dbsValidPct },
    // Training bar turns amber below 80% per PRD.
    { label: "Training up to date", value: trainingUpToDatePct, amberThreshold: 80 },
    { label: "Meds administered correctly", value: medsCorrectPct },
  ];

  return (
    <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
      <h2 className="text-subsection-heading text-text-primary">Compliance snapshot</h2>
      <div className="mt-3 space-y-3">
        {rows.map((row) => {
          const isAmber = row.amberThreshold !== undefined && row.value < row.amberThreshold;
          return (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-body text-text-primary">{row.label}</span>
                <span className={["text-body font-medium", isAmber ? "text-nhs-amber" : "text-text-primary"].join(" ")}>
                  {row.value}%
                </span>
              </div>
              <ProgressBar value={row.value} variant={isAmber ? "amber" : "green"} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
