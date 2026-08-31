"use client";

// Source: PRD section 4.2 (5 metric cards)
export interface MetricCardsProps {
  activeClientsCount: number;
  newClientsThisMonth: number;
  visitsToday: number;
  completedCount: number;
  pendingCount: number;
  staffOnShiftCount: number;
  lateCheckInCount: number;
  openIncidentsCount: number;
  highPriorityIncidentsCount: number;
  invoiceDueTotal: number;
  unpaidThisMonthCount: number;
}

function formatGBP(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(
    amount,
  );
}

interface Metric {
  label: string;
  value: string;
  subtext: string;
  subtextClassName: string;
}

export function MetricCards(props: MetricCardsProps) {
  const metrics: Metric[] = [
    {
      label: "Active clients",
      value: String(props.activeClientsCount),
      subtext: `+${props.newClientsThisMonth} this month`,
      subtextClassName: "text-nhs-green",
    },
    {
      label: "Visits today",
      value: String(props.visitsToday),
      subtext: `${props.completedCount} completed · ${props.pendingCount} pending`,
      subtextClassName: "text-text-secondary",
    },
    {
      label: "Staff on shift",
      value: String(props.staffOnShiftCount),
      subtext: props.lateCheckInCount > 0 ? `${props.lateCheckInCount} late check-in` : "All on time",
      subtextClassName: props.lateCheckInCount > 0 ? "text-nhs-amber" : "text-text-secondary",
    },
    {
      label: "Open incidents",
      value: String(props.openIncidentsCount),
      subtext: `${props.highPriorityIncidentsCount} high priority`,
      subtextClassName: props.highPriorityIncidentsCount > 0 ? "text-nhs-red" : "text-text-secondary",
    },
    {
      label: "Invoice due",
      value: formatGBP(props.invoiceDueTotal),
      subtext: `${props.unpaidThisMonthCount} unpaid this month`,
      subtextClassName: "text-nhs-amber",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <p className="text-label text-text-secondary">{metric.label}</p>
          <p className="mt-1 text-[20px] font-bold text-text-primary">{metric.value}</p>
          <p className={["mt-0.5 text-secondary", metric.subtextClassName].join(" ")}>{metric.subtext}</p>
        </div>
      ))}
    </div>
  );
}
